
import { useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import { tripService, profileService } from '../services';
import { RideRequest, PassengerDetails, DriverTripPhase } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';

export const useDriverTripManager = (
    onTripStateReset: () => void,
    onRouteDraw: (coords: L.LatLngExpression[], color: string, fitBounds?: boolean) => void,
    onTripMarkersDraw: (origin: L.LatLngTuple, dest: L.LatLngTuple | null) => void,
    driverLocation: { lat: number, lng: number } | null
) => {
    const { t } = useAppContext();
    const [currentTrip, setCurrentTrip] = useState<RideRequest | null>(null);
    const [currentPassengerDetails, setCurrentPassengerDetails] = useState<PassengerDetails | null>(null);
    const [isLoadingPassengerDetails, setIsLoadingPassengerDetails] = useState(false);
    const [passengerDetailsError, setPassengerDetailsError] = useState<string | null>(null);
    const [currentTripPhase, setCurrentTripPhase] = useState<DriverTripPhase>(DriverTripPhase.NONE);

    const [isNavigating, setIsNavigating] = useState(false);
    const [isCalculatingFare, setIsCalculatingFare] = useState(false);
    const [fareSummary, setFareSummary] = useState<{ amount: number; passengerName: string } | null>(null);

    const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
    const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);

    const reset = useCallback(() => {
        setCurrentTrip(null);
        setCurrentPassengerDetails(null);
        setCurrentTripPhase(DriverTripPhase.NONE);
        setIsLoadingPassengerDetails(false);
        setPassengerDetailsError(null);
        setIsNavigating(false);
        setIsCalculatingFare(false);
        onTripStateReset();
    }, [onTripStateReset]);

    const acceptTrip = useCallback(async (requestToAccept: RideRequest, driverId: string) => {
        setCurrentTrip(requestToAccept);
        setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_PICKUP);

        setIsLoadingPassengerDetails(true);
        try {
            const passenger = await profileService.fetchUserDetailsById(requestToAccept.passenger_id);
            setCurrentPassengerDetails(passenger);
        } catch (e) {
            setPassengerDetailsError(t.errorFetchingPassengerDetails);
            console.error("Error fetching passenger details:", getDebugMessage(e));
        } finally {
            setIsLoadingPassengerDetails(false);
        }
    }, [t.errorFetchingPassengerDetails]);
    
    const fetchOsrmRoute = async (startCoords: L.LatLngTuple, endCoords: L.LatLngTuple): Promise<L.LatLngExpression[] | null> => {
        setIsNavigating(true);
        try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`);
            if (!response.ok) throw new Error(`OSRM API error: ${response.status}`);
            const data = await response.json();
            return data.routes?.[0]?.geometry?.coordinates.map((c: number[]) => [c[1], c[0]]) || null;
        } catch (error) {
            console.error("Error fetching OSRM route:", error);
            return null;
        } finally {
            setIsNavigating(false);
        }
    };
    
    const handleNavigateToPickup = async () => {
        if (!currentTrip || !driverLocation) return;
        const driverPos: L.LatLngTuple = [driverLocation.lat, driverLocation.lng];
        const pickupPos: L.LatLngTuple = [currentTrip.origin_lat, currentTrip.origin_lng];
        const routeCoords = await fetchOsrmRoute(driverPos, pickupPos);
        if (routeCoords) onRouteDraw(routeCoords, '#007bff');
        onTripMarkersDraw(pickupPos, null);

        try {
            await tripService.updateRide(currentTrip.id, { driver_arrived_at_origin_at: new Date().toISOString() });
            setCurrentTripPhase(DriverTripPhase.AT_PICKUP);
        } catch (error) {
            console.error("Error updating trip status on navigation:", getDebugMessage(error));
        }
    };

    const handleStartTrip = async () => {
        if (!currentTrip || !driverLocation) return;
        try {
            await tripService.updateRide(currentTrip.id, { status: 'trip_started', trip_started_at: new Date().toISOString() });
            setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_DESTINATION);
            const startPos: L.LatLngTuple = [driverLocation.lat, driverLocation.lng];
            const destPos: L.LatLngTuple = [currentTrip.destination_lat, currentTrip.destination_lng];
            const routeCoords = await fetchOsrmRoute(startPos, destPos);
            if (routeCoords) onRouteDraw(routeCoords, '#28a745');
            onTripMarkersDraw([currentTrip.origin_lat, currentTrip.origin_lng], destPos);
        } catch (error) {
            console.error("Error during trip start process:", getDebugMessage(error));
        }
    };

    const handleEndTrip = async () => {
        if (!currentTrip) return;
        setIsCalculatingFare(true);
        const finalFare = currentTrip.estimated_fare;
        try {
            await tripService.updateRide(currentTrip.id, { status: 'trip_completed', actual_fare: finalFare });
            setIsCalculatingFare(false);
            setFareSummary({ amount: Math.round(finalFare ?? 0), passengerName: currentPassengerDetails?.fullName || t.defaultPassengerName });
        } catch (error) {
            setIsCalculatingFare(false);
            console.error("Critical Error ending trip:", getDebugMessage(error));
            reset();
        }
    };

    const handleDriverCancellationSubmit = async (reasonKey: string, customReason: string) => {
        if (!currentTrip || !currentTrip.driver_id) return;
        setIsSubmittingCancellation(true);
        try {
            await tripService.updateRide(currentTrip.id, { status: 'cancelled_by_driver' });
            await tripService.submitCancellationReport({ rideId: currentTrip.id, userId: currentTrip.driver_id, role: 'driver', reasonKey, customReason });
            reset();
        } catch (error) {
            console.error("Error submitting driver cancellation:", getDebugMessage(error));
            reset();
        } finally {
            setIsSubmittingCancellation(false);
            setIsCancellationModalOpen(false);
        }
    };

    const handleTripUpdateFromSubscription = (updatedTrip: RideRequest) => {
        if (updatedTrip.status === 'cancelled_by_passenger') {
            alert(t.tripCancelledByPassenger);
            reset();
        } else if (!['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'].includes(updatedTrip.status)) {
            reset();
        } else {
            setCurrentTrip(updatedTrip);
        }
    };

    return {
        tripState: {
            currentTrip,
            currentPassengerDetails,
            isLoadingPassengerDetails,
            passengerDetailsError,
            currentTripPhase,
            isNavigating,
            isCalculatingFare,
            fareSummary,
            isCancellationModalOpen,
            isSubmittingCancellation,
        },
        tripActions: {
            acceptTrip,
            handleNavigateToPickup,
            handleStartTrip,
            handleEndTrip,
            reset,
            openCancellationModal: () => setIsCancellationModalOpen(true),
            closeCancellationModal: () => setIsCancellationModalOpen(false),
            handleDriverCancellationSubmit,
            handleTripUpdateFromSubscription,
            setFareSummary,
        }
    };
};
