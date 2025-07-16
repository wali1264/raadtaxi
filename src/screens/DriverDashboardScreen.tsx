import React, { useState, useEffect, useRef, CSSProperties, useCallback, useContext } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { supabase } from '../services/supabase';
import { RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
import { RideRequest, AppService, PassengerDetails, DriverTripPhase, DriverProfileData, UserRole, ChatMessage } from '../types'; 
import { NewRideRequestPopup } from '../components/NewRideRequestPopup';
import { DrawerPanel } from '../components/DrawerPanel';
import { DriverProfileModal } from '../components/DriverProfileModal';
import { CurrentTripDetailsPanel } from '../components/CurrentTripDetailsPanel'; 
import { CancellationModal } from '../components/CancellationModal';
import { AddPlaceModal } from '../components/AddPlaceModal';
import { ChatModal } from '../components/ChatModal';
import { ListIcon, CarIcon, GpsIcon, LocationMarkerIcon, DestinationMarkerIcon, ProfileIcon, DriverCarIcon, HourglassIcon, AddLocationIcon, UserPlaceMarkerIcon } from '../components/icons';
import { AppContext, useAppContext } from '../contexts/AppContext';
import { profileService, tripService, notificationService } from '../services';
import { getDebugMessage, getDistanceFromLatLonInKm, getCurrentLocation } from '../utils/helpers';
import { useUserDefinedPlaces } from '../hooks/useUserDefinedPlaces';


interface DriverDashboardScreenProps {
  onLogout: () => void;
}

const PROXIMITY_THRESHOLD_KM = 0.1; // 100 meters
const POPUP_TIMEOUT_SECONDS = 30; 
const SILENT_AUDIO_DATA_URI = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

const notificationSoundBase64 = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSBvT18DAAAAAQABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5enx9fn+AgYKDhIWGh4iJiouMjY6PkJGSj5OTlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAQACAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfa2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAUAAAADAAAAAAAAAAUAAAAAAAAABgAAAAQAAAAAAAAABwAAAAUAAAAAAAAACAAAAAYAAAAAAAAACQAAAAcAAAAAAAAACgAAAAgAAAAAAAAACwAAAAkAAAAAAAAADAAAAAoAAAAAAAAADQAAAAsAAAAAAAAADgAAAAwAAAAAAAAADwAAAA0AAAAAAAAAEAAAAA4AAAAAAAAAEQAAABAAAAAAAAAAEgAAABEAAAAAAAAAEwAAABIAAAAAAAAAFAAAABMAAAAAAAAABQAAABEAAAANAAAAAwAAAAcAAAANAAAAEwAAABcAAAAZAAAAGgAAABYAAAAQAAAADgAAAAgAAAADAAAAAwAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAcAAAADAAAAAwAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAgAAAAFAAAAAQAAAAQAAAALAAAAEQAAABUAAAAWAAAAFgAAABUAAAARAAAACwAAAAQAAAABAAAABQAAAAgAAAANAAAAEQAAABQAAAAVAAAAFQAAABQAAAARAAAADQAAAAgAAAAEAAAAAQAAAAYAAAAJAAAADAAAAA0AAAANAAAADAAAAAkAAAAEAAAAAgAAAAUAAAAHAAAACQAAAAsAAAALAAAACQAAAAcAAAAEAAAAAQAAAAMAAAAFAAAABgAAAAcAAAAIAAAACAAAAAcAAAAFAAAAAwAAAAIAAAACAAAAAwAAAAMAAAADAAAAAwAAAAMAAAACAAAAAgAAAAIAAAACAAAAAgAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABQ==';

const soundMap: Record<string, string> = {
    'default': notificationSoundBase64,
    'chime': notificationSoundBase64,
    'alert': notificationSoundBase64,
    // Add legacy URLs here to map them to the reliable base64 sound for backward compatibility
    'https://actions.google.com/sounds/v1/notifications/card_dismiss.ogg': notificationSoundBase64,
    'https://actions.google.com/sounds/v1/notifications/notification_chime.ogg': notificationSoundBase64,
    'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg': notificationSoundBase64
};


// --- Local Icon Components for New Header ---
const PowerIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.75rem', height: '1.75rem', ...style }} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
        <line x1="12" y1="2" x2="12" y2="12"></line>
    </svg>
);

const LogoutIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
);
// --- End Local Icon Components ---

const getScaledMarkerBaseDimension = (zoom: number): number => {
    if (zoom >= 17) return 28; // Smallest at highest zoom
    if (zoom >= 15) return 36;
    if (zoom >= 13) return 44;
    return 52; // Largest at lowest zoom
};

