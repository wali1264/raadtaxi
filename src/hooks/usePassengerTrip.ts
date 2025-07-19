import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { tripService, profileService } from '../services';
import { useAppContext } from '../contexts/AppContext';
import { PostgrestMaybeSingleResponse } from '@supabase/supabase-js';
import { DriverSearchState, TripPhase, TripSheetDisplayLevel, DriverDetails, AppService, RideStatus, RideRequest } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { PASSENGER_REQUEST_TIMEOUT_MS } from '../config/constants';
import { Database } from '../types/supabase';

export const usePassengerTrip = () => {
    const { loggedInUserId, loggedInUserFullName, t, allAppServices } = useAppContext();

    const [driverSearchState, setDriverSearchState] = useState<DriverSearchState>('idle');
    const [notifiedDriverCount, setNotifiedDriverCount] = useState<number>(0);
    const [currentRideRequestId, setCurrentRideRequestId] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<AppService | null>(null);
    const [showDriverSearchSheet, setShowDriverSearchSheet] = useState<boolean>(false);
    
    const [showTripInProgressSheet, setShowTripInProgressSheet] = useState<boolean>(false);
    const [tripSheetDisplayLevel, setTripSheetDisplayLevel] = useState<TripSheetDisplayLevel>('default');
    const [currentTripFare, setCurrentTripFare] = useState<number | null>(null);
    const [currentDriverDetails, setCurrentDriverDetails] = useState<DriverDetails | null>(null);
    const [tripPhase, setTripPhase] = useState<TripPhase>(null);
    const [estimatedTimeToDestination, setEstimatedTimeToDestination] = useState<number | null>(null);
    const [routeToOriginPolyline, setRouteToOriginPolyline] = useState<string | null>(null);
    const [routeToDestinationPolyline, setRouteToDestinationPolyline] = useState<string | null>(null);

    const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
    const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);
    
    const [lastRequestArgs, setLastRequestArgs] = useState<{
        origin: any;
        dest: any;
        serviceFor: 'self' | 'other';
        thirdPartyName: string;
        thirdPartyPhone: string;
    } | null>(null);

    const rideRequestChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const activeTripChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const passengerRequestTimeoutRef = useRef<number | null>(null);

    const clearPassengerRequestTimeout = useCallback(() => {
        if (passengerRequestTimeoutRef.current) {
            clearTimeout(passengerRequestTimeoutRef.current);
            passengerRequestTimeoutRef.current = null;
        }
    }, []);

    const resetTripState = useCallback(() => {
        clearPassengerRequestTimeout();
        if (rideRequestChannelRef.current) supabase.removeChannel(rideRequestChannelRef.current);
        if (activeTripChannelRef.current) supabase.removeChannel(activeTripChannelRef.current);
        
        setDriverSearchState('idle');
        setNotifiedDriverCount(0);
        setCurrentRideRequestId(null);
        setSelectedService(null);
        setShowDriverSearchSheet(false);
        setShowTripInProgressSheet(false);
        setTripSheetDisplayLevel('default');
        setCurrentTripFare(null);
        setCurrentDriverDetails(null);
        setTripPhase(null);
        setEstimatedTimeToDestination(null);
        setIsCancellationModalOpen(false);
        setIsSubmittingCancellation(false);
        setLastRequestArgs(null);
        setRouteToOriginPolyline(null);
        setRouteToDestinationPolyline(null);
    }, [clearPassengerRequestTimeout, supabase]);

    const handleDriverAssigned = useCallback(async (updatedRequest: RideRequest) => {
        clearPassengerRequestTimeout();
        if (!updatedRequest.driver_id) return;

        try {
            const userDetails = await profileService.fetchUserDetailsById(updatedRequest.driver_id);
            const { data, error: vehicleError }: PostgrestMaybeSingleResponse<Database['public']['Tables']['drivers_profile']['Row']> = await supabase
                .from('drivers_profile')
                .select()
                .eq('user_id', updatedRequest.driver_id)
                .single();
            
            const vehicleData = data;
                
            if (vehicleError && vehicleError.code !== 'PGRST116') console.error("Error fetching driver vehicle details:", getDebugMessage(vehicleError));

            const assignedDriverDetails: DriverDetails = {
                name: userDetails?.fullName || `${t.roleDriver} ${updatedRequest.driver_id.substring(0, 6)}`,
                serviceId: selectedService?.id || 'car',
                phoneNumber: userDetails?.phoneNumber || t.dataMissing,
                profilePicUrl: userDetails?.profilePicUrl,
                driverId: updatedRequest.driver_id,
                vehicleModel: vehicleData?.vehicle_model || t.dataMissing,
                vehicleColor: vehicleData?.vehicle_color || t.dataMissing,
                plateParts: { 
                    region: vehicleData?.plate_region || "N/A", 
                    numbers: vehicleData?.plate_numbers || t.dataMissing, 
                    type: vehicleData?.plate_type_char || "-" 
                },
            };
            setCurrentDriverDetails(assignedDriverDetails);

        } catch (error) {
            console.error("Error fetching full driver details:", getDebugMessage(error));
            const fallbackDetails: DriverDetails = { name: t.roleDriver, serviceId: 'car', vehicleModel: t.dataMissing, vehicleColor: t.dataMissing, plateParts: { region: 'N/A', numbers: t.dataMissing, type: '-' }, driverId: updatedRequest.driver_id, phoneNumber: t.dataMissing };
            setCurrentDriverDetails(fallbackDetails);
        }
        
        setDriverSearchState('driverAssigned');
        setShowDriverSearchSheet(false);
        setShowTripInProgressSheet(true);
        setTripPhase('enRouteToOrigin');
        setTripSheetDisplayLevel('default');
        setRouteToOriginPolyline(updatedRequest.route_to_origin_polyline);
        
        if (rideRequestChannelRef.current) {
            supabase.removeChannel(rideRequestChannelRef.current);
            rideRequestChannelRef.current = null;
        }
    }, [clearPassengerRequestTimeout, selectedService, t, supabase]);

    const startRideRequest = useCallback(async (service, origin, dest, price, serviceFor, thirdPartyName, thirdPartyPhone) => {
        if (!loggedInUserId) {
            console.error("User not logged in. Cannot create ride request.");
            setDriverSearchState('noDriverFound');
            return;
        }
        
        const rideRequestPayload: Omit<RideRequest, 'id' | 'created_at' | 'updated_at'> = { passenger_id: loggedInUserId, passenger_name: serviceFor === 'self' ? loggedInUserFullName : thirdPartyName.trim(), passenger_phone: serviceFor === 'self' ? null : thirdPartyPhone, is_third_party: serviceFor === 'other', origin_address: origin.address, origin_lat: origin.lat, origin_lng: origin.lng, destination_address: dest.address, destination_lat: dest.lat, destination_lng: dest.lng, service_id: service.id, estimated_fare: price, status: 'pending' as RideStatus, driver_id: null, accepted_at: null, driver_arrived_at_destination_at: null, driver_arrived_at_origin_at: null, actual_fare: null, route_to_destination_polyline: null, route_to_origin_polyline: null, trip_started_at: null};

        setDriverSearchState('searching');
        setShowDriverSearchSheet(true);
        setCurrentRideRequestId(null);
        setSelectedService(service);
        setCurrentTripFare(price);
        setLastRequestArgs({ origin, dest, serviceFor, thirdPartyName, thirdPartyPhone });
        
        try {
            const rideData = await tripService.createRideRequest(rideRequestPayload);
            setCurrentRideRequestId(rideData.id);
            setDriverSearchState('awaiting_driver_acceptance');
        } catch (error) {
            console.error('Error creating ride request:', getDebugMessage(error));
            setDriverSearchState('noDriverFound');
        }
    }, [loggedInUserId, loggedInUserFullName]);

    useEffect(() => {
        if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) {
            passengerRequestTimeoutRef.current = window.setTimeout(async () => {
                if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) {
                    try { await tripService.updateRide(currentRideRequestId, { status: 'no_drivers_available' }); } 
                    catch (error) { console.error("Error timing out ride request:", error); setDriverSearchState('noDriverFound'); }
                }
            }, PASSENGER_REQUEST_TIMEOUT_MS);

            rideRequestChannelRef.current = supabase.channel(`ride_request_updates_${currentRideRequestId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${currentRideRequestId}` }, (payload) => {
                const updatedRequest = payload.new as RideRequest;
                if (updatedRequest.status === 'accepted' && updatedRequest.driver_id) {
                    handleDriverAssigned(updatedRequest);
                } else if (['cancelled_by_driver', 'no_drivers_available'].includes(updatedRequest.status)) {
                    setDriverSearchState('noDriverFound');
                    clearPassengerRequestTimeout();
                }
            }).subscribe();

            return () => {
                clearPassengerRequestTimeout();
                if (rideRequestChannelRef.current) supabase.removeChannel(rideRequestChannelRef.current);
            };
        }
    }, [driverSearchState, currentRideRequestId, supabase, handleDriverAssigned, clearPassengerRequestTimeout]);

    useEffect(() => {
        if (showTripInProgressSheet && currentRideRequestId) {
            activeTripChannelRef.current = supabase.channel(`active_trip_updates_${currentRideRequestId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${currentRideRequestId}` }, (payload) => {
                const updatedTrip = payload.new as RideRequest;
                if (updatedTrip.status === 'cancelled_by_driver') {
                    alert(t.tripCancelledByDriver);
                    resetTripState();
                } else if (updatedTrip.status === 'trip_completed' || updatedTrip.status === 'driver_at_destination') {
                    setTripPhase('arrivedAtDestination');
                    setCurrentTripFare(updatedTrip.actual_fare || updatedTrip.estimated_fare || null);
                } else if (updatedTrip.status === 'trip_started') {
                    setTripPhase('enRouteToDestination');
                    setRouteToOriginPolyline(null); // Clear old route
                    setRouteToDestinationPolyline(updatedTrip.route_to_destination_polyline);
                } else if (updatedTrip.status === 'driver_at_origin') {
                    setTripPhase('atPickup');
                } else if (updatedTrip.status === 'accepted') {
                    setTripPhase('enRouteToOrigin');
                    setRouteToOriginPolyline(updatedTrip.route_to_origin_polyline);
                }
            }).subscribe();
            
            return () => {
                if (activeTripChannelRef.current) supabase.removeChannel(activeTripChannelRef.current);
            };
        }
    }, [showTripInProgressSheet, currentRideRequestId, supabase, t.tripCancelledByDriver, resetTripState]);
    
    const recoverTrip = useCallback(async () => {
        if (!loggedInUserId || showTripInProgressSheet || showDriverSearchSheet) return;
        try {
            const activeTrip = await tripService.fetchActivePassengerTrip(loggedInUserId);
            if (activeTrip && activeTrip.driver_id) {
                const serviceForTrip = allAppServices.find(s => s.id === activeTrip.service_id);
                if (serviceForTrip) setSelectedService(serviceForTrip);
                
                await handleDriverAssigned(activeTrip);
                
                let recoveredTripPhase: TripPhase = 'enRouteToOrigin';
                if (activeTrip.status === 'trip_completed' || activeTrip.status === 'driver_at_destination') {
                    recoveredTripPhase = 'arrivedAtDestination';
                } else if (activeTrip.status === 'trip_started') {
                    recoveredTripPhase = 'enRouteToDestination';
                     setRouteToDestinationPolyline(activeTrip.route_to_destination_polyline);
                } else if (activeTrip.status === 'driver_at_origin') {
                    recoveredTripPhase = 'atPickup';
                } else if (activeTrip.status === 'accepted' || activeTrip.status === 'driver_en_route_to_origin') {
                    setRouteToOriginPolyline(activeTrip.route_to_origin_polyline);
                }
                
                setTripPhase(recoveredTripPhase);
                setCurrentTripFare(activeTrip.actual_fare || activeTrip.estimated_fare || null);
                setCurrentRideRequestId(activeTrip.id);
            }
        } catch (error) {
            console.error("[Trip Recovery] Error recovering passenger trip:", getDebugMessage(error));
        }
    }, [loggedInUserId, showTripInProgressSheet, showDriverSearchSheet, allAppServices, handleDriverAssigned]);


    const submitCancellation = async (reasonKey: string, customReason: string) => {
        if (!currentRideRequestId || !loggedInUserId) return;
        setIsSubmittingCancellation(true);
        try {
            await tripService.updateRide(currentRideRequestId, { status: 'cancelled_by_passenger' });
            await tripService.submitCancellationReport({ rideId: currentRideRequestId, userId: loggedInUserId, role: 'passenger', reasonKey, customReason });
            resetTripState();
        } catch (error) {
            console.error("Error submitting cancellation:", getDebugMessage(error));
        } finally {
            setIsSubmittingCancellation(false);
            setIsCancellationModalOpen(false);
        }
    };
    
    const retryRideRequest = () => {
        if (selectedService && lastRequestArgs) {
            startRideRequest(
                selectedService,
                lastRequestArgs.origin,
                lastRequestArgs.dest,
                currentTripFare,
                lastRequestArgs.serviceFor,
                lastRequestArgs.thirdPartyName,
                lastRequestArgs.thirdPartyPhone
            );
        }
    };


    return {
        tripState: {
            driverSearchState, notifiedDriverCount, showDriverSearchSheet, currentRideRequestId,
            showTripInProgressSheet, tripSheetDisplayLevel, currentTripFare, currentDriverDetails,
            tripPhase, estimatedTimeToDestination, isCancellationModalOpen, isSubmittingCancellation,
            routeToOriginPolyline, routeToDestinationPolyline
        },
        tripActions: {
            startRideRequest,
            resetTripState,
            recoverTrip,
            retryRideRequest,
            setTripSheetDisplayLevel,
            openCancellationModal: () => setIsCancellationModalOpen(true),
            closeCancellationModal: () => setIsCancellationModalOpen(false),
            submitCancellation,
            getSelectedService: () => selectedService,
        }
    };
};