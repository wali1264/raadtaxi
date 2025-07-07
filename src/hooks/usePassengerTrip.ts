
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { tripService, profileService } from '../services';
import { useAppContext } from '../contexts/AppContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { DriverSearchState, TripPhase, TripSheetDisplayLevel, DriverDetails, AppService } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { PASSENGER_REQUEST_TIMEOUT_MS } from '../config/constants';

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

    const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
    const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);
    
    const [lastRequestArgs, setLastRequestArgs] = useState<{
        origin: any;
        dest: any;
        serviceFor: 'self' | 'other';
        thirdPartyName: string;
        thirdPartyPhone: string;
    } | null>(null);

    const rideRequestChannelRef = useRef<RealtimeChannel | null>(null);
    const activeTripChannelRef = useRef<RealtimeChannel | null>(null);
    const passengerRequestTimeoutRef = useRef<number | null>(null);

    const clearPassengerRequestTimeout = useCallback(() => {
        if (passengerRequestTimeoutRef.current) {
            clearTimeout(passengerRequestTimeoutRef.current);
            passengerRequestTimeoutRef.current = null;
        }
    }, []);

    const handleDriverAssigned = useCallback(async (updatedRequest) => {
        clearPassengerRequestTimeout();
        if (!updatedRequest.driver_id) return;
        
        try {
            const driverProfile = await profileService.fetchDriverProfile(updatedRequest.driver_id);
            const assignedDriverDetails: DriverDetails = {
                name: driverProfile.fullName || `${t.roleDriver} ${updatedRequest.driver_id.substring(0, 6)}`,
                serviceId: selectedService?.id || 'car',
                vehicleModel: driverProfile.vehicleModel || t.dataMissing,
                vehicleColor: driverProfile.vehicleColor || t.dataMissing,
                plateParts: { region: driverProfile.plateRegion || "N/A", numbers: driverProfile.plateNumbers || t.dataMissing, type: driverProfile.plateTypeChar || "-" },
                profilePicUrl: driverProfile.profilePicUrl,
                driverId: updatedRequest.driver_id,
                phoneNumber: driverProfile.phoneNumber || t.dataMissing,
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
        
        const rideRequestPayload = { passenger_id: loggedInUserId, passenger_name: serviceFor === 'self' ? loggedInUserFullName : thirdPartyName.trim(), passenger_phone: serviceFor === 'self' ? null : thirdPartyPhone, is_third_party: serviceFor === 'other', origin_address: origin.address, origin_lat: origin.lat, origin_lng: origin.lng, destination_address: dest.address, destination_lat: dest.lat, destination_lng: dest.lng, service_id: service.id, estimated_fare: price, status: 'pending' };

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
    }, [clearPassengerRequestTimeout, supabase]);

    useEffect(() => {
        if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) {
            passengerRequestTimeoutRef.current = window.setTimeout(async () => {
                if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) {
                    try { await tripService.updateRide(currentRideRequestId, { status: 'no_drivers_available' }); } 
                    catch (error) { console.error("Error timing out ride request:", error); setDriverSearchState('noDriverFound'); }
                }
            }, PASSENGER_REQUEST_TIMEOUT_MS);

            rideRequestChannelRef.current = supabase.channel(`ride_request_updates_${currentRideRequestId}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${currentRideRequestId}` }, (payload) => {
                const updatedRequest = payload.new;
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
                const updatedTrip = payload.new;
                if (updatedTrip.status === 'cancelled_by_driver') {
                    alert(t.tripCancelledByDriver);
                    resetTripState();
                } else if (updatedTrip.status === 'trip_started') {
                    setTripPhase('enRouteToDestination');
                } else if (updatedTrip.status === 'trip_completed') {
                    setTripPhase('arrivedAtDestination');
                    setCurrentTripFare(updatedTrip.actual_fare || updatedTrip.estimated_fare || null);
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
                switch (activeTrip.status) {
                    case 'trip_started': recoveredTripPhase = 'enRouteToDestination'; break;
                    case 'driver_at_destination':
                    case 'trip_completed': recoveredTripPhase = 'arrivedAtDestination'; break;
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