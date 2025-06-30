import React, { useState, useEffect, useRef, CSSProperties, useCallback, useContext } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { supabase } from '../services/supabase';
import { RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
import { RideRequest, AppService, PassengerDetails, DriverTripPhase, DriverProfileData, UserRole } from '../types'; 
import { NewRideRequestPopup } from '../components/NewRideRequestPopup';
import { DrawerPanel } from '../components/DrawerPanel';
import { DriverProfileModal } from '../components/DriverProfileModal';
import { CurrentTripDetailsPanel } from '../components/CurrentTripDetailsPanel'; 
import { CancellationModal } from '../components/CancellationModal';
import { ListIcon, CarIcon, GpsIcon, LocationMarkerIcon, DestinationMarkerIcon, ProfileIcon, DriverCarIcon, HourglassIcon } from '../components/icons';
import { AppContext, useAppContext } from '../contexts/AppContext';
import { userService } from '../services/userService';
import { getDebugMessage, getDistanceFromLatLonInKm, getCurrentLocation } from '../utils/helpers';
import { APP_USER_AGENT } from '../config';


interface DriverDashboardScreenProps {
  onLogout: () => void;
}

const PROXIMITY_THRESHOLD_KM = 0.1; // 100 meters
const POPUP_TIMEOUT_SECONDS = 30; 


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


export const DriverDashboardScreen = ({ onLogout }: DriverDashboardScreenProps): JSX.Element => {
  const { 
    currentLang, 
    loggedInUserId, 
    isUserVerified,
    allAppServices, 
    t 
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
  const [actualTripStartCoords, setActualTripStartCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tripPathCoordinates, setTripPathCoordinates] = useState<{lat: number, lng: number}[]>([]);
  
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

  const [showIncomingDrawer, setShowIncomingDrawer] = useState(false);
  const [showCurrentTripDrawer, setShowCurrentTripDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); 

  const actualDriverGpsMarker = useRef<L.Marker | null>(null); 

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);

  const playNotificationSound = useCallback(() => {
    if (audioPlayerRef.current) {
        const defaultSoundUrl = 'https://actions.google.com/sounds/v1/notifications/card_dismiss.ogg';
        let soundFile = driverProfile.alertSoundPreference || defaultSoundUrl;

        if (soundFile.startsWith('custom:')) {
            console.warn(`Custom sound selected (${soundFile}), playing default as custom file playback is not supported in this simulation.`);
            soundFile = defaultSoundUrl;
        }

        if (soundFile.startsWith('http')) {
            audioPlayerRef.current.src = soundFile;
        } else {
            // Fallback for legacy local file names that might be in the database
            audioPlayerRef.current.src = `/assets/sounds/${soundFile.split('/').pop()}`;
        }
        
        audioPlayerRef.current.play().catch(e => console.error("Error playing sound:", e));
    }
  }, [driverProfile.alertSoundPreference]);

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
    setActualTripStartCoords(null);
    setTripPathCoordinates([]);
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
    }
    if (loggedInUserId && !driverProfile.userId) {
        userService.fetchDriverProfile(loggedInUserId)
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
                driver_id: loggedInUserId, latitude: latitude, longitude: longitude,
                heading: heading, timestamp: new Date().toISOString(),
            }, { onConflict: 'driver_id' });

            if (actualDriverGpsMarker.current) {
                actualDriverGpsMarker.current.setLatLng([latitude, longitude]);
            }
            if (currentTrip && currentTripPhase === DriverTripPhase.EN_ROUTE_TO_DESTINATION) {
                setTripPathCoordinates(prev => [...prev, { lat: latitude, lng: longitude }]);
                try {
                    await supabase.from('trip_coordinates').insert({
                        ride_request_id: currentTrip.id,
                        latitude: latitude,
                        longitude: longitude,
                        timestamp: new Date().toISOString()
                    });
                } catch (e) {
                    console.error('[DriverDashboard] Failed to persist trip coordinate:', getDebugMessage(e));
                }
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
      const { data, error } = await supabase.from('ride_requests').select('*').eq('status', 'pending').is('driver_id', null); 
      if (error) { console.error('[DriverDashboard] Error fetching all pending requests:', getDebugMessage(error), error); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
      else { 
          const nonDeclinedRequests = (data as RideRequest[]).filter(
              req => !timedOutOrDeclinedRequests.some(declined => declined.id === req.id)
          );
          setAllPendingRequests(nonDeclinedRequests);
      }
    } catch (e) { console.error('[DriverDashboard] Exception during fetchAllPendingRequests:', getDebugMessage(e), e); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
    finally { setIsLoadingAllPending(false); }
  },[t.errorFetchingRequests, isOnline, isUserVerified, supabase, currentTrip, timedOutOrDeclinedRequests]);

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
    if (!loggedInUserId || !isUserVerified) { 
        if (!isUserVerified) alert(t.accountNotVerifiedWarning);
        else alert("User ID not found. Cannot change status."); 
        return; 
    }
    const newStatus = !isOnline; setIsOnline(newStatus); 
    try { 
        await userService.updateDriverOnlineStatus(loggedInUserId, newStatus); 
        if (newStatus && (!driverProfile.userId || driverProfile.userId !== loggedInUserId)) { 
             userService.fetchDriverProfile(loggedInUserId)
                .then(data => setDriverProfile(data))
                .catch(err => console.error("Error fetching driver profile on going online:", err));
        }
    }
    catch (e: any) { setIsOnline(!newStatus); alert(t.errorUpdatingDriverStatus + `: ${getDebugMessage(e)}`); }
  };

  const drawTripMarkers = (originCoords: L.LatLngTuple, destinationCoords: L.LatLngTuple | null) => {
    const map = mapInstanceRef.current;
    if(!map) return;

    if (tripOriginMarkerRef.current && map.hasLayer(tripOriginMarkerRef.current)) map.removeLayer(tripOriginMarkerRef.current);
    const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FF8C00" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))' }}/>);
    const originLeafletIcon = L.divIcon({ html: originIconHTML, className: 'trip-origin-marker', iconSize: [32,32], iconAnchor: [16,32] });
    tripOriginMarkerRef.current = L.marker(originCoords, { icon: originLeafletIcon }).addTo(map);

    if (destinationCoords) {
        if (tripDestinationMarkerRef.current && map.hasLayer(tripDestinationMarkerRef.current)) map.removeLayer(tripDestinationMarkerRef.current);
        const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#EA4335" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))' }}/>);
        const destLeafletIcon = L.divIcon({ html: destIconHTML, className: 'trip-destination-marker', iconSize: [32,32], iconAnchor: [16,16] });
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
        const acceptedRide = await userService.updateRide(requestToAccept.id, {
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
            // For third-party rides, use the name/phone from the ride request itself.
            setCurrentPassengerDetails({
                id: acceptedRide.passenger_id, // Booker's ID for reference
                fullName: acceptedRide.passenger_name,
                phoneNumber: acceptedRide.passenger_phone,
                profilePicUrl: null // No profile picture for third-party passengers
            });
            setIsLoadingPassengerDetails(false);
            setPassengerDetailsError(null);
        } else {
            // For self-booked rides, fetch the passenger's full profile.
            setIsLoadingPassengerDetails(true);
            setPassengerDetailsError(null);
            userService.fetchUserDetailsById(acceptedRide.passenger_id)
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
        await userService.updateRide(currentTrip.id, {
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
    const startCoords = { lat: driverLocation.lat, lng: driverLocation.lng };
    setActualTripStartCoords(startCoords);
    setTripPathCoordinates([startCoords]);

    try {
        await userService.updateRide(currentTrip.id, { status: 'trip_started', trip_started_at: new Date().toISOString() });
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
        setActualTripStartCoords(null);
        setTripPathCoordinates([]);
    }
  };

  const handleEndTrip = async () => {
    if (!currentTrip || !actualTripStartCoords || !driverLocation) {
        alert(isRTL ? "نمی توان سفر را به پایان رساند: اطلاعات سفر یا موقعیت GPS در دسترس نیست." : "Cannot end trip: missing trip info or GPS location.");
        return;
    }
    
    setIsCalculatingFare(true);
    // Allow UI to update
    await new Promise(resolve => setTimeout(resolve, 100));

    const finalTripPath = [...tripPathCoordinates, driverLocation];
    let totalDistanceKm = 0;
    for (let i = 0; i < finalTripPath.length - 1; i++) {
        const point1 = finalTripPath[i];
        const point2 = finalTripPath[i + 1];
        if (point1 && point2) {
            totalDistanceKm += getDistanceFromLatLonInKm(point1.lat, point1.lng, point2.lat, point2.lng);
        }
    }

    const service = allAppServices.find(s => s.id === currentTrip.service_id);
    let finalFare: number | null = currentTrip.estimated_fare;
    
    if (service?.pricePerKm) {
        const calculatedFare = totalDistanceKm * service.pricePerKm;
        const minFare = service.minFare ?? 0;
        finalFare = Math.max(calculatedFare, minFare);
    } else {
        console.warn("Could not calculate actual distance or service price/km missing, falling back to estimated fare.");
    }
    
    try {
        await userService.updateRide(currentTrip.id, { 
            status: 'trip_completed',
            actual_fare: finalFare,
            actual_trip_polyline: JSON.stringify(finalTripPath)
        });
        
        setIsCalculatingFare(false);
        setFareSummary({ 
            amount: Math.round(finalFare ?? 0), 
            passengerName: currentPassengerDetails?.fullName || t.defaultPassengerName 
        });

    } catch (error) {
        setIsCalculatingFare(false);
        console.error("Critical Error: Failed to update trip status to completed.", getDebugMessage(error));
        alert(isRTL ? "خطای حیاتی در پایان سفر رخ داد." : "A critical error occurred while ending the trip.");
        resetTripState(); // Reset as a last resort
    }
  };

  const handleDriverCancellationSubmit = async (reasonKey: string, customReason: string) => {
    if (!currentTrip || !loggedInUserId) {
        alert(t.errorCancellingTrip + " (Missing IDs)");
        return;
    }
    setIsSubmittingCancellation(true);
    try {
        await userService.updateRide(currentTrip.id, { status: 'cancelled_by_driver' });
        await userService.submitCancellationReport({
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
        resetTripState(); // Reset anyway
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
  
  // Trip recovery effect
  useEffect(() => {
    const recoverTrip = async () => {
      if (!loggedInUserId || currentTrip) { return; }
      try {
        const activeTrip = await userService.fetchActiveDriverTrip(loggedInUserId);
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
          
          if (recoveredPhase === DriverTripPhase.EN_ROUTE_TO_DESTINATION) {
              const { data: pathData, error: pathError } = await supabase
                  .from('trip_coordinates')
                  .select('latitude, longitude')
                  .eq('ride_request_id', activeTrip.id)
                  .order('timestamp', { ascending: true });
              
              if (pathError) {
                  console.error("Error fetching recovered trip path:", getDebugMessage(pathError));
              } else if (pathData && pathData.length > 0) {
                  const recoveredPath = pathData.map(p => ({ lat: p.latitude, lng: p.longitude }));
                  setTripPathCoordinates(recoveredPath);
                  setActualTripStartCoords(recoveredPath[0]);
              }
          }

          setCurrentTripPhase(recoveredPhase);
          setShowCurrentTripDrawer(true);
          
          if (activeTrip.is_third_party) {
            setCurrentPassengerDetails({ id: activeTrip.passenger_id, fullName: activeTrip.passenger_name, phoneNumber: activeTrip.passenger_phone, profilePicUrl: null });
          } else {
            setIsLoadingPassengerDetails(true);
            userService.fetchUserDetailsById(activeTrip.passenger_id)
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


  // --- STYLES ---

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
  
  const statusToggleContainerStyle: CSSProperties = {
    perspective: '500px', // For 3D effect
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
      position: 'relative', // For badge positioning
  });
  const iconButtonHoverStyle: CSSProperties = {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
  };

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


  return (
    <div style={driverDashboardPageStyle}>
      <audio ref={audioPlayerRef} style={{display: 'none'}} controls preload="auto" />
      <div ref={mapContainerRef} style={mapBackgroundStyle} />
      <div style={contentOverlayStyle}>
        <header style={headerStyle}>
          <div style={statusToggleContainerStyle}>
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
            <button style={iconButtonStyle(!!currentTrip)} onMouseEnter={(e) => {if (!currentTrip) e.currentTarget.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15);'}} onMouseLeave={(e) => {if (!currentTrip) e.currentTarget.style.cssText += 'transform: none; box-shadow: 0 2px 5px rgba(0,0,0,0.1);'}} onClick={() => setShowIncomingDrawer(true)} aria-label={t.requestsButton} aria-haspopup="true" aria-expanded={showIncomingDrawer} disabled={!!currentTrip} > 
                <ListIcon /> 
                {(timedOutOrDeclinedRequests.length + allPendingRequests.length) > 0 && <span style={badgeStyle}>{(timedOutOrDeclinedRequests.length + allPendingRequests.length)}</span>} 
            </button>
            <button style={iconButtonStyle(!currentTrip)} onMouseEnter={(e) => {if (currentTrip) e.currentTarget.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15);'}} onMouseLeave={(e) => {if (currentTrip) e.currentTarget.style.cssText += 'transform: none; box-shadow: 0 2px 5px rgba(0,0,0,0.1);'}} onClick={() => setShowCurrentTripDrawer(true)} aria-label={t.activeTripButton} aria-haspopup="true" aria-expanded={showCurrentTripDrawer} disabled={!currentTrip} > 
                <CarIcon /> 
            </button>
            <button style={iconButtonStyle(false)} onMouseEnter={(e) => e.currentTarget.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15);'} onMouseLeave={(e) => e.currentTarget.style.cssText += 'transform: none; box-shadow: 0 2px 5px rgba(0,0,0,0.1);'} onClick={() => setShowProfileModal(true)} aria-label={t.profileButtonAriaLabel} > 
                <ProfileIcon /> 
            </button>
            <button style={iconButtonStyle(false)} onMouseEnter={(e) => e.currentTarget.style.cssText += 'transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15);'} onMouseLeave={(e) => e.currentTarget.style.cssText += 'transform: none; box-shadow: 0 2px 5px rgba(0,0,0,0.1);'} onClick={onLogout} aria-label={t.logoutButton}> 
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
      <button style={gpsFabStyle} onClick={handleLocateDriver} aria-label={t.gpsButtonAriaLabel} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'} > <GpsIcon style={{ color: '#007AFF', width: '1.75rem', height: '1.75rem' }} /> </button>
      {requestInPopup && isOnline && isUserVerified && !currentTrip && ( <NewRideRequestPopup currentLang={currentLang} request={requestInPopup} allAppServices={allAppServices} timer={popupTimer} onAccept={() => handleAcceptRequest(requestInPopup)} onDecline={handleDeclineRequestFromPopup} driverLocation={driverLocation} /> )}
      <DriverProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} currentLang={currentLang} loggedInUserId={loggedInUserId} />
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
            />
        )}
        {!currentTrip && <p style={noDataTextStyle}>{t.noActiveTrip}</p>}
      </DrawerPanel>
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