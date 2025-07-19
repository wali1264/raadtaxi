
import { useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import { tripService, profileService } from '../services';
import { RideRequest, PassengerDetails, DriverTripPhase, RideStatus } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';

export const useDriverTripManager = (
    onTripStateReset: () => void,
    onRouteDraw: (coords: L.LatLngExpression[], color: string, fitBounds?: boolean) => void,
    onTripMarkersDraw: (origin: L.LatLngTuple, dest: L.LatLngTuple | null) => void,
    driverLocation: { lat: number; lng: number } | null
) => {
    const { t, loggedInUserId } = useAppContext();
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
        setFareSummary(null);
        onTripStateReset();
    }, [onTripStateReset]);

    const drawRouteFromPolyline = useCallback((polylineString: string, color: string) => {
        try {
            const geometry = JSON.parse(polylineString);
            const leafletCoords = geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as L.LatLngExpression);
            onRouteDraw(leafletCoords, color);
        } catch (e) {
            console.error("Failed to parse route polyline", e);
        }
    }, [onRouteDraw]);
    
    const fetchOsrmRoute = async (startCoords: L.LatLngTuple, endCoords: L.LatLngTuple): Promise<string | null> => {
        setIsNavigating(true);
        try {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`);
            if (!response.ok) throw new Error(`OSRM API error: ${response.status}`);
            const data = await response.json();
            const routeGeometry = data.routes?.[0]?.geometry;
            if (routeGeometry) {
                return JSON.stringify(routeGeometry);
            }
            return null;
        } catch (error) {
            console.error("Error fetching OSRM route:", error);
            return null;
        } finally {
            setIsNavigating(false);
        }
    };
    
    const acceptTrip = useCallback(async (requestToAccept: RideRequest) => {
        setCurrentTrip(requestToAccept);
        setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_PICKUP);

        setIsLoadingPassengerDetails(true);
        try {
            const passenger = await profileService.fetchUserDetailsById(requestToAccept.passenger_id);
            setCurrentPassengerDetails(passenger);
            if (driverLocation) {
                 const driverPos: L.LatLngTuple = [driverLocation.lat, driverLocation.lng];
                 const pickupPos: L.LatLngTuple = [requestToAccept.origin_lat, requestToAccept.origin_lng];
                 const routePolyline = await fetchOsrmRoute(driverPos, pickupPos);
                 if (routePolyline) {
                     drawRouteFromPolyline(routePolyline, '#007bff');
                     const updatedRide = await tripService.updateRide(requestToAccept.id, { route_to_origin_polyline: routePolyline });
                     if (!updatedRide) {
                        // This can happen if the passenger cancels immediately after acceptance.
                        console.warn(`Ride ${requestToAccept.id} was cancelled by passenger immediately. Resetting driver state.`);
                        alert(t.tripCancelledByPassenger);
                        reset();
                        return; // Stop further execution
                     }
                 }
                 onTripMarkersDraw(pickupPos, null);
            }
        } catch (e) {
            setPassengerDetailsError(t.errorFetchingPassengerDetails);
            console.error("Error fetching passenger details or route:", getDebugMessage(e));
        } finally {
            setIsLoadingPassengerDetails(false);
        }
    }, [t.errorFetchingPassengerDetails, t.tripCancelledByPassenger, driverLocation, drawRouteFromPolyline, onTripMarkersDraw, reset]);

    const recoverTrip = useCallback(async () => {
        if (!loggedInUserId || currentTrip) return;

        try {
            const activeTrip = await tripService.fetchActiveDriverTrip(loggedInUserId);
            if (activeTrip) {
                console.log("Recovering active trip for driver:", activeTrip.id);
                setCurrentTrip(activeTrip);

                let phase = DriverTripPhase.NONE;
                const originCoords: L.LatLngTuple = [activeTrip.origin_lat, activeTrip.origin_lng];
                let destCoords: L.LatLngTuple | null = [activeTrip.destination_lat, activeTrip.destination_lng];
                let polyline: string | null = null;
                let color = '#007bff';

                switch (activeTrip.status as RideStatus) {
                    case 'accepted':
                    case 'driver_en_route_to_origin':
                        phase = DriverTripPhase.EN_ROUTE_TO_PICKUP;
                        polyline = activeTrip.route_to_origin_polyline;
                        destCoords = null;
                        break;
                    case 'driver_at_origin':
                        phase = DriverTripPhase.AT_PICKUP;
                        polyline = activeTrip.route_to_origin_polyline;
                        destCoords = null;
                        break;
                    case 'trip_started':
                        phase = DriverTripPhase.EN_ROUTE_TO_DESTINATION;
                        polyline = activeTrip.route_to_destination_polyline;
                        color = '#28a745';
                        break;
                    case 'driver_at_destination':
                        phase = DriverTripPhase.AT_DESTINATION;
                        polyline = activeTrip.route_to_destination_polyline;
                        color = '#28a745';
                        break;
                }

                setCurrentTripPhase(phase);
                onTripMarkersDraw(originCoords, destCoords);
                if (polyline) {
                    drawRouteFromPolyline(polyline, color);
                }

                setIsLoadingPassengerDetails(true);
                try {
                    const passenger = await profileService.fetchUserDetailsById(activeTrip.passenger_id);
                    setCurrentPassengerDetails(passenger);
                } catch (e) {
                    setPassengerDetailsError(t.errorFetchingPassengerDetails);
                    console.error("Error fetching passenger details during recovery:", getDebugMessage(e));
                } finally {
                    setIsLoadingPassengerDetails(false);
                }
            }
        } catch (error) {
            console.error("Error recovering driver trip:", getDebugMessage(error));
        }
    }, [loggedInUserId, currentTrip, t.errorFetchingPassengerDetails, onTripMarkersDraw, drawRouteFromPolyline]);
    
    const handleArrivedAtPickup = async () => {
        if (!currentTrip) return;
        try {
            const updatedTrip = await tripService.updateRide(currentTrip.id, { status: 'driver_at_origin', driver_arrived_at_origin_at: new Date().toISOString() });
            if (updatedTrip) {
                setCurrentTripPhase(DriverTripPhase.AT_PICKUP);
            } else {
                alert(t.tripCancelledByPassenger);
                reset();
            }
        } catch (error) {
            console.error("Error updating trip status on arrival:", getDebugMessage(error));
        }
    };

    const handleStartTrip = async () => {
        if (!currentTrip) return;
        try {
            const startPos: L.LatLngTuple = [currentTrip.origin_lat, currentTrip.origin_lng];
            const destPos: L.LatLngTuple = [currentTrip.destination_lat, currentTrip.destination_lng];
            
            const routePolyline = await fetchOsrmRoute(startPos, destPos);
            
            const updatedTrip = await tripService.updateRide(currentTrip.id, { 
                status: 'trip_started', 
                trip_started_at: new Date().toISOString(),
                route_to_destination_polyline: routePolyline
            });

            if (updatedTrip) {
                setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_DESTINATION);
                if (routePolyline) drawRouteFromPolyline(routePolyline, '#28a745');
                onTripMarkersDraw([currentTrip.origin_lat, currentTrip.origin_lng], destPos);
            } else {
                 alert(t.tripCancelledByPassenger);
                 reset();
            }
        } catch (error) {
            console.error("Error during trip start process:", getDebugMessage(error));
        }
    };

    const handleEndTrip = async () => {
        if (!currentTrip) return;
        setIsCalculatingFare(true);
        const finalFare = currentTrip.estimated_fare;
        try {
            const updatedTrip = await tripService.updateRide(currentTrip.id, { status: 'trip_completed', actual_fare: finalFare });
            setIsCalculatingFare(false);
            if (updatedTrip) {
                setFareSummary({ amount: Math.round(finalFare ?? 0), passengerName: currentPassengerDetails?.fullName || t.defaultPassengerName });
            } else {
                // This shouldn't really happen if the trip was in progress, but as a safeguard:
                console.warn(`Could not find trip ${currentTrip.id} to mark as completed.`);
                reset();
            }
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
            const updatedTrip = await tripService.updateRide(currentTrip.id, { status: 'cancelled_by_driver' });
            if (updatedTrip) {
                await tripService.submitCancellationReport({ rideId: currentTrip.id, userId: currentTrip.driver_id, role: 'driver', reasonKey, customReason });
            } else {
                // Passenger already cancelled. Just log it.
                console.log(`Ride ${currentTrip.id} was already cancelled by passenger.`);
            }
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
        } else if (!['accepted', 'driver_en_route_to_origin', 'driver_at_origin', 'trip_started', 'driver_at_destination'].includes(updatedTrip.status)) {
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
            handleArrivedAtPickup,
            handleStartTrip,
            handleEndTrip,
            reset,
            recoverTrip,
            openCancellationModal: () => setIsCancellationModalOpen(true),
            closeCancellationModal: () => setIsCancellationModalOpen(false),
            handleDriverCancellationSubmit,
            handleTripUpdateFromSubscription,
            setFareSummary,
        }
    };
};