export const DriverDashboardScreen = ({ onLogout }: DriverDashboardScreenProps): JSX.Element => {
  const { 
    currentLang, 
    loggedInUserId, 
    isUserVerified,
    allAppServices, 
    t,
    showToast,
  } = useAppContext();

  const isRTL = currentLang !== 'en';
  const [isOnline, setIsOnline] = useState(false);
  const [isTogglePressed, setIsTogglePressed] = useState(false);
  // dailyEarnings state is kept for potential future logic, though UI element was removed.
  const [driverProfile, setDriverProfile] = useState<Partial<DriverProfileData>>({});
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);


  const [allPendingRequests, setAllPendingRequests] = useState<RideRequest[]>([]);
  const [requestInPopup, setRequestInPopup] = useState<RideRequest | null>(null);
  const [popupTimer, setPopupTimer] = useState(POPUP_TIMEOUT_SECONDS);
  const popupIntervalRef = useRef<number | null>(null);
  const [timedOutOrDeclinedRequests, setTimedOutOrDeclinedRequests] = useState<RideRequest[]>([]);
  
  const [currentTrip, setCurrentTrip] = useState<RideRequest | null>(null);
  const [currentPassengerDetails, setCurrentPassengerDetails] = useState<PassengerDetails | null>(null);
  const [isLoadingPassengerDetails, setIsLoadingPassengerDetails] = useState<boolean>(false);
  const [passengerDetailsError, setPassengerDetailsError] = useState<string | null>(null);
  const [currentTripPhase, setCurrentTripPhase] = useState<DriverTripPhase>(DriverTripPhase.NONE);
  
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const tripOriginMarkerRef = useRef<L.Marker | null>(null);
  const tripDestinationMarkerRef = useRef<L.Marker | null>(null);
  const [isNavigating, setIsNavigating] = useState(false); // For OSRM loading
  const [fareSummary, setFareSummary] = useState<{ amount: number; passengerName: string } | null>(null);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);


  const [isLoadingAllPending, setIsLoadingAllPending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  const [isAcceptButtonHovered, setIsAcceptButtonHovered] = useState<{[key: string]: boolean}>({});

  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);
  
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const chatToastChannelRef = useRef<RealtimeChannel | null>(null);

  const [showIncomingDrawer, setShowIncomingDrawer] = useState(false);
  const [showCurrentTripDrawer, setShowCurrentTripDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); 
  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [isAddingPlace, setIsAddingPlace] = useState(false);

  const actualDriverGpsMarker = useRef<L.Marker | null>(null); 

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const userPlacesLayerRef = useRef<L.LayerGroup | null>(null);
  const userPlaceMarkersRef = useRef<L.Marker[]>([]);

  const { userDefinedPlaces, refetch: refetchUserPlaces } = useUserDefinedPlaces();

  const playNotificationSound = useCallback(() => {
    if (audioPlayerRef.current) {
        const preference = driverProfile.alertSoundPreference;
        const soundUrl = (preference && soundMap[preference]) ? soundMap[preference] : soundMap['default'];

        audioPlayerRef.current.src = soundUrl;
        
        const volume = (driverProfile.alertSoundVolume !== undefined && driverProfile.alertSoundVolume !== null)
            ? driverProfile.alertSoundVolume
            : 0.8;
        audioPlayerRef.current.volume = volume;

        audioPlayerRef.current.play().catch(e => {
            console.error(`Error playing sound: ${(e as Error).message}. This is often due to browser autoplay restrictions that require a user interaction.`);
        });
    }
  }, [driverProfile.alertSoundPreference, driverProfile.alertSoundVolume]);
  
    useEffect(() => {
        const rideId = currentTrip?.id;
        if (rideId && !isChatModalOpen && loggedInUserId) {
            if (chatToastChannelRef.current) {
                supabase.removeChannel(chatToastChannelRef.current);
            }
            chatToastChannelRef.current = supabase
                .channel(`driver_chat_toast_${rideId}`)
                .on<ChatMessage>(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `ride_request_id=eq.${rideId}`},
                    (payload) => {
                        const newMessage = payload.new as ChatMessage;
                        if (newMessage.receiver_id === loggedInUserId) {
                            showToast(t.newChatMessageToast.replace('{name}', currentPassengerDetails?.fullName || t.defaultPassengerName).replace('{message}', newMessage.message_text.substring(0, 30)), 'info');
                        }
                    }
                ).subscribe();
        } else {
             if (chatToastChannelRef.current) {
                supabase.removeChannel(chatToastChannelRef.current);
                chatToastChannelRef.current = null;
            }
        }
        return () => {
            if (chatToastChannelRef.current) {
                supabase.removeChannel(chatToastChannelRef.current);
                chatToastChannelRef.current = null;
            }
        };
    }, [currentTrip, isChatModalOpen, loggedInUserId, currentPassengerDetails, showToast, t]);


  const clearMapTripElements = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current && map.hasLayer(routePolylineRef.current)) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
    }
    if (tripOriginMarkerRef.current && map.hasLayer(tripOriginMarkerRef.current)) {
        map.removeLayer(tripOriginMarkerRef.current);
        tripOriginMarkerRef.current = null;
    }
    if (tripDestinationMarkerRef.current && map.hasLayer(tripDestinationMarkerRef.current)) {
        map.removeLayer(tripDestinationMarkerRef.current);
        tripDestinationMarkerRef.current = null;
    }
  }, []);

  const resetTripState = useCallback(() => {
    setCurrentTrip(null);
    setCurrentPassengerDetails(null);
    setCurrentTripPhase(DriverTripPhase.NONE);
    setIsLoadingPassengerDetails(false);
    setPassengerDetailsError(null);
    clearMapTripElements();
    setShowCurrentTripDrawer(false); 
    setIsNavigating(false);
    setIsCalculatingFare(false);
  }, [clearMapTripElements]);

  const fetchOsrmRoute = async (startCoords: L.LatLngTuple, endCoords: L.LatLngTuple): Promise<L.LatLngExpression[] | null> => {
    setIsNavigating(true);
    try {
        const fetchOptions: RequestInit = {
            method: 'GET',
            mode: 'cors',
            referrerPolicy: 'strict-origin-when-cross-origin'
        };
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`, fetchOptions);
        if (!response.ok) {
            console.error("OSRM API error:", response.status, response.statusText);
            throw new Error(`OSRM API error: ${response.status}`);
        }
        const data = await response.json();
        if (data.routes && data.routes.length > 0 && data.routes[0].geometry && data.routes[0].geometry.coordinates) {
            return data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as L.LatLngExpression);
        } else {
            console.error("No route found or geometry missing in OSRM response.");
            return null;
        }
    } catch (error) {
        console.error("Error fetching OSRM route:", error);
        return null;
    } finally {
        setIsNavigating(false);
    }
  };
  
  const drawRouteOnMap = useCallback((coordinates: L.LatLngExpression[], color: string, fitBounds: boolean = true) => {
    const map = mapInstanceRef.current;
    if (!map || coordinates.length === 0) return;

    if (routePolylineRef.current && map.hasLayer(routePolylineRef.current)) {
        map.removeLayer(routePolylineRef.current);
    }
    routePolylineRef.current = L.polyline(coordinates, { color: color, weight: 5, opacity: 0.75 }).addTo(map);
    if (fitBounds) {
        map.fitBounds(routePolylineRef.current.getBounds(), { padding: [50, 50], maxZoom: 17 });
    }
  }, []);


  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        const initialView: L.LatLngExpression = [32.3745, 62.1164]; 
        const newMap = L.map(mapContainerRef.current, {
            center: initialView, zoom: 13, zoomControl: false, attributionControl: false,
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
        }).addTo(newMap);
        mapInstanceRef.current = newMap;
        if (!userPlacesLayerRef.current) {
            userPlacesLayerRef.current = L.layerGroup().addTo(newMap);
        }
    }
    if (loggedInUserId && !driverProfile.userId) {
        profileService.fetchDriverProfile(loggedInUserId)
            .then(data => setDriverProfile(data))
            .catch(err => console.error("Error fetching driver profile on mount:", err));
    }
    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
        resetTripState(); 
    };
  }, [loggedInUserId, resetTripState]); 

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const handleZoomEnd = () => {
            const zoom = map.getZoom();
            userPlaceMarkersRef.current.forEach(marker => {
                if (zoom >= 15) {
                    marker.openTooltip();
                } else {
                    marker.closeTooltip();
                }
            });
        };
        map.on('zoomend', handleZoomEnd);
        handleZoomEnd();

        return () => {
            map.off('zoomend', handleZoomEnd);
        };
    }, [mapInstanceRef.current]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        const layer = userPlacesLayerRef.current;
        if (!map || !layer) return;

        layer.clearLayers();
        userPlaceMarkersRef.current = [];
        
        userDefinedPlaces.forEach(place => {
            const iconHTML = ReactDOMServer.renderToString(<UserPlaceMarkerIcon />);
            const userPlaceIcon = L.divIcon({
                html: iconHTML,
                className: 'user-defined-place-icon',
                iconSize: [24, 38],
                iconAnchor: [12, 38],
            });

            const marker = L.marker([place.location.lat, place.location.lng], { icon: userPlaceIcon })
                .addTo(layer)
                .bindTooltip(place.name, {
                    permanent: true,
                    direction: 'right',
                    offset: [10, -25], // Adjust to align vertically with the marker's center
                    className: 'user-place-label'
                });

            userPlaceMarkersRef.current.push(marker);
        });

        const currentZoom = map.getZoom();
        userPlaceMarkersRef.current.forEach(marker => {
            if (currentZoom < 15) {
                marker.closeTooltip();
            }
        });
    }, [userDefinedPlaces, mapInstanceRef.current]);


  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isOnline || !loggedInUserId) {
        if (actualDriverGpsMarker.current && map?.hasLayer(actualDriverGpsMarker.current)) {
            map.removeLayer(actualDriverGpsMarker.current);
            actualDriverGpsMarker.current = null;
        }
        return;
    }
    const initialLocationListener = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const driverLatLng: L.LatLngExpression = [latitude, longitude];
        if (actualDriverGpsMarker.current) {
            actualDriverGpsMarker.current.setLatLng(driverLatLng);
        } else {
            const driverIconHTML = ReactDOMServer.renderToString(<DriverCarIcon />);
            const driverLeafletIcon = L.divIcon({ html: driverIconHTML, className: 'actual-driver-gps-marker', iconSize: [40, 40], iconAnchor: [20, 20] });
            actualDriverGpsMarker.current = L.marker(driverLatLng, { icon: driverLeafletIcon, zIndexOffset: 1000 }).addTo(map);
        }
        if (currentTripPhase === DriverTripPhase.NONE) { 
            map.setView(driverLatLng, map.getZoom() < 15 ? 15: map.getZoom() );
        }
    };
    
    getCurrentLocation()
        .then(initialLocationListener)
        .catch((err) => console.warn("Error getting initial GPS for marker:", getDebugMessage(err), err));
        
  }, [isOnline, loggedInUserId, currentTripPhase]);

  useEffect(() => {
    if (isOnline && loggedInUserId && navigator.geolocation) {
      locationWatchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, heading } = position.coords;
          setDriverLocation({ lat: latitude, lng: longitude });
          try {
            await supabase.from('driver_locations').upsert({
                driver_id: loggedInUserId,
                latitude: latitude,
                longitude: longitude,
                heading: heading,
                timestamp: new Date().toISOString(),
            }, { onConflict: 'driver_id' });

            if (actualDriverGpsMarker.current) {
                actualDriverGpsMarker.current.setLatLng([latitude, longitude]);
            }
          } catch (e) { console.error('[DriverDashboard] Exception during driver location processing:', getDebugMessage(e), e); }
        },
        (error) => {
          console.error('[DriverDashboard] Error watching position:', getDebugMessage(error), error);
          if (error.code === error.PERMISSION_DENIED) { setIsOnline(false); alert(t.geolocationPermissionDenied); }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 } 
      );
    } else {
      setDriverLocation(null);
      if (locationWatchIdRef.current !== null) { navigator.geolocation.clearWatch(locationWatchIdRef.current); locationWatchIdRef.current = null; }
    }
    return () => { if (locationWatchIdRef.current !== null) navigator.geolocation.clearWatch(locationWatchIdRef.current); };
  }, [isOnline, loggedInUserId, t.geolocationPermissionDenied, supabase, currentTrip, currentTripPhase]);


  const fetchAllPendingRequests = useCallback(async () => {
    if (currentTrip) { setAllPendingRequests([]); setIsLoadingAllPending(false); return; }
    if (!isOnline || !isUserVerified) { setAllPendingRequests([]); setIsLoadingAllPending(false); return; }
    setIsLoadingAllPending(true); setFetchError(null);
    try {
      const { data, error } = await supabase.from('ride_requests').select().eq('status', 'pending').is('driver_id', null); 
      if (error) { console.error('[DriverDashboard] Error fetching all pending requests:', getDebugMessage(error), error); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
      else { 
          const nonDeclinedRequests = (data as unknown as RideRequest[]).filter(
              req => !timedOutOrDeclinedRequests.some(declined => declined.id === req.id)
          );
          setAllPendingRequests(nonDeclinedRequests);
      }
    } catch (e) { console.error('[DriverDashboard] Exception during fetchAllPendingRequests:', getDebugMessage(e), e); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
    finally { setIsLoadingAllPending(false); }
  },[t.errorFetchingRequests, isOnline, isUserVerified, currentTrip, timedOutOrDeclinedRequests]);

  useEffect(() => {
    if (isOnline && isUserVerified && !requestInPopup && !currentTrip && allPendingRequests.length > 0) {
      const nextRequest = allPendingRequests.find(req => !timedOutOrDeclinedRequests.some(declinedReq => declinedReq.id === req.id));
      if (nextRequest) { 
        setRequestInPopup(nextRequest); 
        setPopupTimer(POPUP_TIMEOUT_SECONDS); 
        playNotificationSound();
      }
    }
  }, [allPendingRequests, requestInPopup, timedOutOrDeclinedRequests, currentTrip, isOnline, isUserVerified, playNotificationSound]);

  useEffect(() => {
    if (requestInPopup && popupTimer > 0) { popupIntervalRef.current = window.setInterval(() => setPopupTimer(prev => prev - 1), 1000); }
    else if (requestInPopup && popupTimer === 0) { 
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        popupIntervalRef.current = null;
        setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup]); 
        setAllPendingRequests(prev => prev.filter(r => r.id !== requestInPopup.id));
        setRequestInPopup(null);
    }
    return () => { if (popupIntervalRef.current) clearInterval(popupIntervalRef.current); };
  }, [requestInPopup, popupTimer]);

  useEffect(() => {
    let requestChannel: RealtimeChannel | null = null; let pollingIntervalId: number | undefined = undefined;
    if (isOnline && isUserVerified) {
        if (!currentTrip) {
            // Only fetch requests if there is no active trip
            fetchAllPendingRequests();
            pollingIntervalId = window.setInterval(fetchAllPendingRequests, 7000);
        }

        requestChannel = supabase.channel('driver_dashboard_ride_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, (payload) => {
                if (currentTrip) {
                    if (payload.new && 'id' in payload.new && (payload.new as RideRequest).id === currentTrip.id) {
                        const updatedTrip = payload.new as RideRequest;
                        if (updatedTrip.status === 'cancelled_by_passenger') {
                            alert(t.tripCancelledByPassenger);
                            resetTripState();
                        } else if (!['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'].includes(updatedTrip.status)) {
                            resetTripState();
                            alert(isRTL ? "سفر فعلی شما تغییر وضعیت داده یا لغو شده است." : "Your current trip status has changed or been cancelled.");
                        } else {
                            setCurrentTrip(updatedTrip);
                        }
                    }
                } else {
                    fetchAllPendingRequests();
                }
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    return;
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    console.warn(`[DriverDashboard Realtime Warning] Subscription to ride requests failed. Falling back to polling. Status: ${status}`, getDebugMessage(err));
                }
            });

    } else {
        setAllPendingRequests([]);
        setRequestInPopup(null);
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        if (!currentTrip) resetTripState();
    }
    return () => {
        if (pollingIntervalId) clearInterval(pollingIntervalId);
        if (requestChannel) supabase.removeChannel(requestChannel);
    };
  }, [isOnline, isUserVerified, fetchAllPendingRequests, currentTrip, isRTL, resetTripState, supabase, t.tripCancelledByPassenger]);

  const toggleOnlineStatus = async () => {
    if (!loggedInUserId) {
      alert("User ID not found. Cannot change status.");
      return;
    }
    if (!isUserVerified) {
      alert(t.accountNotVerifiedWarning);
      return;
    }

    const newStatus = !isOnline;

    if (!newStatus) {
      setIsOnline(false);
      try {
        await profileService.updateDriverOnlineStatus(loggedInUserId, false);
      } catch (e: any) {
        setIsOnline(true);
        alert(t.errorUpdatingDriverStatus + `: ${getDebugMessage(e)}`);
      }
      return;
    }

    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        const unsupportedMessage = isRTL 
          ? 'مرورگر شما از اعلان‌ها پشتیبانی نمی‌کند. برای دریافت درخواست‌ها، لطفاً از مرورگر دیگری مانند کروم یا فایرفاکس استفاده کنید.' 
          : 'Your browser does not support push notifications. To receive requests, please use another browser like Chrome or Firefox.';
        throw new Error(unsupportedMessage);
      }

      if (Notification.permission === 'denied') {
        throw new Error(t.notificationPermissionDenied);
      }
      
      await notificationService.subscribeUser(loggedInUserId);
      console.log('Successfully subscribed for push notifications.');

    } catch (subError: any) {
      alert(getDebugMessage(subError)); 
      return;
    }
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = SILENT_AUDIO_DATA_URI;
      audioPlayerRef.current.play().catch(e => {
        console.warn("Audio context unlock attempt info:", (e as Error).message);
      });
    }

    setIsOnline(true);
    try {
      await profileService.updateDriverOnlineStatus(loggedInUserId, true);
      
      if (!driverProfile.userId || driverProfile.userId !== loggedInUserId) {
        profileService.fetchDriverProfile(loggedInUserId)
          .then(data => setDriverProfile(data))
          .catch(err => console.error("Error fetching driver profile on going online:", err));
      }
    } catch (e: any) {
      setIsOnline(false);
      alert(t.errorUpdatingDriverStatus + `: ${getDebugMessage(e)}`);
    }
  };

  const drawTripMarkers = (originCoords: L.LatLngTuple, destinationCoords: L.LatLngTuple | null) => {
    const map = mapInstanceRef.current;
    if(!map) return;
    
    const zoom = map.getZoom();
    const baseDim = getScaledMarkerBaseDimension(zoom);
    const iconHeight = baseDim * (42 / 32);
    const iconSize: [number, number] = [baseDim, iconHeight];
    const iconAnchor: L.PointExpression = [baseDim / 2, iconHeight];

    if (tripOriginMarkerRef.current && map.hasLayer(tripOriginMarkerRef.current)) map.removeLayer(tripOriginMarkerRef.current);
    const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FF8C00" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))', width: `${baseDim}px`, height: `${iconHeight}px` }}/>);
    const originLeafletIcon = L.divIcon({ html: originIconHTML, className: 'trip-origin-marker', iconSize: iconSize, iconAnchor: iconAnchor });
    tripOriginMarkerRef.current = L.marker(originCoords, { icon: originLeafletIcon }).addTo(map);

    if (destinationCoords) {
        if (tripDestinationMarkerRef.current && map.hasLayer(tripDestinationMarkerRef.current)) map.removeLayer(tripDestinationMarkerRef.current);
        const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#EA4335" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))', width: `${baseDim}px`, height: `${iconHeight}px` }}/>);
        const destLeafletIcon = L.divIcon({ html: destIconHTML, className: 'trip-destination-marker', iconSize: iconSize, iconAnchor: iconAnchor });
        tripDestinationMarkerRef.current = L.marker(destinationCoords, { icon: destLeafletIcon }).addTo(map);
    }
  };


  const handleAcceptRequest = async (requestToAccept: RideRequest) => {
    if (!loggedInUserId || !actualDriverGpsMarker.current) {
        alert(t.geolocationUnavailable); 
        return;
    }
    
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    popupIntervalRef.current = null;
    setRequestInPopup(null); 

    setAcceptingRequestId(requestToAccept.id); 
    
    try {
        const acceptedRide = await tripService.updateRide(requestToAccept.id, {
            status: 'accepted',
            driver_id: loggedInUserId,
            accepted_at: new Date().toISOString()
        });
        
        setCurrentTrip(acceptedRide);
        setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_PICKUP);
        setAllPendingRequests(prev => prev.filter(r => r.id !== acceptedRide.id)); 
        setTimedOutOrDeclinedRequests(prev => prev.filter(r => r.id !== acceptedRide.id));
        setShowCurrentTripDrawer(true);
        setShowIncomingDrawer(false);

        if (acceptedRide.is_third_party) {
            setCurrentPassengerDetails({
                id: acceptedRide.passenger_id,
                fullName: acceptedRide.passenger_name,
                phoneNumber: acceptedRide.passenger_phone,
                profilePicUrl: null
            });
            setIsLoadingPassengerDetails(false);
            setPassengerDetailsError(null);
        } else {
            setIsLoadingPassengerDetails(true);
            setPassengerDetailsError(null);
            profileService.fetchUserDetailsById(acceptedRide.passenger_id)
                .then(setCurrentPassengerDetails)
                .catch(e => {
                    console.error("Error fetching passenger details:", getDebugMessage(e));
                    setPassengerDetailsError(t.errorFetchingPassengerDetails);
                })
                .finally(() => setIsLoadingPassengerDetails(false));
        }

        const driverLatLng = actualDriverGpsMarker.current.getLatLng();
        const driverPos: L.LatLngTuple = [driverLatLng.lat, driverLatLng.lng];
        const pickupPos: L.LatLngTuple = [acceptedRide.origin_lat, acceptedRide.origin_lng];
        const routeCoords = await fetchOsrmRoute(driverPos, pickupPos);
        if (routeCoords) {
            drawRouteOnMap(routeCoords, '#007bff');
            drawTripMarkers(pickupPos, null); 
        } else {
            drawRouteOnMap([driverPos, pickupPos], '#007bff', false);
            drawTripMarkers(pickupPos, null);
        }

    } catch (error: any) {
        console.error('[DriverDashboard] Error accepting request:', getDebugMessage(error), error);
        if (error.message && error.message.includes("PGRST116")) { 
             alert(t.acceptRequestErrorNoLongerAvailable);
        } else {
            alert(t.errorAcceptingRequest + (error instanceof Error ? `: ${error.message}`: ''));
        }
        setAllPendingRequests(prev => prev.filter(r => r.id !== requestToAccept.id));
        setTimedOutOrDeclinedRequests(prev => prev.filter(r => r.id !== requestToAccept.id));
    } finally {
        setAcceptingRequestId(null);
    }
  };
  
  const handleDeclineRequestFromPopup = () => {
    if (!requestInPopup) return;
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    popupIntervalRef.current = null;
    
    setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup]); 
    setAllPendingRequests(prev => prev.filter(r => r.id !== requestInPopup.id));
    setRequestInPopup(null); 
  };

  const handleNavigateToPickup = async () => {
    if (!currentTrip || !actualDriverGpsMarker.current) {
        alert(isRTL ? "موقعیت فعلی یا اطلاعات سفر در دسترس نیست." : "Current location or trip info unavailable.");
        return;
    }
    const driverLatLng = actualDriverGpsMarker.current.getLatLng();
    const driverPos: L.LatLngTuple = [driverLatLng.lat, driverLatLng.lng];
    const pickupPos: L.LatLngTuple = [currentTrip.origin_lat, currentTrip.origin_lng];
    const routeCoords = await fetchOsrmRoute(driverPos, pickupPos);
    if (routeCoords) {
        drawRouteOnMap(routeCoords, '#007bff');
        drawTripMarkers(pickupPos, null);
    } else {
        drawRouteOnMap([driverPos, pickupPos], '#007bff', false);
        drawTripMarkers(pickupPos, null);
        alert(isRTL ? "خطا در مسیریابی. مسیر مستقیم نمایش داده شد." : "Routing error. Straight line shown.");
    }
    
    try {
        await tripService.updateRide(currentTrip.id, {
            driver_arrived_at_origin_at: new Date().toISOString()
        });
        setCurrentTripPhase(DriverTripPhase.AT_PICKUP);
    } catch (error) {
        console.error("Error updating trip status on navigation:", getDebugMessage(error));
        alert(isRTL ? "خطا در به‌روزرسانی وضعیت سفر." : "Error updating trip status.");
    }

    setShowCurrentTripDrawer(false);
  };

  const handleStartTrip = async () => {
    if (!currentTrip || !driverLocation) {
        alert(isRTL ? "موقعیت فعلی شما برای شروع سفر در دسترس نیست. لطفاً از فعال بودن GPS اطمینان حاصل کنید." : "Your current location is not available to start the trip. Please ensure GPS is active.");
        return;
    }
    setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_DESTINATION);

    try {
        await tripService.updateRide(currentTrip.id, { status: 'trip_started', trip_started_at: new Date().toISOString() });
        const startPos: L.LatLngTuple = [driverLocation.lat, driverLocation.lng];
        const destPos: L.LatLngTuple = [currentTrip.destination_lat, currentTrip.destination_lng];
        const routeCoords = await fetchOsrmRoute(startPos, destPos);
        if (routeCoords) {
            drawRouteOnMap(routeCoords, '#28a745');
            drawTripMarkers([currentTrip.origin_lat, currentTrip.origin_lng], destPos);
        } else {
            drawRouteOnMap([startPos, destPos], '#28a745', false); 
            drawTripMarkers([currentTrip.origin_lat, currentTrip.origin_lng], destPos);
            alert(isRTL ? "خطا در مسیریابی به مقصد. مسیر مستقیم نمایش داده شد." : "Routing error to destination. Straight line shown.");
        }
    } catch (error: any) {
        console.error("Error during trip start process:", getDebugMessage(error));
        alert(isRTL ? "خطا در شروع سفر. لطفاً دوباره تلاش کنید." : "Error starting the trip. Please try again.");
        setCurrentTripPhase(DriverTripPhase.AT_PICKUP);
    }
  };

  const handleEndTrip = async () => {
    if (!currentTrip) {
        alert(isRTL ? "نمی توان سفر را به پایان رساند: اطلاعات سفر در دسترس نیست." : "Cannot end trip: missing trip info.");
        return;
    }
    
    setIsCalculatingFare(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const finalFare = currentTrip.estimated_fare;
    
    try {
        await tripService.updateRide(currentTrip.id, { 
            status: 'trip_completed',
            actual_fare: finalFare,
        });
        
        setIsCalculatingFare(false);
        const passengerName = currentPassengerDetails?.fullName || t.defaultPassengerName;
        setFareSummary({ 
            amount: Math.round(finalFare ?? 0), 
            passengerName: passengerName 
        });

    } catch (error) {
        setIsCalculatingFare(false);
        console.error("Critical Error: Failed to update trip status to completed.", getDebugMessage(error));
        alert(isRTL ? "خطای حیاتی در پایان سفر رخ داد." : "A critical error occurred while ending the trip.");
        resetTripState();
    }
  };

  const handleDriverCancellationSubmit = async (reasonKey: string, customReason: string) => {
    if (!currentTrip || !loggedInUserId) {
        alert(t.errorCancellingTrip + " (Missing IDs)");
        return;
    }
    setIsSubmittingCancellation(true);
    try {
        await tripService.updateRide(currentTrip.id, { status: 'cancelled_by_driver' });
        await tripService.submitCancellationReport({
            rideId: currentTrip.id,
            userId: loggedInUserId,
            role: 'driver',
            reasonKey: reasonKey,
            customReason: customReason || null
        });
        resetTripState();
    } catch (error: any) {
        console.error("Error submitting driver cancellation:", getDebugMessage(error), error);
        alert(t.errorSubmittingCancellation + `\n\n${getDebugMessage(error)}`);
        resetTripState();
    } finally {
        setIsCancellationModalOpen(false);
        setIsSubmittingCancellation(false);
    }
  };

  const handleCancelTrip = () => {
    if (!currentTrip) return;
    setIsCancellationModalOpen(true);
  };

  const handleLocateDriver = async () => {
    const map = mapInstanceRef.current;
    if (!map) { 
        alert(t.mapNotLoaded); 
        return; 
    }
    try {
        const position = await getCurrentLocation();
        const userLatLng: L.LatLngExpression = [position.coords.latitude, position.coords.longitude];
        if (actualDriverGpsMarker.current) { 
            actualDriverGpsMarker.current.setLatLng(userLatLng); 
        } else {
            const gpsMarkerIconHTML = ReactDOMServer.renderToString(<DriverCarIcon />);
            const gpsLeafletIcon = L.divIcon({ html: gpsMarkerIconHTML, className: 'actual-driver-gps-marker', iconSize: [40,40], iconAnchor: [20,20] });
            actualDriverGpsMarker.current = L.marker(userLatLng, { icon: gpsLeafletIcon, zIndexOffset: 1000 }).addTo(map);
        }
        map.setView(userLatLng, 16);
    } catch (error: any) {
        console.error("Error getting GPS location:", getDebugMessage(error), error);
        let message = "";
        switch (error.code) {
            case 1: message = t.geolocationPermissionDenied; break;
            case 2: message = t.geolocationUnavailableHintVpnOrSignal; break;
            case 3: message = t.geolocationTimeout; break;
            default: message = t.geolocationNotSupported; break;
        }
        alert(message);
    }
  };

    const handleAddPlaceSubmit = async (placeName: string) => {
        if (!driverLocation || !loggedInUserId) {
            alert(isRTL ? "موقعیت فعلی شما برای ثبت مکان در دسترس نیست." : "Your current location is not available to save a place.");
            return;
        }
        setIsAddingPlace(true);
        try {
            await profileService.addUserDefinedPlace(placeName, driverLocation.lat, driverLocation.lng, loggedInUserId);
            refetchUserPlaces();
            setIsAddPlaceModalOpen(false);
        } catch (error) {
            console.error("Error adding user-defined place:", getDebugMessage(error));
        } finally {
            setIsAddingPlace(false);
        }
    };
  
  useEffect(() => {
    const recoverTrip = async () => {
      if (!loggedInUserId || currentTrip) { return; }
      try {
        const activeTrip = await tripService.fetchActiveDriverTrip(loggedInUserId);
        if (activeTrip) {
          setCurrentTrip(activeTrip);
          
          let recoveredPhase = DriverTripPhase.NONE;
          switch(activeTrip.status) {
              case 'accepted':
              case 'driver_en_route_to_origin':
                if (activeTrip.driver_arrived_at_origin_at) { recoveredPhase = DriverTripPhase.AT_PICKUP; } 
                else { recoveredPhase = DriverTripPhase.EN_ROUTE_TO_PICKUP; }
                break;
              case 'trip_started':
                recoveredPhase = DriverTripPhase.EN_ROUTE_TO_DESTINATION; break;
              case 'driver_at_destination':
                recoveredPhase = DriverTripPhase.AT_DESTINATION; break;
          }
          
          setCurrentTripPhase(recoveredPhase);
          setShowCurrentTripDrawer(true);
          
          if (activeTrip.is_third_party) {
            setCurrentPassengerDetails({ id: activeTrip.passenger_id, fullName: activeTrip.passenger_name, phoneNumber: activeTrip.passenger_phone, profilePicUrl: null });
          } else {
            setIsLoadingPassengerDetails(true);
            profileService.fetchUserDetailsById(activeTrip.passenger_id)
                .then(setCurrentPassengerDetails)
                .catch(e => { setPassengerDetailsError(t.errorFetchingPassengerDetails); })
                .finally(() => setIsLoadingPassengerDetails(false));
          }

          clearMapTripElements();
          const pickupPos: L.LatLngTuple = [activeTrip.origin_lat, activeTrip.origin_lng];
          const destPos: L.LatLngTuple = [activeTrip.destination_lat, activeTrip.destination_lng];
          
          if (recoveredPhase === DriverTripPhase.EN_ROUTE_TO_PICKUP || recoveredPhase === DriverTripPhase.AT_PICKUP) {
            drawTripMarkers(pickupPos, null);
            if (actualDriverGpsMarker.current) {
                const driverPos = actualDriverGpsMarker.current.getLatLng();
                const routeCoords = await fetchOsrmRoute([driverPos.lat, driverPos.lng], pickupPos);
                if (routeCoords) drawRouteOnMap(routeCoords, '#007bff');
            }
          } else if (recoveredPhase === DriverTripPhase.EN_ROUTE_TO_DESTINATION || recoveredPhase === DriverTripPhase.AT_DESTINATION) {
            drawTripMarkers(pickupPos, destPos);
            if (actualDriverGpsMarker.current) {
                const driverPos = actualDriverGpsMarker.current.getLatLng();
                const routeCoords = await fetchOsrmRoute([driverPos.lat, driverPos.lng], destPos);
                if (routeCoords) drawRouteOnMap(routeCoords, '#28a745');
            }
          }
        }
      } catch (error) {
        console.error("[Trip Recovery] Error recovering driver trip:", getDebugMessage(error));
      }
    };
    if (loggedInUserId) { recoverTrip(); }
  }, [loggedInUserId, currentTrip, t, resetTripState, fetchOsrmRoute, drawRouteOnMap, drawTripMarkers, clearMapTripElements, supabase]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentTrip) {
        return;
    }

    const handleZoom = () => {
        const zoom = map.getZoom();
        const baseDim = getScaledMarkerBaseDimension(zoom);
        
        const iconHeight = baseDim * (42 / 32);
        const iconSize: [number, number] = [baseDim, iconHeight];
        
        const iconAnchor: L.PointExpression = [baseDim / 2, iconHeight];

        if (tripOriginMarkerRef.current) {
            const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FF8C00" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))', width: `${baseDim}px`, height: `${iconHeight}px` }}/>);
            tripOriginMarkerRef.current.setIcon(L.divIcon({
                html: originIconHTML,
                className: 'trip-origin-marker',
                iconSize: iconSize,
                iconAnchor: iconAnchor
            }));
        }

        if (tripDestinationMarkerRef.current) {
            const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#EA4335" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))', width: `${baseDim}px`, height: `${iconHeight}px` }}/>);
            tripDestinationMarkerRef.current.setIcon(L.divIcon({
                html: destIconHTML,
                className: 'trip-destination-marker',
                iconSize: iconSize,
                iconAnchor: iconAnchor
            }));
        }
    };

    map.on('zoomend', handleZoom);
    handleZoom();

    return () => {
        map.off('zoomend', handleZoom);
    };
  }, [currentTrip, mapInstanceRef.current]);

  const driverDashboardPageStyle: CSSProperties = { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', direction: isRTL ? 'rtl' : 'ltr', width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', };
  const mapBackgroundStyle: CSSProperties = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, };
  const contentOverlayStyle: CSSProperties = { position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem', boxSizing: 'border-box', maxWidth: '1400px', margin: '0 auto', backgroundColor: 'rgba(244, 246, 248, 0.0)', };
  
  const headerStyle: CSSProperties = { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '1rem', 
    pointerEvents: 'auto', 
    padding: '0.5rem', 
    boxSizing: 'border-box',
    width: '100%',
  };
  
  const statusToggleStyle = (isPressed: boolean): CSSProperties => ({ 
    width: '4rem', height: '4rem',
    backgroundColor: isOnline ? '#2ECC71' : '#95A5A6', 
    border: `2px solid ${isOnline ? '#27AE60' : '#7F8C8D'}`,
    borderRadius: '50%',
    cursor: !isUserVerified ? 'not-allowed' : 'pointer', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    color: 'white',
    boxShadow: isPressed 
      ? `inset 0 5px 15px rgba(0,0,0,0.4)` 
      : `0 8px 15px rgba(0,0,0,0.2), inset 0 -4px 5px ${isOnline ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'}`,
    transition: 'all 0.15s ease-out', 
    transform: isPressed ? 'scale(0.95)' : 'scale(1)',
    opacity: !isUserVerified ? 0.6 : 1,
  });

  const headerActionsStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'center'};
  const iconButtonStyle = (isDisabled: boolean): CSSProperties => ({
      width: '2.75rem', height: '2.75rem',
      backgroundColor: 'white',
      border: '1px solid #E2E8F0',
      borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      color: '#4A5568',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
      transition: 'all 0.2s ease-out',
      opacity: isDisabled ? 0.6 : 1,
      position: 'relative',
  });

  const badgeStyle: CSSProperties = { 
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    backgroundColor: '#E53E3E', 
    color: 'white', 
    fontSize: '0.75rem', 
    fontWeight: 'bold', 
    width: '1.25rem',
    height: '1.25rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid white',
  };

  const cardsAreaStyle: CSSProperties = { flexGrow: 1, overflowY: 'auto', pointerEvents: 'auto', paddingTop: '1rem', paddingBottom: '1rem', WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 30px), transparent 100%)', maskImage: 'linear-gradient(to bottom, black calc(100% - 30px), transparent 100%)', };
  const cardStyle: CSSProperties = { backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '1rem', };
  const requestItemStyle: CSSProperties = { padding: '0.8rem', border: '1px solid #edf2f7', borderRadius: '0.375rem', marginBottom: '0.75rem', backgroundColor: 'rgba(249, 250, 251, 0.95)', };
  const requestDetailRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem', };
  const requestLabelStyle: CSSProperties = { color: '#718096', fontWeight: 500 };
  const requestValueStyle: CSSProperties = { color: '#2d3748', fontWeight: 600, textAlign: isRTL ? 'left' : 'right', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const requestFareStyle: CSSProperties = { ...requestValueStyle, color: '#38a169', fontSize: '1rem' };
  const acceptButtonStyle: CSSProperties = { width: '100%', padding: '0.6rem 1rem', marginTop: '0.5rem', fontSize: '0.9rem', color: 'white', backgroundColor: '#3182ce', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background-color 0.2s', };
  const acceptButtonHoverStyle: CSSProperties = { backgroundColor: '#2b6cb0' };
  const acceptButtonDisabledStyle: CSSProperties = {backgroundColor: '#a0aec0', cursor: 'not-allowed'};
  const noDataTextStyle: CSSProperties = { textAlign: 'center', color: '#718096', padding: '1rem 0', fontSize: '0.9rem' };
  const errorTextStyle: CSSProperties = { textAlign: 'center', color: '#e53e3e', padding: '1rem 0', fontSize: '0.9rem', fontWeight: 500 };
  const loadingTextStyle: CSSProperties = { textAlign: 'center', color: '#4A5568', padding: '1rem 0', fontSize: '0.9rem' };
  const gpsFabStyle: CSSProperties = { position: 'absolute', bottom: '1.5rem', [isRTL ? 'left' : 'right']: '1.5rem', backgroundColor: 'white', borderRadius: '50%', width: '3.25rem', height: '3.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: 1050, border: 'none', transition: 'background-color 0.2s, transform 0.1s', pointerEvents: 'auto', };
  const navigationLoadingStyle: CSSProperties = {...loadingTextStyle, color: '#007bff'};

  const fareModalOverlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, direction: isRTL ? 'rtl' : 'ltr' };
  const fareModalContentStyle: CSSProperties = { backgroundColor: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', width: '90%', maxWidth: '400px', textAlign: 'center' };
  const fareModalTitleStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '1.5rem', lineHeight: 1.6 };
  const fareModalOkButtonStyle: CSSProperties = { width: '100%', padding: '0.875rem 1rem', fontSize: '1rem', fontWeight: 600, color: 'white', backgroundColor: '#28a745', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', transition: 'background-color 0.2s', };
  const fareCalculationModalStyle: CSSProperties = { ...fareModalContentStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' };
  const handleOpenChat = () => setIsChatModalOpen(true);

  return (
    <div style={driverDashboardPageStyle}>
      <audio ref={audioPlayerRef} style={{display: 'none'}} controls preload="auto" />
      <div ref={mapContainerRef} style={mapBackgroundStyle} />
      <div style={contentOverlayStyle}>
        <header style={headerStyle}>
          <div style={{perspective: '500px'}}>
            <button 
              style={statusToggleStyle(isTogglePressed)} 
              onClick={toggleOnlineStatus}
              onMouseDown={() => { if(isUserVerified) setIsTogglePressed(true); }}
              onMouseUp={() => setIsTogglePressed(false)}
              onMouseLeave={() => setIsTogglePressed(false)}
              onTouchStart={() => { if(isUserVerified) setIsTogglePressed(true); }}
              onTouchEnd={() => setIsTogglePressed(false)}
              disabled={!isUserVerified}
              aria-label={isOnline ? t.driverStatusOnline : t.driverStatusOffline}
            >
              <PowerIcon style={{ color: isOnline ? '#FFF' : '#E2E8F0' }}/>
            </button>
          </div>
          <div style={headerActionsStyle}>
             <button style={iconButtonStyle(!isOnline)} onClick={() => setIsAddPlaceModalOpen(true)} aria-label={t.addText} disabled={!isOnline}>
                <AddLocationIcon />
            </button>
            <button style={iconButtonStyle(!!currentTrip)} onClick={() => setShowIncomingDrawer(true)} aria-label={t.requestsButton} aria-haspopup="true" aria-expanded={showIncomingDrawer} disabled={!!currentTrip} > 
                <ListIcon /> 
                {allPendingRequests.length > 0 && <span style={badgeStyle}>{allPendingRequests.length}</span>} 
            </button>
            <button style={iconButtonStyle(!currentTrip)} onClick={() => setShowCurrentTripDrawer(true)} aria-label={t.activeTripButton} aria-haspopup="true" aria-expanded={showCurrentTripDrawer} disabled={!currentTrip} > 
                <CarIcon /> 
            </button>
            <button style={iconButtonStyle(false)} onClick={() => setShowProfileModal(true)} aria-label={t.profileButtonAriaLabel} > 
                <ProfileIcon /> 
            </button>
            <button style={iconButtonStyle(false)} onClick={onLogout} aria-label={t.logoutButton}> 
                <LogoutIcon />
            </button>
          </div>
        </header>
        
        {isNavigating && <p style={navigationLoadingStyle}>{t.calculatingPrice}</p>}
        <div style={cardsAreaStyle}>
            { !isUserVerified && (
              <div style={{...cardStyle, backgroundColor: 'rgba(255, 249, 230, 0.95)', border: '1px solid #FBBF24', textAlign: 'center', marginTop: '1rem'}}>
                  <p style={{color: '#B45309', fontWeight: 500}}>{t.accountNotVerifiedWarning}</p>
              </div>
            )}
            {!isOnline && !currentTrip && isUserVerified && (
            <div style={{...cardStyle, backgroundColor: 'rgba(230, 255, 250, 0.9)', border: '1px solid #38b2ac', textAlign: 'center', marginTop: '1rem'}}>
                <p style={{color: '#2c7a7b', fontWeight: 500}}>{t.goOnlinePrompt}</p>
            </div>
            )}
        </div>
      </div>
      <button style={gpsFabStyle} onClick={handleLocateDriver} aria-label={t.gpsButtonAriaLabel} > <GpsIcon style={{ color: '#007AFF', width: '1.75rem', height: '1.75rem' }} /> </button>
      {requestInPopup && isOnline && isUserVerified && !currentTrip && ( <NewRideRequestPopup currentLang={currentLang} request={requestInPopup} allAppServices={allAppServices} timer={popupTimer} onAccept={() => handleAcceptRequest(requestInPopup)} onDecline={handleDeclineRequestFromPopup} driverLocation={driverLocation} /> )}
      <DriverProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} currentLang={currentLang} loggedInUserId={loggedInUserId} />
      <AddPlaceModal isOpen={isAddPlaceModalOpen} onClose={() => setIsAddPlaceModalOpen(false)} onSubmit={handleAddPlaceSubmit} isSubmitting={isAddingPlace} currentLang={currentLang}/>
      <DrawerPanel currentLang={currentLang} isOpen={showIncomingDrawer} onClose={() => setShowIncomingDrawer(false)} title={t.incomingRequestsDrawerTitle} side={isRTL ? 'right' : 'left'} >
        {currentTrip ? (
            <p style={noDataTextStyle}>{t.cannotViewRequestsDuringTrip}</p>
        ) : (
          <>
            {isLoadingAllPending && <p style={loadingTextStyle}>{t.loadingRequests}</p>}
            {fetchError && !isLoadingAllPending && <p style={errorTextStyle}>{fetchError}</p>}
            
            {!isLoadingAllPending && !fetchError && timedOutOrDeclinedRequests.length === 0 && allPendingRequests.length === 0 && (
                <p style={noDataTextStyle}>{t.noIncomingRequests}</p>
            )}

            {!isLoadingAllPending && !fetchError && allPendingRequests.map((req) => (
                <div key={`pending-${req.id}`} style={requestItemStyle}>
                  <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestPassengerLabel}:</span> <span style={requestValueStyle}>{req.passenger_name || (isRTL ? 'نامشخص' : 'N/A')}</span> </div>
                  <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFromLabel}:</span> <span style={requestValueStyle} title={req.origin_address}>{req.origin_address}</span> </div>
                  <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestToLabel}:</span> <span style={requestValueStyle} title={req.destination_address}>{req.destination_address}</span> </div>
                  <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFareLabel}:</span> <span style={requestFareStyle}>{t.earningsAmountUnit.replace('{amount}', Math.round(req.estimated_fare ?? 0).toLocaleString(isRTL ? 'fa-IR' : 'en-US'))}</span> </div>
                    <button 
                      style={acceptingRequestId === req.id ? {...acceptButtonStyle, ...acceptButtonDisabledStyle} : (isAcceptButtonHovered[`drawer-${req.id}`] ? {...acceptButtonStyle, ...acceptButtonHoverStyle} : acceptButtonStyle) }
                      onClick={() => handleAcceptRequest(req)}
                      disabled={acceptingRequestId === req.id || !!currentTrip}
                      onMouseEnter={() => setIsAcceptButtonHovered(prev => ({...prev, [`drawer-${req.id}`]: true}))}
                      onMouseLeave={() => setIsAcceptButtonHovered(prev => ({...prev, [`drawer-${req.id}`]: false}))}
                    >
                      {acceptingRequestId === req.id ? t.servicesLoading : t.acceptRideButton}
                    </button>
                </div>
              ))}

            {timedOutOrDeclinedRequests.length > 0 && (
                <>
                    <h4 style={{...noDataTextStyle, marginTop: '1.5rem', fontSize: '0.9rem', borderTop: '1px solid #e0e0e0', paddingTop: '1rem'}}>{isRTL ? 'رد شده / بدون پاسخ' : 'Declined / Unanswered'}</h4>
                    {timedOutOrDeclinedRequests.map(req => (
                        <div key={`declined-${req.id}`} style={{...requestItemStyle, opacity: 0.8, backgroundColor: 'rgba(254, 226, 226, 0.5)'}}>
                            <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestPassengerLabel}:</span> <span style={requestValueStyle}>{req.passenger_name || (isRTL ? 'نامشخص' : 'N/A')}</span> </div>
                            <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFromLabel}:</span> <span style={requestValueStyle} title={req.origin_address}>{req.origin_address}</span> </div>
                            <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestToLabel}:</span> <span style={requestValueStyle} title={req.destination_address}>{req.destination_address}</span> </div>
                            <button 
                              style={acceptingRequestId === req.id ? {...acceptButtonStyle, ...acceptButtonDisabledStyle} : (isAcceptButtonHovered[`drawer-${req.id}`] ? {...acceptButtonStyle, ...acceptButtonHoverStyle} : acceptButtonStyle) }
                              onClick={() => handleAcceptRequest(req)}
                              disabled={acceptingRequestId === req.id || !!currentTrip}
                               onMouseEnter={() => setIsAcceptButtonHovered(prev => ({...prev, [`drawer-${req.id}`]: true}))}
                               onMouseLeave={() => setIsAcceptButtonHovered(prev => ({...prev, [`drawer-${req.id}`]: false}))}
                            >
                              {acceptingRequestId === req.id ? t.servicesLoading : t.acceptRideButton}
                            </button>
                        </div>
                    ))}
                </>
            )}
          </>
        )}
      </DrawerPanel>
      <DrawerPanel currentLang={currentLang} isOpen={showCurrentTripDrawer} onClose={() => setShowCurrentTripDrawer(false)} title={t.currentTripDrawerTitle} side={isRTL ? 'left' : 'right'}>
        {currentTrip && (
            <CurrentTripDetailsPanel
                currentLang={currentLang}
                trip={currentTrip}
                passenger={currentPassengerDetails}
                isLoadingPassenger={isLoadingPassengerDetails}
                passengerFetchError={passengerDetailsError}
                currentPhase={currentTripPhase}
                onNavigateToPickup={handleNavigateToPickup}
                onStartTrip={handleStartTrip}
                onEndTrip={handleEndTrip}
                onCancelTrip={handleCancelTrip}
                onOpenChat={handleOpenChat}
            />
        )}
        {!currentTrip && <p style={noDataTextStyle}>{t.noActiveTrip}</p>}
      </DrawerPanel>
      {isChatModalOpen && currentTrip && loggedInUserId && (
          <ChatModal 
              isOpen={isChatModalOpen}
              onClose={() => setIsChatModalOpen(false)}
              rideRequestId={currentTrip.id}
              otherPartyName={currentPassengerDetails?.fullName || currentTrip.passenger_name || t.defaultPassengerName}
              otherPartyId={currentTrip.passenger_id}
          />
      )}
      {isCancellationModalOpen && currentTrip && (
          <CancellationModal
              isOpen={isCancellationModalOpen}
              onClose={() => setIsCancellationModalOpen(false)}
              onSubmit={handleDriverCancellationSubmit}
              userRole="driver"
              currentLang={currentLang}
              isSubmitting={isSubmittingCancellation}
          />
      )}
      {isCalculatingFare && (
          <div style={fareModalOverlayStyle}>
              <div style={fareCalculationModalStyle}>
                  <HourglassIcon />
                  <p style={{fontSize: '1.1rem', fontWeight: 500, color: '#2D3748'}}>{t.calculatingFare}</p>
              </div>
          </div>
      )}
      {fareSummary && (
          <div style={fareModalOverlayStyle}>
              <div style={fareModalContentStyle}>
                  <p style={fareModalTitleStyle}>
                      {t.fareToCollect
                          .replace('{amount}', fareSummary.amount.toLocaleString(isRTL ? 'fa-IR' : 'en-US') + ` ${t.priceUnit}`)
                          .replace('{passengerName}', fareSummary.passengerName)
                      }
                  </p>
                  <button 
                      style={fareModalOkButtonStyle} 
                      onClick={() => {
                          setFareSummary(null);
                          resetTripState();
                      }}
                  >
                      {t.okButton}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};