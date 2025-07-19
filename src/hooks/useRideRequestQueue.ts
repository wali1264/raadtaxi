
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { tripService, profileService } from '../services';
import { RideRequest } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { useAppContext } from '../contexts/AppContext';
import { DRIVER_REQUEST_POPUP_TIMEOUT_SECONDS, DRIVER_STATUS_POLLING_INTERVAL_MS } from '../config/constants';

// --- Sound Definitions ---

// This is the default notification sound from public/sw.js
const defaultSound = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSBvT18DAAAAAQABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5enx9fn+AgYKDhIWGh4iJiouMjY6PkJGSj5OTlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAQACAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfa2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAUAAAADAAAAAAAAAAUAAAAAAAAABgAAAAQAAAAAAAAABwAAAAUAAAAAAAAACAAAAAYAAAAAAAAACQAAAAcAAAAAAAAACgAAAAgAAAAAAAAACwAAAAkAAAAAAAAADAAAAAoAAAAAAAAADQAAAAsAAAAAAAAADgAAAAwAAAAAAAAADwAAAA0AAAAAAAAAEAAAAA4AAAAAAAAAEQAAABAAAAAAAAAAEgAAABEAAAAAAAAAEwAAABIAAAAAAAAAFAAAABMAAAAAAAAABQAAABEAAAANAAAAAwAAAAcAAAANAAAAEwAAABcAAAAZAAAAGgAAABYAAAAQAAAADgAAAAgAAAADAAAAAwAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAcAAAADAAAAAwAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAgAAAAFAAAAAQAAAAQAAAALAAAAEQAAABUAAAAWAAAAFgAAABUAAAARAAAACwAAAAQAAAABAAAABQAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAgAAAAEAAAAAQAAAAYAAAAJAAAADAAAAA3AAAANAAAADAAAAAkAAAAEAAAAAgAAAAUAAAAHAAAACQAAAAsAAAALAAAACQAAAAcAAAAEAAAAAQAAAAMAAAAFAAAABgAAAAcAAAAIAAAACAAAAAcAAAAFAAAAAwAAAAIAAAACAAAAAwAAAAMAAAADAAAAAwAAAAMAAAACAAAAAgAAAAIAAAACAAAAAgAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABQ==';

// As we only have one sound file, we'll map all options to it for now.
// This ensures the functionality works and can be expanded with more sounds later.
const soundMap: Record<string, string> = {
    'default': defaultSound,
    'chime': defaultSound,
    'alert': defaultSound,
};

export const useRideRequestQueue = (
    isOnline: boolean, 
    isUserVerified: boolean, 
    onAccept: (request: RideRequest) => void
) => {
    const { t, loggedInUserId } = useAppContext();
    const [allPendingRequests, setAllPendingRequests] = useState<RideRequest[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requestInPopup, setRequestInPopup] = useState<RideRequest | null>(null);
    const [popupTimer, setPopupTimer] = useState(DRIVER_REQUEST_POPUP_TIMEOUT_SECONDS);
    const [timedOutOrDeclinedRequests, setTimedOutOrDeclinedRequests] = useState<string[]>([]);
    
    const popupIntervalRef = useRef<number | null>(null);

    const playNotificationSound = useCallback(async () => {
        let soundKey = 'default';
        let volume = 0.8;
        
        if (loggedInUserId) {
            try {
                const profile = await profileService.fetchDriverProfile(loggedInUserId);
                if (profile.alertSoundPreference === 'none') {
                    return; 
                }
                if (profile.alertSoundPreference && soundMap[profile.alertSoundPreference]) {
                    soundKey = profile.alertSoundPreference;
                }
                volume = profile.alertSoundVolume ?? 0.8;

            } catch (e) {
                console.warn("Could not fetch driver sound preferences, using default.", e);
            }
        }
        
        const soundUrl = soundMap[soundKey];
        const audio = new Audio(soundUrl);
        audio.volume = volume;
        
        try {
            await audio.play();
        } catch (e) {
            console.error("Error playing notification sound:", e);
        }
    }, [loggedInUserId]);

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
    }, [fetchRequests]);

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
        } else if (requestInPopup && popupTimer <= 0) {
            if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
            setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup.id]);
            setRequestInPopup(null);
        }
        return () => {
            if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        };
    }, [requestInPopup, popupTimer]);

    const handleAccept = async (requestToAccept: RideRequest) => {
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        setRequestInPopup(null);
        setTimedOutOrDeclinedRequests(prev => prev.filter(id => id !== requestToAccept.id));
        setAllPendingRequests(prev => prev.filter(r => r.id !== requestToAccept.id));
        
        try {
            const acceptedRide = await tripService.updateRide(requestToAccept.id, {
                status: 'accepted',
                driver_id: loggedInUserId,
                accepted_at: new Date().toISOString()
            });

            if (acceptedRide) {
                onAccept(acceptedRide);
            } else {
                // This handles the race condition where another driver accepted the ride first.
                console.warn(`Failed to accept ride ${requestToAccept.id}, it was no longer available.`);
                alert(t.acceptRequestErrorNoLongerAvailable);
                fetchRequests(); // Refresh the queue
            }
        } catch(e) {
            console.error("Failed to accept ride", getDebugMessage(e), e);
            alert(t.errorAcceptingRequest);
            fetchRequests(); // Refetch to get latest state
        }
    };

    const handleDecline = (requestToDecline: RideRequest) => {
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        setRequestInPopup(null);
        setTimedOutOrDeclinedRequests(prev => [...prev, requestToDecline.id]);
        setAllPendingRequests(prev => prev.filter(r => r.id !== requestToDecline.id));
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
        },
    };
};