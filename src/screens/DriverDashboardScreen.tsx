
import React, { useState, useEffect, useRef, CSSProperties, useCallback, useContext } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { supabase } from '../services/supabase';
import { RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
import { RideRequest, AppService, PassengerDetails, DriverTripPhase, DriverProfileData } from '../types'; 
import { NewRideRequestPopup } from '../components/NewRideRequestPopup';
import { DrawerPanel } from '../components/DrawerPanel';
import { DriverProfileModal } from '../components/DriverProfileModal';
import { CurrentTripDetailsPanel } from '../components/CurrentTripDetailsPanel'; 
import { ListIcon, CarIcon, GpsIcon, LocationMarkerIcon, DestinationMarkerIcon, ProfileIcon, DriverCarIcon } from '../components/icons';
import { AppContext, useAppContext } from '../contexts/AppContext';
import { userService } from '../services/userService';
import { getDebugMessage, getDistanceFromLatLonInKm } from '../utils/helpers';
import { APP_USER_AGENT } from '../config';


interface DriverDashboardScreenProps {
  onLogout: () => void;
}

const PROXIMITY_THRESHOLD_KM = 0.1; // 100 meters
const POPUP_TIMEOUT_SECONDS = 30; 

export const DriverDashboardScreen = ({ onLogout }: DriverDashboardScreenProps): JSX.Element => {
  const { 
    currentLang, 
    loggedInUserId, 
    allAppServices, 
    t 
  } = useAppContext();

  const isRTL = currentLang !== 'en';
  const [isOnline, setIsOnline] = useState(false);
  // dailyEarnings state is kept for potential future logic, though UI element was removed.
  const [driverProfile, setDriverProfile] = useState<Partial<DriverProfileData>>({});
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

  const [isLoadingAllPending, setIsLoadingAllPending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  const [isAcceptButtonHovered, setIsAcceptButtonHovered] = useState<{[key: string]: boolean}>({});


  const [showIncomingDrawer, setShowIncomingDrawer] = useState(false);
  const [showCurrentTripDrawer, setShowCurrentTripDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); 

  const actualDriverGpsMarker = useRef<L.Marker | null>(null); 

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);

  const playNotificationSound = useCallback(() => {
    if (audioPlayerRef.current) {
        let soundFile = driverProfile.alertSoundPreference || 'default_notification.mp3';
        if (soundFile.startsWith('custom:')) {
            console.warn(`Custom sound selected (${soundFile}), playing default as custom file playback is not supported in this simulation.`);
            soundFile = 'default_notification.mp3'; 
        }
        audioPlayerRef.current.src = `/assets/sounds/${soundFile.split('/').pop()}`; // Ensure only filename is used
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
  }, [clearMapTripElements]);

  const fetchOsrmRoute = async (startCoords: L.LatLngTuple, endCoords: L.LatLngTuple): Promise<L.LatLngExpression[] | null> => {
    setIsNavigating(true);
    try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`, {
            headers: { 'User-Agent': APP_USER_AGENT }
        });
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
        const initialView: L.LatLngExpression = [34.5553, 69.2075]; 
        const newMap = L.map(mapContainerRef.current, {
            center: initialView, zoom: 13, zoomControl: false, attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(newMap);
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
    navigator.geolocation.getCurrentPosition(initialLocationListener, (err) => console.warn("Error getting initial GPS for marker:", err), { enableHighAccuracy: true });
  }, [isOnline, loggedInUserId, currentTripPhase]);

  useEffect(() => {
    if (isOnline && loggedInUserId && navigator.geolocation) {
      locationWatchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, heading } = position.coords;
          try {
            await supabase.from('driver_locations').upsert({
                driver_id: loggedInUserId, latitude: latitude, longitude: longitude,
                heading: heading, timestamp: new Date().toISOString(),
            }, { onConflict: 'driver_id' });

            if (actualDriverGpsMarker.current) {
                actualDriverGpsMarker.current.setLatLng([latitude, longitude]);
            }
            
            if (currentTrip) {
                if (currentTripPhase === DriverTripPhase.EN_ROUTE_TO_PICKUP) {
                    const distToPickup = getDistanceFromLatLonInKm(latitude, longitude, currentTrip.origin_lat, currentTrip.origin_lng);
                    if (distToPickup < PROXIMITY_THRESHOLD_KM) {
                        setCurrentTripPhase(DriverTripPhase.AT_PICKUP);
                        await userService.updateRide(currentTrip.id, { status: 'driver_at_origin', driver_arrived_at_origin_at: new Date().toISOString() });
                    }
                } else if (currentTripPhase === DriverTripPhase.EN_ROUTE_TO_DESTINATION) {
                    const distToDest = getDistanceFromLatLonInKm(latitude, longitude, currentTrip.destination_lat, currentTrip.destination_lng);
                    if (distToDest < PROXIMITY_THRESHOLD_KM) {
                        setCurrentTripPhase(DriverTripPhase.AT_DESTINATION);
                        await userService.updateRide(currentTrip.id, { status: 'driver_at_destination', driver_arrived_at_destination_at: new Date().toISOString() });
                    }
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
      if (locationWatchIdRef.current !== null) { navigator.geolocation.clearWatch(locationWatchIdRef.current); locationWatchIdRef.current = null; }
    }
    return () => { if (locationWatchIdRef.current !== null) navigator.geolocation.clearWatch(locationWatchIdRef.current); };
  }, [isOnline, loggedInUserId, t.geolocationPermissionDenied, currentTrip, currentTripPhase, supabase]);


  const fetchAllPendingRequests = useCallback(async () => {
    if (!isOnline) { setAllPendingRequests([]); setIsLoadingAllPending(false); return; }
    setIsLoadingAllPending(true); setFetchError(null);
    try {
      const { data, error } = await supabase.from('ride_requests').select('*').eq('status', 'pending').is('driver_id', null); 
      if (error) { console.error('[DriverDashboard] Error fetching all pending requests:', getDebugMessage(error), error); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
      else { setAllPendingRequests(data as RideRequest[]); }
    } catch (e) { console.error('[DriverDashboard] Exception during fetchAllPendingRequests:', getDebugMessage(e), e); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
    finally { setIsLoadingAllPending(false); }
  },[t.errorFetchingRequests, isOnline, supabase]);

  useEffect(() => {
    if (isOnline && !requestInPopup && allPendingRequests.length > 0) {
      const nextRequest = allPendingRequests.find(req => !timedOutOrDeclinedRequests.some(declinedReq => declinedReq.id === req.id) && (!currentTrip || currentTrip.id !== req.id));
      if (nextRequest) { 
        setRequestInPopup(nextRequest); 
        setPopupTimer(POPUP_TIMEOUT_SECONDS); 
        playNotificationSound();
      }
    }
  }, [allPendingRequests, requestInPopup, timedOutOrDeclinedRequests, currentTrip, isOnline, playNotificationSound]);

  useEffect(() => {
    if (requestInPopup && popupTimer > 0) { popupIntervalRef.current = window.setInterval(() => setPopupTimer(prev => prev - 1), 1000); }
    else if (requestInPopup && popupTimer === 0) { 
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        popupIntervalRef.current = null;
        setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup]); 
        setRequestInPopup(null);
    }
    return () => { if (popupIntervalRef.current) clearInterval(popupIntervalRef.current); };
  }, [requestInPopup, popupTimer]);

  useEffect(() => {
    let requestChannel: RealtimeChannel | null = null; let pollingIntervalId: number | undefined = undefined;
    if (isOnline) {
      if (loggedInUserId && (!driverProfile.userId || driverProfile.userId !== loggedInUserId)) {
          userService.fetchDriverProfile(loggedInUserId)
              .then(data => setDriverProfile(data))
              .catch(err => console.error("Error fetching driver profile:", err));
      }

      fetchAllPendingRequests();
      requestChannel = supabase.channel('driver_dashboard_ride_requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, (payload) => {
            fetchAllPendingRequests(); 
            if (currentTrip && payload.new && 'id' in payload.new && (payload.new as RideRequest).id === currentTrip.id) {
                const updatedTrip = payload.new as RideRequest;
                if (!['accepted', 'driver_en_route_to_origin', 'driver_at_origin', 'trip_started', 'en_route_to_destination', 'driver_at_destination'].includes(updatedTrip.status)) { 
                    resetTripState();
                    alert(isRTL ? "سفر فعلی شما تغییر وضعیت داده یا لغو شده است." : "Your current trip status has changed or been cancelled.");
                } else { setCurrentTrip(updatedTrip); }
            }
          })
        .subscribe((status, err) => { if (err) console.error('[DriverDashboard Realtime] Subscription Error:', getDebugMessage(err), err); });
      pollingIntervalId = window.setInterval(fetchAllPendingRequests, 7000); 
    } else { setAllPendingRequests([]); setRequestInPopup(null); if (popupIntervalRef.current) clearInterval(popupIntervalRef.current); resetTripState(); }
    return () => { if (pollingIntervalId) clearInterval(pollingIntervalId); if (requestChannel) supabase.removeChannel(requestChannel); };
  }, [isOnline, fetchAllPendingRequests, currentTrip, isRTL, resetTripState, supabase, loggedInUserId, driverProfile.userId]);

  const toggleOnlineStatus = async () => {
    if (!loggedInUserId) { alert("User ID not found. Cannot change status."); return; }
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
    
    // Clear timer and remove from popup immediately is already handled by setRequestInPopup below
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    popupIntervalRef.current = null;
    setRequestInPopup(null); // Close UI immediately

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

        setIsLoadingPassengerDetails(true);
        setPassengerDetailsError(null);
        userService.fetchUserDetailsById(acceptedRide.passenger_id)
            .then(setCurrentPassengerDetails)
            .catch(e => {
                console.error("Error fetching passenger details:", getDebugMessage(e));
                setPassengerDetailsError(t.errorFetchingPassengerDetails);
            })
            .finally(() => setIsLoadingPassengerDetails(false));

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
  
  const handleAcceptRequestFromPopup = () => requestInPopup && handleAcceptRequest(requestInPopup);
  const handleAcceptRequestFromDrawer = (requestId: string) => {
    const request = timedOutOrDeclinedRequests.find(r => r.id === requestId) || allPendingRequests.find(r => r.id === requestId);
    if (request) handleAcceptRequest(request);
  };

  const handleDeclineRequestFromPopup = () => {
    if (!requestInPopup) return;
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    popupIntervalRef.current = null;
    
    setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup]); 
    setRequestInPopup(null); 
  };

  const handleNavigateToPickup = async () => {
    if (!currentTrip || !actualDriverGpsMarker.current) {
        alert(isRTL ? "موقعیت فعلی یا اطلاعات سفر در دسترس نیست." : "Current location or trip info unavailable.");
        return;
    }
    setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_PICKUP);
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
    setShowCurrentTripDrawer(false); 
  };

  const handleStartTrip = async () => {
    if (!currentTrip) return;
    setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_DESTINATION);
    await userService.updateRide(currentTrip.id, { status: 'trip_started', trip_started_at: new Date().toISOString() });
    
    const originPos: L.LatLngTuple = [currentTrip.origin_lat, currentTrip.origin_lng];
    const destPos: L.LatLngTuple = [currentTrip.destination_lat, currentTrip.destination_lng];
    const routeCoords = await fetchOsrmRoute(originPos, destPos);
    if (routeCoords) {
        drawRouteOnMap(routeCoords, '#28a745');
        drawTripMarkers(originPos, destPos);
    } else {
        drawRouteOnMap([originPos, destPos], '#28a745', false); 
        drawTripMarkers(originPos, destPos);
        alert(isRTL ? "خطا در مسیریابی به مقصد. مسیر مستقیم نمایش داده شد." : "Routing error to destination. Straight line shown.");
    }
  };

  const handleEndTrip = async () => {
    if (!currentTrip) return;
    await userService.updateRide(currentTrip.id, { 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        actual_fare: currentTrip.estimated_fare 
    });
    // Daily earnings card removed, but logic can stay if needed elsewhere
    resetTripState();
  };

  const handleLocateDriver = () => {
    if (!mapInstanceRef.current) { alert(t.mapNotLoaded); return; }
    const map = mapInstanceRef.current;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatLng: L.LatLngExpression = [position.coords.latitude, position.coords.longitude];
                if (actualDriverGpsMarker.current) { actualDriverGpsMarker.current.setLatLng(userLatLng); }
                else {
                    const gpsMarkerIconHTML = ReactDOMServer.renderToString(<DriverCarIcon />);
                    const gpsLeafletIcon = L.divIcon({ html: gpsMarkerIconHTML, className: 'actual-driver-gps-marker', iconSize: [40,40], iconAnchor: [20,20] });
                    actualDriverGpsMarker.current = L.marker(userLatLng, { icon: gpsLeafletIcon, zIndexOffset: 1000 }).addTo(map);
                }
                map.setView(userLatLng, 16);
            },
            (error: GeolocationPositionError) => {
                console.error("Error getting GPS location:", getDebugMessage(error), error);
                let message = "";
                switch (error.code) {
                    case error.PERMISSION_DENIED: message = t.geolocationPermissionDenied; break;
                    case error.POSITION_UNAVAILABLE: message = t.geolocationUnavailableHintVpnOrSignal; break;
                    case error.TIMEOUT: message = t.geolocationTimeout; break;
                    default: message = t.geolocationUnavailable; break;
                }
                alert(message);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else { alert(t.geolocationNotSupported); }
  };

  const driverDashboardPageStyle: CSSProperties = { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', direction: isRTL ? 'rtl' : 'ltr', width: '100%', height: '100vh', position: 'relative', overflow: 'hidden', };
  const mapBackgroundStyle: CSSProperties = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, };
  const contentOverlayStyle: CSSProperties = { position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem', boxSizing: 'border-box', maxWidth: '600px', margin: '0 auto', backgroundColor: 'rgba(244, 246, 248, 0.0)', pointerEvents: 'none', };
  const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', pointerEvents: 'auto', backgroundColor: 'rgba(255, 255, 255, 0.85)', padding: '0.75rem 1rem', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', };
  const headerActionsStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'center'};
  const headerButtonStyle: CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#2d3748', backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #cbd5e0', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '0.35rem' };
  const headerButtonHoverStyle: CSSProperties = { backgroundColor: '#e2e8f0' };
  const badgeStyle: CSSProperties = { backgroundColor: '#e53e3e', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.1rem 0.4rem', borderRadius: '50%', minWidth: '1rem', textAlign: 'center' };
  const logoutButtonStyle: CSSProperties = { padding: '0.6rem 1rem', fontSize: '0.9rem', color: 'white', backgroundColor: '#e53e3e', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background-color 0.2s', };
  const logoutButtonHoverStyle: CSSProperties = { backgroundColor: '#c53030' };
  
  const statusToggleStyle: CSSProperties = { 
    width: '2.25rem',
    height: '2.25rem',
    backgroundColor: isOnline ? 'rgba(72, 187, 120, 0.9)' : 'rgba(160, 174, 192, 0.9)', 
    border: 'none', 
    borderRadius: '50%', // Make it circular
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)', 
    transition: 'background-color 0.3s', 
    pointerEvents: 'auto',
  };
  
  const cardsAreaStyle: CSSProperties = { flexGrow: 1, overflowY: 'auto', pointerEvents: 'auto', paddingTop: '1rem', paddingBottom: '1rem', WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 30px), transparent 100%)', maskImage: 'linear-gradient(to bottom, black calc(100% - 30px), transparent 100%)', };
  const cardStyle: CSSProperties = { backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '1rem', };
  const cardTitleStyle: CSSProperties = { fontSize: '1rem', fontWeight: '600', color: '#2d3748', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', };
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


  return (
    <div style={driverDashboardPageStyle}>
      <audio ref={audioPlayerRef} style={{display: 'none'}} controls preload="auto" />
      <div ref={mapContainerRef} style={mapBackgroundStyle} />
      <div style={contentOverlayStyle}>
        <header style={headerStyle}>
          <button 
            style={statusToggleStyle} 
            onClick={toggleOnlineStatus}
            aria-label={isOnline ? t.driverStatusOnline : t.driverStatusOffline}
          >
            {/* No visible content, color indicates status. ARIA label provides info. */}
          </button>
          <div style={headerActionsStyle}>
            <button style={headerButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = headerButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = headerButtonStyle.backgroundColor!)} onClick={() => setShowIncomingDrawer(true)} aria-haspopup="true" aria-expanded={showIncomingDrawer} > <ListIcon style={{fontSize: '1.1rem'}}/> {t.requestsButton} {timedOutOrDeclinedRequests.length > 0 && <span style={badgeStyle}>{timedOutOrDeclinedRequests.length}</span>} </button>
            <button style={headerButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = headerButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = headerButtonStyle.backgroundColor!)} onClick={() => setShowCurrentTripDrawer(true)} aria-haspopup="true" aria-expanded={showCurrentTripDrawer} disabled={!currentTrip} > <CarIcon style={{fontSize: '1.1rem'}}/> {t.activeTripButton} </button>
            <button style={headerButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = headerButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = headerButtonStyle.backgroundColor!)} onClick={() => setShowProfileModal(true)} aria-label={t.profileButtonAriaLabel} > <ProfileIcon style={{fontSize: '1.1rem'}}/> </button>
            <button style={logoutButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = logoutButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = logoutButtonStyle.backgroundColor!)} onClick={onLogout} > {t.logoutButton} </button>
          </div>
        </header>
        
        {isNavigating && <p style={navigationLoadingStyle}>{t.calculatingPrice}</p>}
        <div style={cardsAreaStyle}>
            {!isOnline && !currentTrip && (
            <div style={{...cardStyle, backgroundColor: 'rgba(230, 255, 250, 0.9)', border: '1px solid #38b2ac', textAlign: 'center', marginTop: '1rem'}}>
                <p style={{color: '#2c7a7b', fontWeight: 500}}>{t.goOnlinePrompt}</p>
            </div>
            )}
        </div>
      </div>
      <button style={gpsFabStyle} onClick={handleLocateDriver} aria-label={t.gpsButtonAriaLabel} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'} > <GpsIcon style={{ color: '#007AFF', width: '1.75rem', height: '1.75rem' }} /> </button>
      {requestInPopup && isOnline && ( <NewRideRequestPopup currentLang={currentLang} request={requestInPopup} allAppServices={allAppServices} timer={popupTimer} onAccept={handleAcceptRequestFromPopup} onDecline={handleDeclineRequestFromPopup} /> )}
      <DriverProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} currentLang={currentLang} loggedInUserId={loggedInUserId} />
      <DrawerPanel currentLang={currentLang} isOpen={showIncomingDrawer} onClose={() => setShowIncomingDrawer(false)} title={t.incomingRequestsDrawerTitle} side={isRTL ? 'right' : 'left'} >
        {isLoadingAllPending && <p style={loadingTextStyle}>{t.loadingRequests}</p>}
        {fetchError && !isLoadingAllPending && <p style={errorTextStyle}>{fetchError}</p>}
        {!isLoadingAllPending && !fetchError && timedOutOrDeclinedRequests.length === 0 && allPendingRequests.filter(req => !timedOutOrDeclinedRequests.find(tdr => tdr.id === req.id)).length === 0 && ( <p style={noDataTextStyle}>{t.noDeclinedRequests}</p> )}
        
         {!isLoadingAllPending && !fetchError && allPendingRequests.filter(req => !timedOutOrDeclinedRequests.find(tdr => tdr.id === req.id) && req.id !== requestInPopup?.id).length > 0 &&
           allPendingRequests.filter(req => !timedOutOrDeclinedRequests.find(tdr => tdr.id === req.id) && req.id !== requestInPopup?.id).map((req) => (
             <div key={`pending-${req.id}`} style={{...requestItemStyle, opacity: 0.7}}>
               <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestPassengerLabel}:</span> <span style={requestValueStyle}>{req.passenger_name || (isRTL ? 'نامشخص' : 'N/A')}</span> </div>
               <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFromLabel}:</span> <span style={requestValueStyle} title={req.origin_address}>{req.origin_address}</span> </div>
               <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestToLabel}:</span> <span style={requestValueStyle} title={req.destination_address}>{req.destination_address}</span> </div>
               <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFareLabel}:</span> <span style={requestFareStyle}>{t.earningsAmountUnit.replace('{amount}', (req.estimated_fare ?? 0).toLocaleString(isRTL ? 'fa-IR' : 'en-US'))}</span> </div>
                {/* This button is only for requests in the drawer that were previously declined/timed out or are just pending but not in active popup */}
                <button 
                  style={acceptingRequestId === req.id ? {...acceptButtonStyle, ...acceptButtonDisabledStyle} : (isAcceptButtonHovered[`drawer-${req.id}`] ? {...acceptButtonStyle, ...acceptButtonHoverStyle} : acceptButtonStyle) }
                  onClick={() => handleAcceptRequestFromDrawer(req.id)}
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
                <h4 style={{...cardTitleStyle, marginTop: '1.5rem', fontSize: '0.9rem'}}>{isRTL ? 'رد شده / بدون پاسخ' : 'Declined / Unanswered'}</h4>
                {timedOutOrDeclinedRequests.map(req => (
                    <div key={`declined-${req.id}`} style={{...requestItemStyle, opacity: 0.8, backgroundColor: 'rgba(254, 226, 226, 0.5)'}}>
                        <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestPassengerLabel}:</span> <span style={requestValueStyle}>{req.passenger_name || (isRTL ? 'نامشخص' : 'N/A')}</span> </div>
                        <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFromLabel}:</span> <span style={requestValueStyle} title={req.origin_address}>{req.origin_address}</span> </div>
                        <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestToLabel}:</span> <span style={requestValueStyle} title={req.destination_address}>{req.destination_address}</span> </div>
                        <button 
                          style={acceptingRequestId === req.id ? {...acceptButtonStyle, ...acceptButtonDisabledStyle} : (isAcceptButtonHovered[`drawer-${req.id}`] ? {...acceptButtonStyle, ...acceptButtonHoverStyle} : acceptButtonStyle) }
                          onClick={() => handleAcceptRequestFromDrawer(req.id)}
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
            />
        )}
        {!currentTrip && <p style={noDataTextStyle}>{t.noActiveTrip}</p>}
      </DrawerPanel>
    </div>
  );
};
