import React, { useState, useEffect, useRef, CSSProperties, useCallback, useContext } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { supabase } from '../services/supabase';
import { RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
import { RideRequest, AppService, PassengerDetails, DriverTripPhase } from '../types'; // Added PassengerDetails, DriverTripPhase
import { NewRideRequestPopup } from '../components/NewRideRequestPopup';
import { DrawerPanel } from '../components/DrawerPanel';
import { DriverProfileModal } from '../components/DriverProfileModal';
import { CurrentTripDetailsPanel } from '../components/CurrentTripDetailsPanel'; // Import new panel
import { ListIcon, CarIcon, GpsIcon, LocationMarkerIcon, DestinationMarkerIcon, ProfileIcon, DriverCarIcon } from '../components/icons';
import { AppContext, useAppContext } from '../contexts/AppContext';
import { userService } from '../services/userService';
import { getDebugMessage } from '../utils/helpers';

interface DriverDashboardScreenProps {
  onLogout: () => void;
}

export const DriverDashboardScreen = ({ onLogout }: DriverDashboardScreenProps): JSX.Element => {
  const { 
    currentLang, 
    loggedInUserId, 
    allAppServices, 
    t 
  } = useAppContext();

  const isRTL = currentLang !== 'en';
  const [isOnline, setIsOnline] = useState(false);
  const [dailyEarnings, setDailyEarnings] = useState(0);

  const [allPendingRequests, setAllPendingRequests] = useState<RideRequest[]>([]);
  const [requestInPopup, setRequestInPopup] = useState<RideRequest | null>(null);
  const [popupTimer, setPopupTimer] = useState(15);
  const popupIntervalRef = useRef<number | null>(null);
  const [timedOutOrDeclinedRequests, setTimedOutOrDeclinedRequests] = useState<RideRequest[]>([]);
  
  const [currentTrip, setCurrentTrip] = useState<RideRequest | null>(null);
  const [currentPassengerDetails, setCurrentPassengerDetails] = useState<PassengerDetails | null>(null);
  const [isLoadingPassengerDetails, setIsLoadingPassengerDetails] = useState<boolean>(false);
  const [passengerDetailsError, setPassengerDetailsError] = useState<string | null>(null);
  const [currentTripPhase, setCurrentTripPhase] = useState<DriverTripPhase>(DriverTripPhase.NONE);
  const tripPolylineRef = useRef<L.Polyline | null>(null);
  const tripOriginMarkerRef = useRef<L.Marker | null>(null);
  const tripDestinationMarkerRef = useRef<L.Marker | null>(null);


  const [isLoadingAllPending, setIsLoadingAllPending] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);

  const [showIncomingDrawer, setShowIncomingDrawer] = useState(false);
  const [showCurrentTripDrawer, setShowCurrentTripDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); 

  const actualDriverGpsMarker = useRef<L.Marker | null>(null); // Changed to ref

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);

  const clearMapTripElements = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tripPolylineRef.current && map.hasLayer(tripPolylineRef.current)) {
        map.removeLayer(tripPolylineRef.current);
        tripPolylineRef.current = null;
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
    // If driver marker is not their actual GPS marker, clear it too.
    // For now, assume actualDriverGpsMarker is persistent if online.
  }, [clearMapTripElements]);


  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
        const initialView: L.LatLngExpression = [34.5553, 69.2075]; 
        const newMap = L.map(mapContainerRef.current, {
            center: initialView, zoom: 13, zoomControl: false, attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(newMap);
        mapInstanceRef.current = newMap;
    }
    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }
        resetTripState(); // Clean up trip state on unmount
    };
  }, [resetTripState]);

  // Effect to update driver's actual GPS marker on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isOnline || !loggedInUserId) {
        // If offline or no map, remove the marker
        if (actualDriverGpsMarker.current && map?.hasLayer(actualDriverGpsMarker.current)) {
            map.removeLayer(actualDriverGpsMarker.current);
            actualDriverGpsMarker.current = null;
        }
        return;
    }

    // This is a simplified listener; actual updates come from watchPosition
    const initialLocationListener = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const driverLatLng: L.LatLngExpression = [latitude, longitude];

        if (actualDriverGpsMarker.current) {
            actualDriverGpsMarker.current.setLatLng(driverLatLng);
        } else {
            const driverIconHTML = ReactDOMServer.renderToString(<DriverCarIcon />);
            const driverLeafletIcon = L.divIcon({
                html: driverIconHTML,
                className: 'actual-driver-gps-marker',
                iconSize: [40, 40],
                iconAnchor: [20, 20],
            });
            actualDriverGpsMarker.current = L.marker(driverLatLng, { icon: driverLeafletIcon, zIndexOffset: 1000 }).addTo(map);
        }
        if (currentTripPhase === DriverTripPhase.NONE) { // Only pan if no active trip route is shown
            map.setView(driverLatLng, map.getZoom() < 15 ? 15: map.getZoom() );
        }
    };
    
    // Attempt to get current position once to place marker initially
    navigator.geolocation.getCurrentPosition(initialLocationListener, 
      (err) => console.warn("Error getting initial GPS for marker:", err), 
      { enableHighAccuracy: true }
    );

  }, [isOnline, loggedInUserId, currentTripPhase]);


  useEffect(() => {
    if (isOnline && loggedInUserId && navigator.geolocation) {
      locationWatchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, heading } = position.coords;
          try {
            const { error: upsertError } = await supabase
              .from('driver_locations')
              .upsert({
                driver_id: loggedInUserId, latitude: latitude, longitude: longitude,
                heading: heading, timestamp: new Date().toISOString(),
              }, { onConflict: 'driver_id' });

            if (upsertError) console.error('[DriverDashboard] Error upserting driver location:', getDebugMessage(upsertError), upsertError);
            
            // Update map marker if it exists
            if (actualDriverGpsMarker.current) {
                actualDriverGpsMarker.current.setLatLng([latitude, longitude]);
                 // If navigating to pickup, and map is available, re-draw route from new position
                if (currentTripPhase === DriverTripPhase.EN_ROUTE_TO_PICKUP && currentTrip && mapInstanceRef.current) {
                    drawRouteToPickup([latitude, longitude], [currentTrip.origin_lat, currentTrip.origin_lng]);
                }
            }

          } catch (e) { console.error('[DriverDashboard] Exception during driver location upsert:', getDebugMessage(e), e); }
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
  }, [isOnline, loggedInUserId, t.geolocationPermissionDenied, currentTripPhase, currentTrip]);


  const fetchAllPendingRequests = useCallback(async () => {
    if (!isOnline) { setAllPendingRequests([]); setIsLoadingAllPending(false); return; }
    setIsLoadingAllPending(true); setFetchError(null);
    try {
      const { data, error } = await supabase.from('ride_requests').select('*').eq('status', 'pending').is('driver_id', null); 
      if (error) { console.error('[DriverDashboard] Error fetching all pending requests:', getDebugMessage(error), error); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
      else { setAllPendingRequests(data as RideRequest[]); }
    } catch (e) { console.error('[DriverDashboard] Exception during fetchAllPendingRequests:', getDebugMessage(e), e); setFetchError(t.errorFetchingRequests); setAllPendingRequests([]); }
    finally { setIsLoadingAllPending(false); }
  },[t.errorFetchingRequests, isOnline]);

  useEffect(() => {
    if (isOnline && !requestInPopup && allPendingRequests.length > 0) {
      const nextRequest = allPendingRequests.find(req => !timedOutOrDeclinedRequests.some(declinedReq => declinedReq.id === req.id) && (!currentTrip || currentTrip.id !== req.id));
      if (nextRequest) { setRequestInPopup(nextRequest); setPopupTimer(15); }
    }
  }, [allPendingRequests, requestInPopup, timedOutOrDeclinedRequests, currentTrip, isOnline]);

  useEffect(() => {
    if (requestInPopup && popupTimer > 0) { popupIntervalRef.current = window.setInterval(() => setPopupTimer(prev => prev - 1), 1000); }
    else if (requestInPopup && popupTimer === 0) { 
        if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
        setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup]); setRequestInPopup(null);
    }
    return () => { if (popupIntervalRef.current) clearInterval(popupIntervalRef.current); };
  }, [requestInPopup, popupTimer]);

  useEffect(() => {
    let requestChannel: RealtimeChannel | null = null; let pollingIntervalId: number | undefined = undefined;
    if (isOnline) {
      fetchAllPendingRequests();
      requestChannel = supabase.channel('driver_dashboard_ride_requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, (payload) => {
            fetchAllPendingRequests(); 
            if (currentTrip && payload.new && 'id' in payload.new && (payload.new as RideRequest).id === currentTrip.id) {
                const updatedTrip = payload.new as RideRequest;
                if (!['accepted', 'driver_en_route_to_origin', 'trip_started'].includes(updatedTrip.status)) { 
                    resetTripState(); // Use the reset function
                    alert(isRTL ? "سفر فعلی شما تغییر وضعیت داده یا لغو شده است." : "Your current trip status has changed or been cancelled.");
                } else { setCurrentTrip(updatedTrip); }
            }
          })
        .subscribe((status, err) => { if (err) console.error('[DriverDashboard Realtime] Subscription Error:', getDebugMessage(err), err); });
      pollingIntervalId = window.setInterval(fetchAllPendingRequests, 7000); // Increased polling interval slightly
    } else { setAllPendingRequests([]); setRequestInPopup(null); if (popupIntervalRef.current) clearInterval(popupIntervalRef.current); resetTripState(); }
    return () => { if (pollingIntervalId) clearInterval(pollingIntervalId); if (requestChannel) supabase.removeChannel(requestChannel); };
  }, [isOnline, fetchAllPendingRequests, currentTrip, isRTL, resetTripState]);

  const toggleOnlineStatus = async () => {
    if (!loggedInUserId) { alert("User ID not found. Cannot change status."); return; }
    const newStatus = !isOnline; setIsOnline(newStatus); 
    try { await userService.updateDriverOnlineStatus(loggedInUserId, newStatus); }
    catch (e: any) { setIsOnline(!newStatus); alert(t.errorUpdatingDriverStatus + `: ${getDebugMessage(e)}`); }
  };

  const drawRouteToPickup = (driverPos: L.LatLngExpression, pickupPos: L.LatLngExpression) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    clearMapTripElements(); // Clear previous trip elements

    tripPolylineRef.current = L.polyline([driverPos, pickupPos], { color: '#007bff', weight: 5, opacity: 0.8 }).addTo(map);
    
    // Add pickup marker
    const pickupIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FF8C00" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))' }}/>);
    const pickupLeafletIcon = L.divIcon({ html: pickupIconHTML, className: 'pickup-route-marker', iconSize: [32,32], iconAnchor: [16,32] });
    tripOriginMarkerRef.current = L.marker(pickupPos, { icon: pickupLeafletIcon }).addTo(map);

    const bounds = L.latLngBounds([driverPos, pickupPos]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  };

  const drawRouteToDestination = (pickupPos: L.LatLngExpression, destPos: L.LatLngExpression) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      clearMapTripElements();

      tripPolylineRef.current = L.polyline([pickupPos, destPos], { color: '#28a745', weight: 5, opacity: 0.8 }).addTo(map);

      const pickupIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FF8C00" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))' }}/>);
      const pickupLeafletIcon = L.divIcon({ html: pickupIconHTML, className: 'pickup-route-marker', iconSize: [32,32], iconAnchor: [16,32] });
      tripOriginMarkerRef.current = L.marker(pickupPos, { icon: pickupLeafletIcon }).addTo(map);

      const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#EA4335" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))' }}/>);
      const destLeafletIcon = L.divIcon({ html: destIconHTML, className: 'dest-route-marker', iconSize: [32,32], iconAnchor: [16,16] });
      tripDestinationMarkerRef.current = L.marker(destPos, { icon: destLeafletIcon }).addTo(map);
      
      const bounds = L.latLngBounds([pickupPos, destPos]);
      if (actualDriverGpsMarker.current) bounds.extend(actualDriverGpsMarker.current.getLatLng());
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  };


  const handleAcceptRequest = async (requestToAccept: RideRequest) => {
    if (!loggedInUserId) return;
    setAcceptingRequestId(requestToAccept.id);
    if (popupIntervalRef.current && requestInPopup?.id === requestToAccept.id) clearInterval(popupIntervalRef.current);
    
    const { data, error } = await supabase
      .from('ride_requests')
      .update({ status: 'accepted', driver_id: loggedInUserId })
      .eq('id', requestToAccept.id)
      .eq('status', 'pending')
      .select().single();

    if (error || !data) {
      console.error('[DriverDashboard] Error accepting request:', getDebugMessage(error), error);
      alert(t.errorAcceptingRequest + (error ? `: ${getDebugMessage(error)}`: ''));
      setAllPendingRequests(prev => prev.filter(r => r.id !== requestToAccept.id));
      setTimedOutOrDeclinedRequests(prev => prev.filter(r => r.id !== requestToAccept.id));
    } else {
      const acceptedTrip = data as RideRequest;
      setCurrentTrip(acceptedTrip);
      setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_PICKUP); // Initial phase after acceptance
      setAllPendingRequests(prev => prev.filter(r => r.id !== acceptedTrip.id)); 
      setTimedOutOrDeclinedRequests(prev => prev.filter(r => r.id !== acceptedTrip.id));
      setShowCurrentTripDrawer(true);
      setShowIncomingDrawer(false);

      setIsLoadingPassengerDetails(true);
      setPassengerDetailsError(null);
      try {
        const passenger = await userService.fetchUserDetailsById(acceptedTrip.passenger_id);
        setCurrentPassengerDetails(passenger);
      } catch (e: any) {
        console.error("Error fetching passenger details:", getDebugMessage(e));
        setPassengerDetailsError(t.errorFetchingPassengerDetails);
      } finally {
        setIsLoadingPassengerDetails(false);
      }
      // Initial route draw to pickup, assuming driver's current marker is up-to-date
      if (actualDriverGpsMarker.current) {
        drawRouteToPickup(actualDriverGpsMarker.current.getLatLng(), [acceptedTrip.origin_lat, acceptedTrip.origin_lng]);
      } else { // Fallback if driver marker not yet available (e.g., GPS slow)
        handleLocateDriver(); // Try to get location then draw
        // Could add a small delay and retry drawing if GPS is critical here
      }
    }
    setRequestInPopup(null); 
    setAcceptingRequestId(null);
  };
  
  const handleAcceptRequestFromPopup = () => requestInPopup && handleAcceptRequest(requestInPopup);
  const handleAcceptRequestFromDrawer = (requestId: string) => {
    const request = timedOutOrDeclinedRequests.find(r => r.id === requestId);
    if (request) handleAcceptRequest(request);
  };

  const handleDeclineRequestFromPopup = () => {
    if (!requestInPopup) return;
    if (popupIntervalRef.current) clearInterval(popupIntervalRef.current);
    setTimedOutOrDeclinedRequests(prev => [...prev, requestInPopup]); setRequestInPopup(null);
  };

  const handleNavigateToPickup = () => {
    if (!currentTrip || !actualDriverGpsMarker.current) return;
    setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_PICKUP); // Should already be this
    drawRouteToPickup(actualDriverGpsMarker.current.getLatLng(), [currentTrip.origin_lat, currentTrip.origin_lng]);
    // Potentially update DB: currentTrip.status = 'driver_en_route_to_origin'
    setShowCurrentTripDrawer(false); // Close drawer to see map
  };

  const handleStartTrip = () => {
    if (!currentTrip) return;
    setCurrentTripPhase(DriverTripPhase.EN_ROUTE_TO_DESTINATION);
    drawRouteToDestination([currentTrip.origin_lat, currentTrip.origin_lng], [currentTrip.destination_lat, currentTrip.destination_lng]);
    // Potentially update DB: currentTrip.status = 'trip_started'
  };

  const handleEndTrip = () => {
    // Potentially update DB: currentTrip.status = 'completed', calculate final fare, etc.
    resetTripState();
    // Refresh earnings or other dashboard data as needed
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
  const headerTitleStyle: CSSProperties = { fontSize: '1.5rem', fontWeight: 'bold', color: '#1a202c', margin:0 };
  const headerActionsStyle: CSSProperties = { display: 'flex', gap: '0.75rem'};
  const headerButtonStyle: CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#2d3748', backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #cbd5e0', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '0.35rem' };
  const headerButtonHoverStyle: CSSProperties = { backgroundColor: '#e2e8f0' };
  const badgeStyle: CSSProperties = { backgroundColor: '#e53e3e', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.1rem 0.4rem', borderRadius: '50%', minWidth: '1rem', textAlign: 'center' };
  const logoutButtonStyle: CSSProperties = { padding: '0.6rem 1rem', fontSize: '0.9rem', color: 'white', backgroundColor: '#e53e3e', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background-color 0.2s', };
  const logoutButtonHoverStyle: CSSProperties = { backgroundColor: '#c53030' };
  const statusToggleStyle: CSSProperties = { width: '100%', padding: '0.875rem', fontSize: '1rem', fontWeight: '600', color: 'white', backgroundColor: isOnline ? 'rgba(72, 187, 120, 0.9)' : 'rgba(160, 174, 192, 0.9)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.15)', transition: 'background-color 0.3s', pointerEvents: 'auto', };
  const statusIconStyle: CSSProperties = { width: '1rem', height: '1rem', [isRTL ? 'marginLeft' : 'marginRight']: '0.5rem', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '50%', display: 'inline-block', };
  const cardsAreaStyle: CSSProperties = { flexGrow: 1, overflowY: 'auto', pointerEvents: 'auto', paddingBottom: '1rem', WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 30px), transparent 100%)', maskImage: 'linear-gradient(to bottom, black calc(100% - 30px), transparent 100%)', };
  const cardStyle: CSSProperties = { backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '1rem', };
  const cardTitleStyle: CSSProperties = { fontSize: '1rem', fontWeight: '600', color: '#2d3748', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', };
  const earningsTextStyle: CSSProperties = { fontSize: '1.3rem', fontWeight: 'bold', color: '#2c7a7b', textAlign: 'center', marginBottom: '0.5rem', };
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

  return (
    <div style={driverDashboardPageStyle}>
      <div ref={mapContainerRef} style={mapBackgroundStyle} />
      <div style={contentOverlayStyle}>
        <header style={headerStyle}>
          <h1 style={headerTitleStyle}>{t.driverDashboardTitle}</h1>
          <div style={headerActionsStyle}>
            <button style={headerButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = headerButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = headerButtonStyle.backgroundColor!)} onClick={() => setShowIncomingDrawer(true)} aria-haspopup="true" aria-expanded={showIncomingDrawer} > <ListIcon style={{fontSize: '1.1rem'}}/> {t.requestsButton} {timedOutOrDeclinedRequests.length > 0 && <span style={badgeStyle}>{timedOutOrDeclinedRequests.length}</span>} </button>
            <button style={headerButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = headerButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = headerButtonStyle.backgroundColor!)} onClick={() => setShowCurrentTripDrawer(true)} aria-haspopup="true" aria-expanded={showCurrentTripDrawer} disabled={!currentTrip} > <CarIcon style={{fontSize: '1.1rem'}}/> {t.activeTripButton} </button>
            <button style={headerButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = headerButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = headerButtonStyle.backgroundColor!)} onClick={() => setShowProfileModal(true)} aria-label={t.profileButtonAriaLabel} > <ProfileIcon style={{fontSize: '1.1rem'}}/> </button>
            <button style={logoutButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = logoutButtonHoverStyle.backgroundColor!)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = logoutButtonStyle.backgroundColor!)} onClick={onLogout} > {t.logoutButton} </button>
          </div>
        </header>
        <button style={statusToggleStyle} onClick={toggleOnlineStatus}> <span style={statusIconStyle}></span> {isOnline ? t.driverStatusOnline : t.driverStatusOffline} </button>
        <div style={cardsAreaStyle}> {!isOnline && !currentTrip && ( <div style={{...cardStyle, backgroundColor: 'rgba(230, 255, 250, 0.9)', border: '1px solid #38b2ac', textAlign: 'center'}}> <p style={{color: '#2c7a7b', fontWeight: 500}}>{t.goOnlinePrompt}</p> </div> )} <div style={cardStyle}> <h2 style={cardTitleStyle}>{t.dailyEarningsTitle}</h2> <p style={earningsTextStyle}> {t.earningsAmountUnit.replace('{amount}', dailyEarnings.toLocaleString(isRTL ? 'fa-IR' : 'en-US'))} </p> </div> </div>
      </div>
      <button style={gpsFabStyle} onClick={handleLocateDriver} aria-label={t.gpsButtonAriaLabel} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'} > <GpsIcon style={{ color: '#007AFF', width: '1.75rem', height: '1.75rem' }} /> </button>
      {requestInPopup && isOnline && ( <NewRideRequestPopup currentLang={currentLang} request={requestInPopup} allAppServices={allAppServices} timer={popupTimer} onAccept={handleAcceptRequestFromPopup} onDecline={handleDeclineRequestFromPopup} /> )}
      <DriverProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} currentLang={currentLang} loggedInUserId={loggedInUserId} />
      <DrawerPanel currentLang={currentLang} isOpen={showIncomingDrawer} onClose={() => setShowIncomingDrawer(false)} title={t.incomingRequestsDrawerTitle} side={isRTL ? 'right' : 'left'} >
        {isLoadingAllPending && <p style={loadingTextStyle}>{t.loadingRequests}</p>}
        {fetchError && !isLoadingAllPending && <p style={errorTextStyle}>{fetchError}</p>}
        {!isLoadingAllPending && !fetchError && timedOutOrDeclinedRequests.length === 0 && ( <p style={noDataTextStyle}>{t.noDeclinedRequests}</p> )}
        {!isLoadingAllPending && !fetchError && timedOutOrDeclinedRequests.length > 0 && ( timedOutOrDeclinedRequests.map((req) => ( <div key={req.id} style={requestItemStyle}> <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestPassengerLabel}:</span> <span style={requestValueStyle}>{req.passenger_name || (isRTL ? 'نامشخص' : 'N/A')}</span> </div> <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFromLabel}:</span> <span style={requestValueStyle} title={req.origin_address}>{req.origin_address}</span> </div> <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestToLabel}:</span> <span style={requestValueStyle} title={req.destination_address}>{req.destination_address}</span> </div> <div style={requestDetailRowStyle}> <span style={requestLabelStyle}>{t.requestFareLabel}:</span> <span style={requestFareStyle}> {t.earningsAmountUnit.replace('{amount}', (req.estimated_fare ?? 0).toLocaleString(isRTL ? 'fa-IR' : 'en-US'))} </span> </div> <button style={acceptingRequestId === req.id ? {...acceptButtonStyle, ...acceptButtonDisabledStyle} : acceptButtonStyle} onMouseEnter={(e) => {if (acceptingRequestId !== req.id) e.currentTarget.style.backgroundColor = acceptButtonHoverStyle.backgroundColor!}} onMouseLeave={(e) => {if (acceptingRequestId !== req.id) e.currentTarget.style.backgroundColor = acceptButtonStyle.backgroundColor!}} onClick={() => handleAcceptRequestFromDrawer(req.id)} disabled={acceptingRequestId === req.id} > {acceptingRequestId === req.id ? (isRTL ? "در حال پردازش..." : "Processing...") : t.acceptRideButton} </button> </div> )) )}
      </DrawerPanel>
      <DrawerPanel currentLang={currentLang} isOpen={showCurrentTripDrawer} onClose={() => setShowCurrentTripDrawer(false)} title={t.currentTripDrawerTitle} side={isRTL ? 'right' : 'left'} >
        {currentTrip ? (
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
        ) : ( <p style={noDataTextStyle}>{t.noActiveTrip}</p> )}
      </DrawerPanel>
    </div>
  );
};
