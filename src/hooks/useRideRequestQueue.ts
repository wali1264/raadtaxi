
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { tripService } from '../services';
import { RideRequest } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { DRIVER_REQUEST_POPUP_TIMEOUT_SECONDS, DRIVER_STATUS_POLLING_INTERVAL_MS } from '../config/constants';

export const useRideRequestQueue = (isOnline: boolean, isUserVerified: boolean, onAccept: (request: RideRequest) => void) => {
    const { t } = useAppContext();
    const [allPendingRequests, setAllPendingRequests] = useState<RideRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requestInPopup, setRequestInPopup] = useState<RideRequest | null>(null);
    const [popupTimer, setPopupTimer] = useState(DRIVER_REQUEST_POPUP_TIMEOUT_SECONDS);
    const [timedOutOrDeclinedRequests, setTimedOutOrDeclinedRequests] = useState<string[]>([]);
    
    const popupIntervalRef = useRef<number | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const playNotificationSound = useCallback((soundUrl?: string) => {
        if (!audioPlayerRef.current) {
            audioPlayerRef.current = new Audio();
        }
        audioPlayerRef.current.src = soundUrl || 'https://actions.google.com/sounds/v1/notifications/card_dismiss.ogg';
        audioPlayerRef.current.play().catch(e => console.error("Error playing sound:", e));
    }, []);

    const fetchRequests = useCallback(async () => {
        if (!isOnline || !isUserVerified) {
            setAllPendingRequests([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const data = await tripService.fetchAllPendingRequestsForDriver();
            const nonDeclined = data.filter(req => !timedOutOrDeclinedRequests.includes(req.id));
            setAllPendingRequests(nonDeclined);
        } catch (e) {
            setError(t.errorFetchingRequests);
            console.error("Error fetching pending requests:", getDebugMessage(e));
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, isUserVerified, timedOutOrDeclinedRequests, t.errorFetchingRequests]);

    useEffect(() => {
        let pollingInterval: number;
        if (isOnline && isUserVerified) {
            fetchRequests();
            pollingInterval = window.setInterval(fetchRequests, DRIVER_STATUS_POLLING_INTERVAL_MS);
        }
        return () => {
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [isOnline, isUserVerified, fetchRequests]);

    useEffect(() => {
        const subscription = supabase.channel('driver-ride-requests').on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'ride_requests' },
            () => fetchRequests()
        ).subscribe();
        
        return () => {
            supabase.removeChannel(subscription);
        };
    }, [fetchRequests, supabase]);

    useEffect(() => {
        if (!requestInPopup && allPendingRequests.length > 0) {
            const nextRequest = allPendingRequests[0];
            setRequestInPopup(nextRequest);
            setPopupTimer(DRIVER_REQUEST_POPUP_TIMEOUT_SECONDS);
            playNotificationSound();
        }
    }, [allPendingRequests, requestInPopup, playNotificationSound]);

    useEffect(() => {
        if (requestInPopup && popupTimer > 0) {
            popupIntervalRef.current = window.setInterval(() => setPopupTimer(prev => prev - 1), 1000);
        } else if (requestInPopup && popupTimer === 0) {
            if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
            setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup.id]);
            setRequestInPopup(null);
        }
        return () => {
            if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        };
    }, [requestInPopup, popupTimer]);

    const handleAccept = (requestToAccept: RideRequest) => {
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        setRequestInPopup(null);
        onAccept(requestToAccept);
    };

    const handleDecline = (requestToDecline: RideRequest) => {
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        setRequestInPopup(null);
        setTimedOutOrDeclinedRequests(prev => [...prev, requestToDecline.id]);
    };

    return {
        queueState: {
            allPendingRequests,
            isLoading,
            error,
            requestInPopup,
            popupTimer,
            timedOutOrDeclinedRequests,
        },
        queueActions: {
            handleAccept,
            handleDecline,
            fetchRequests,
        },
    };
};
