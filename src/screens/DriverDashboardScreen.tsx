import React, { useState, useEffect, useRef, CSSProperties, useCallback } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { supabase } from '../services/supabase';
import { RideRequest, DriverTripPhase, DriverProfileData, ChatMessage } from '../types'; 
import { NewRideRequestPopup } from '../components/NewRideRequestPopup';
import { DrawerPanel } from '../components/DrawerPanel';
import { DriverProfileModal } from '../components/DriverProfileModal';
import { CurrentTripDetailsPanel } from '../components/CurrentTripDetailsPanel'; 
import { CancellationModal } from '../components/CancellationModal';
import { AddPlaceModal } from '../components/AddPlaceModal';
import { ChatModal } from '../components/ChatModal';
import { ListIcon, CarIcon, GpsIcon, LocationMarkerIcon, DestinationMarkerIcon, ProfileIcon, DriverCarIcon, HourglassIcon, AddLocationIcon, UserPlaceMarkerIcon } from '../components/icons';
import { useAppContext } from '../contexts/AppContext';
import { profileService } from '../services';
import { getDebugMessage, getCurrentLocation } from '../utils/helpers';
import { useUserDefinedPlaces } from '../hooks/useUserDefinedPlaces';
import { useRideRequestQueue } from '../hooks/useRideRequestQueue';
import { useDriverTripManager } from '../hooks/useDriverTripManager';

const SILENT_AUDIO_DATA_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

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
    if (zoom >= 17) return 28;
    if (zoom >= 15) return 36;
    if (zoom >= 13) return 44;
    return 52;
};

export const DriverDashboardScreen = ({ onLogout }: { onLogout: () => void }): JSX.Element => {
    const { currentLang, loggedInUserId, isUserVerified, allAppServices, t, showToast } = useAppContext();
    const isRTL = currentLang !== 'en';
    
    const [isOnline, setIsOnline] = useState(false);
    const [isTogglePressed, setIsTogglePressed] = useState(false);
    const [driverProfile, setDriverProfile] = useState<Partial<DriverProfileData>>({});
    const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
    const chatToastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    
    const [showIncomingDrawer, setShowIncomingDrawer] = useState(false);
    const [showCurrentTripDrawer, setShowCurrentTripDrawer] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false); 
    const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
    const [isAddingPlace, setIsAddingPlace] = useState(false);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);

    const actualDriverGpsMarker = useRef<L.Marker | null>(null); 
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const locationWatchIdRef = useRef<number | null>(null);
    const userPlacesLayerRef = useRef<L.LayerGroup | null>(null);
    const userPlaceMarkersRef = useRef<L.Marker[]>([]);
    
    const { userDefinedPlaces, refetch: refetchUserPlaces } = useUserDefinedPlaces();
    
    const tripOriginMarkerRef = useRef<L.Marker | null>(null);
    const tripDestinationMarkerRef = useRef<L.Marker | null>(null);
    const routePolylineRef = useRef<L.Polyline | null>(null);

    const clearMapTripElements = useCallback(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        if (routePolylineRef.current) map.removeLayer(routePolylineRef.current);
        if (tripOriginMarkerRef.current) map.removeLayer(tripOriginMarkerRef.current);
        if (tripDestinationMarkerRef.current) map.removeLayer(tripDestinationMarkerRef.current);
        routePolylineRef.current = null;
        tripOriginMarkerRef.current = null;
        tripDestinationMarkerRef.current = null;
    }, []);

    const drawRouteOnMap = useCallback((coordinates: L.LatLngExpression[], color: string, fitBounds: boolean = true) => {
        const map = mapInstanceRef.current;
        if (!map || coordinates.length === 0) return;
        if (routePolylineRef.current) map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = L.polyline(coordinates, { color: color, weight: 5, opacity: 0.75 }).addTo(map);
        if (fitBounds) map.fitBounds(routePolylineRef.current.getBounds(), { padding: [50, 50], maxZoom: 17 });
    }, []);

    const drawTripMarkers = useCallback((originCoords: L.LatLngTuple, destinationCoords: L.LatLngTuple | null) => {
        const map = mapInstanceRef.current;
        if(!map) return;
        const zoom = map.getZoom();
        const baseDim = getScaledMarkerBaseDimension(zoom);
        const iconHeight = baseDim * (42 / 32);
        const iconSize: [number, number] = [baseDim, iconHeight];
        const iconAnchor: L.PointExpression = [baseDim / 2, iconHeight];
        if (tripOriginMarkerRef.current) map.removeLayer(tripOriginMarkerRef.current);
        const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FF8C00" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))', width: `${baseDim}px`, height: `${iconHeight}px` }}/>);
        tripOriginMarkerRef.current = L.marker(originCoords, { icon: L.divIcon({ html: originIconHTML, className: 'trip-origin-marker', iconSize: iconSize, iconAnchor: iconAnchor }) }).addTo(map);
        if (destinationCoords) {
            if (tripDestinationMarkerRef.current) map.removeLayer(tripDestinationMarkerRef.current);
            const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#EA4335" style={{ filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7))', width: `${baseDim}px`, height: `${iconHeight}px` }}/>);
            tripDestinationMarkerRef.current = L.marker(destinationCoords, { icon: L.divIcon({ html: destIconHTML, className: 'trip-destination-marker', iconSize: iconSize, iconAnchor: iconAnchor }) }).addTo(map);
        } else {
             if (tripDestinationMarkerRef.current) map.removeLayer(tripDestinationMarkerRef.current);
             tripDestinationMarkerRef.current = null;
        }
    }, []);

    const { tripState, tripActions } = useDriverTripManager(clearMapTripElements, drawRouteOnMap, drawTripMarkers, driverLocation);
    const { queueState, queueActions } = useRideRequestQueue(isOnline, isUserVerified, tripActions.acceptTrip);
    
    const { currentTrip, currentPassengerDetails, isCancellationModalOpen, isSubmittingCancellation, fareSummary } = tripState;
    const { requestInPopup, popupTimer, allPendingRequests, timedOutOrDeclinedRequests, isLoading, error } = queueState;

    useEffect(() => {
        const rideId = currentTrip?.id;
        const passengerName = currentPassengerDetails?.fullName || t.defaultPassengerName;
        if (rideId && !isChatModalOpen && loggedInUserId) {
            if (chatToastChannelRef.current) supabase.removeChannel(chatToastChannelRef.current);
            chatToastChannelRef.current = supabase
                .channel(`driver_chat_toast_${rideId}`)
                .on<ChatMessage>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `ride_request_id=eq.${rideId}`}, (payload) => {
                    const newMessage = payload.new;
                    if (newMessage.receiver_id === loggedInUserId) showToast(t.newChatMessageToast.replace('{name}', passengerName).replace('{message}', newMessage.message_text.substring(0, 30)), 'info');
                })
                .subscribe();
        } else {
            if (chatToastChannelRef.current) supabase.removeChannel(chatToastChannelRef.current);
        }
        return () => { if (chatToastChannelRef.current) supabase.removeChannel(chatToastChannelRef.current); };
    }, [currentTrip, isChatModalOpen, loggedInUserId, currentPassengerDetails, showToast, t]);

    useEffect(() => {
        if (mapContainerRef.current && !mapInstanceRef.current) {
            const map = L.map(mapContainerRef.current, { center: [32.3745, 62.1164], zoom: 13, zoomControl: false, attributionControl: false });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
            mapInstanceRef.current = map;
            userPlacesLayerRef.current = L.layerGroup().addTo(map);
        }
        if (loggedInUserId && !driverProfile.userId) profileService.fetchDriverProfile(loggedInUserId).then(setDriverProfile).catch(err => console.error("Error fetching driver profile:", err));
        return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } tripActions.reset(); };
    }, [loggedInUserId, tripActions.reset]);
    
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const onZoomEnd = () => userPlaceMarkersRef.current.forEach(m => map.getZoom() >= 15 ? m.openTooltip() : m.closeTooltip());
        map.on('zoomend', onZoomEnd); onZoomEnd();
        return () => { map.off('zoomend', onZoomEnd); };
    }, [mapInstanceRef.current]);

    useEffect(() => {
        const map = mapInstanceRef.current, layer = userPlacesLayerRef.current;
        if (!map || !layer) return;
        layer.clearLayers();
        userPlaceMarkersRef.current = [];
        userDefinedPlaces.forEach(place => {
            const icon = L.divIcon({ html: ReactDOMServer.renderToString(<UserPlaceMarkerIcon />), className: 'user-defined-place-icon', iconSize: [24, 38], iconAnchor: [12, 38] });
            const marker = L.marker([place.location.lat, place.location.lng], { icon }).addTo(layer).bindTooltip(place.name, { permanent: true, direction: 'right', offset: [10, -25], className: 'user-place-label' });
            userPlaceMarkersRef.current.push(marker);
        });
        if (map.getZoom() < 15) userPlaceMarkersRef.current.forEach(m => m.closeTooltip());
    }, [userDefinedPlaces, mapInstanceRef.current]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !isOnline || !loggedInUserId) { if (actualDriverGpsMarker.current) { map?.removeLayer(actualDriverGpsMarker.current); actualDriverGpsMarker.current = null; } return; }
        getCurrentLocation().then(pos => {
            const latLng = [pos.coords.latitude, pos.coords.longitude] as L.LatLngExpression;
            if (actualDriverGpsMarker.current) actualDriverGpsMarker.current.setLatLng(latLng);
            else {
                const icon = L.divIcon({ html: ReactDOMServer.renderToString(<DriverCarIcon />), className: 'actual-driver-gps-marker', iconSize: [40, 40], iconAnchor: [20, 20] });
                actualDriverGpsMarker.current = L.marker(latLng, { icon, zIndexOffset: 1000 }).addTo(map);
            }
            if (tripState.currentTripPhase === DriverTripPhase.NONE) map.setView(latLng, Math.max(map.getZoom(), 15));
        }).catch(err => console.warn("Initial GPS error:", err));
    }, [isOnline, loggedInUserId, tripState.currentTripPhase]);

    useEffect(() => {
        if (isOnline && loggedInUserId && navigator.geolocation) {
            locationWatchIdRef.current = navigator.geolocation.watchPosition(async (pos) => {
                const { latitude, longitude, heading } = pos.coords;
                setDriverLocation({ lat: latitude, lng: longitude });
                try {
                    await supabase.from('driver_locations').upsert({ driver_id: loggedInUserId, latitude, longitude, heading, timestamp: new Date().toISOString() }, { onConflict: 'driver_id' });
                    if (actualDriverGpsMarker.current) actualDriverGpsMarker.current.setLatLng([latitude, longitude]);
                } catch (e) { console.error('Driver location update failed:', e); }
            }, (err) => { if (err.code === err.PERMISSION_DENIED) { setIsOnline(false); alert(t.geolocationPermissionDenied); } }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        } else {
            setDriverLocation(null);
            if (locationWatchIdRef.current) navigator.geolocation.clearWatch(locationWatchIdRef.current);
        }
        return () => { if (locationWatchIdRef.current) navigator.geolocation.clearWatch(locationWatchIdRef.current); };
    }, [isOnline, loggedInUserId, t.geolocationPermissionDenied, supabase]);

    const toggleOnlineStatus = async () => {
        if (!loggedInUserId || !isUserVerified) { alert(t.accountNotVerifiedWarning); return; }
        const newStatus = !isOnline;
        setIsOnline(newStatus);
        try { await profileService.updateDriverOnlineStatus(loggedInUserId, newStatus); }
        catch (e) { setIsOnline(!newStatus); alert(t.errorUpdatingDriverStatus + `: ${getDebugMessage(e)}`); return; }
        if (newStatus) {
            const audioPlayer = new Audio(SILENT_AUDIO_DATA_URI);
            audioPlayer.play().catch(e => console.warn("Audio context unlock info:", e.message));
            if (!driverProfile.userId) profileService.fetchDriverProfile(loggedInUserId).then(setDriverProfile).catch(err => console.error("Profile fetch error:", err));
        }
    };
    
    const handleAddPlaceSubmit = async (placeName: string) => {
        if (!driverLocation || !loggedInUserId) { alert(isRTL ? "موقعیت فعلی شما برای ثبت مکان در دسترس نیست." : "Your current location is not available to save a place."); return; }
        setIsAddingPlace(true);
        try { await profileService.addUserDefinedPlace(placeName, driverLocation.lat, driverLocation.lng, loggedInUserId); refetchUserPlaces(); setIsAddPlaceModalOpen(false); }
        catch (error) { console.error("Error adding user-defined place:", error); } finally { setIsAddingPlace(false); }
    };

    const handleLocateDriver = async () => {
        const map = mapInstanceRef.current; if (!map) { alert(t.mapNotLoaded); return; }
        try {
            const position = await getCurrentLocation();
            map.setView([position.coords.latitude, position.coords.longitude], 16);
        } catch (error: any) { alert(t[error.code === 1 ? 'geolocationPermissionDenied' : error.code === 2 ? 'geolocationUnavailable' : 'geolocationTimeout']); }
    };

    const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', pointerEvents: 'auto', padding: '0.5rem', boxSizing: 'border-box', width: '100%', };
    const statusToggleStyle = (isPressed: boolean): CSSProperties => ({ width: '4rem', height: '4rem', backgroundColor: isOnline ? '#2ECC71' : '#95A5A6', border: `2px solid ${isOnline ? '#27AE60' : '#7F8C8D'}`, borderRadius: '50%', cursor: !isUserVerified ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: isPressed ? `inset 0 5px 15px rgba(0,0,0,0.4)` : `0 8px 15px rgba(0,0,0,0.2), inset 0 -4px 5px ${isOnline ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)'}`, transition: 'all 0.15s ease-out', transform: isPressed ? 'scale(0.95)' : 'scale(1)', opacity: !isUserVerified ? 0.6 : 1, });
    const headerActionsStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'center'};
    const iconButtonStyle = (isDisabled: boolean): CSSProperties => ({ width: '2.75rem', height: '2.75rem', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isDisabled ? 'not-allowed' : 'pointer', color: '#4A5568', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', transition: 'all 0.2s ease-out', opacity: isDisabled ? 0.6 : 1, position: 'relative', });
    const badgeStyle: CSSProperties = { position: 'absolute', top: '-2px', right: '-2px', backgroundColor: '#E53E3E', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', width: '1.25rem', height: '1.25rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white', };
    const requestItemStyle: CSSProperties = { padding: '0.8rem', border: '1px solid #edf2f7', borderRadius: '0.375rem', marginBottom: '0.75rem', backgroundColor: 'rgba(249, 250, 251, 0.95)', };
    const requestDetailRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.85rem', };
    const requestLabelStyle: CSSProperties = { color: '#718096', fontWeight: 500 };
    const requestValueStyle: CSSProperties = { color: '#2d3748', fontWeight: 600, textAlign: isRTL ? 'left' : 'right', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
    const requestFareStyle: CSSProperties = { ...requestValueStyle, color: '#38a169', fontSize: '1rem' };
    const acceptButtonStyle: CSSProperties = { width: '100%', padding: '0.6rem 1rem', marginTop: '0.5rem', fontSize: '0.9rem', color: 'white', backgroundColor: '#3182ce', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background-color 0.2s', };
    const noDataTextStyle: CSSProperties = { textAlign: 'center', color: '#718096', padding: '1rem 0', fontSize: '0.9rem' };

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', direction: isRTL ? 'rtl' : 'ltr', width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
            <div ref={mapContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }} />
            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem', boxSizing: 'border-box', maxWidth: '1400px', margin: '0 auto', backgroundColor: 'rgba(244, 246, 248, 0.0)' }}>
                <header style={headerStyle}>
                    <div style={{perspective: '500px'}}>
                        <button style={statusToggleStyle(isTogglePressed)} onClick={toggleOnlineStatus} onMouseDown={() => isUserVerified && setIsTogglePressed(true)} onMouseUp={() => setIsTogglePressed(false)} onMouseLeave={() => setIsTogglePressed(false)} onTouchStart={() => isUserVerified && setIsTogglePressed(true)} onTouchEnd={() => setIsTogglePressed(false)} disabled={!isUserVerified} aria-label={isOnline ? t.driverStatusOnline : t.driverStatusOffline}><PowerIcon style={{ color: isOnline ? '#FFF' : '#E2E8F0' }}/></button>
                    </div>
                    <div style={headerActionsStyle}>
                        <button style={iconButtonStyle(!isOnline)} onClick={() => setIsAddPlaceModalOpen(true)} aria-label={t.addText} disabled={!isOnline}><AddLocationIcon /></button>
                        <button style={iconButtonStyle(!!currentTrip)} onClick={() => setShowIncomingDrawer(true)} aria-label={t.requestsButton} disabled={!!currentTrip}><ListIcon />{allPendingRequests.length > 0 && <span style={badgeStyle}>{allPendingRequests.length}</span>}</button>
                        <button style={iconButtonStyle(!currentTrip)} onClick={() => setShowCurrentTripDrawer(true)} aria-label={t.activeTripButton} disabled={!currentTrip}><CarIcon /></button>
                        <button style={iconButtonStyle(false)} onClick={() => setShowProfileModal(true)} aria-label={t.profileButtonAriaLabel}><ProfileIcon /></button>
                        <button style={iconButtonStyle(false)} onClick={onLogout} aria-label={t.logoutButton}><LogoutIcon /></button>
                    </div>
                </header>
                <div style={{ flexGrow: 1, overflowY: 'auto', pointerEvents: 'auto', paddingTop: '1rem' }}>
                    {!isUserVerified && <div style={{ backgroundColor: 'rgba(255, 249, 230, 0.95)', border: '1px solid #FBBF24', textAlign: 'center', padding: '1rem', borderRadius: '0.5rem' }}><p style={{color: '#B45309', fontWeight: 500}}>{t.accountNotVerifiedWarning}</p></div>}
                    {!isOnline && !currentTrip && isUserVerified && <div style={{ backgroundColor: 'rgba(230, 255, 250, 0.9)', border: '1px solid #38b2ac', textAlign: 'center', padding: '1rem', borderRadius: '0.5rem' }}><p style={{color: '#2c7a7b', fontWeight: 500}}>{t.goOnlinePrompt}</p></div>}
                </div>
            </div>
            <button style={{ position: 'absolute', bottom: '1.5rem', [isRTL ? 'left' : 'right']: '1.5rem', backgroundColor: 'white', borderRadius: '50%', width: '3.25rem', height: '3.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: 1050, border: 'none' }} onClick={handleLocateDriver} aria-label={t.gpsButtonAriaLabel}><GpsIcon style={{ color: '#007AFF', width: '1.75rem', height: '1.75rem' }} /></button>
            {requestInPopup && <NewRideRequestPopup currentLang={currentLang} request={requestInPopup} allAppServices={allAppServices} timer={popupTimer} onAccept={() => queueActions.handleAccept(requestInPopup)} onDecline={() => queueActions.handleDecline(requestInPopup)} driverLocation={driverLocation} />}
            <DriverProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} currentLang={currentLang} loggedInUserId={loggedInUserId} />
            <AddPlaceModal isOpen={isAddPlaceModalOpen} onClose={() => setIsAddPlaceModalOpen(false)} onSubmit={handleAddPlaceSubmit} isSubmitting={isAddingPlace} currentLang={currentLang}/>
            <DrawerPanel currentLang={currentLang} isOpen={showIncomingDrawer} onClose={() => setShowIncomingDrawer(false)} title={t.incomingRequestsDrawerTitle} side={isRTL ? 'right' : 'left'}>
                {isLoading ? <p style={noDataTextStyle}>{t.loadingRequests}</p> : error ? <p style={{...noDataTextStyle, color: 'red'}}>{error}</p> : (allPendingRequests.length === 0 && timedOutOrDeclinedRequests.length === 0) ? <p style={noDataTextStyle}>{t.noIncomingRequests}</p> :
                (<>
                    {allPendingRequests.map((req) => (<div key={`pending-${req.id}`} style={requestItemStyle}>
                        <div style={requestDetailRowStyle}><span style={requestLabelStyle}>{t.requestPassengerLabel}:</span> <span style={requestValueStyle}>{req.passenger_name || 'N/A'}</span></div>
                        <div style={requestDetailRowStyle}><span style={requestLabelStyle}>{t.requestFromLabel}:</span> <span style={requestValueStyle} title={req.origin_address}>{req.origin_address}</span></div>
                        <div style={requestDetailRowStyle}><span style={requestLabelStyle}>{t.requestFareLabel}:</span> <span style={requestFareStyle}>{t.earningsAmountUnit.replace('{amount}', `${Math.round(req.estimated_fare ?? 0)}`)}</span></div>
                        <button style={acceptButtonStyle} onClick={() => queueActions.handleAccept(req)}>{t.acceptRideButton}</button>
                    </div>))}
                    {timedOutOrDeclinedRequests.length > 0 && <><h4 style={{...noDataTextStyle, marginTop: '1.5rem', borderTop: '1px solid #e0e0e0', paddingTop: '1rem'}}>{isRTL ? 'رد شده' : 'Declined'}</h4>{timedOutOrDeclinedRequests.map(reqId => { const req = allPendingRequests.find(r => r.id === reqId) || {id: reqId, origin_address: "Expired request", passenger_name: "N/A", estimated_fare: 0}; return (<div key={`declined-${req.id}`} style={{...requestItemStyle, opacity: 0.6}}><div style={requestDetailRowStyle}><span style={requestLabelStyle}>{t.requestPassengerLabel}:</span> <span style={requestValueStyle}>{req.passenger_name}</span></div></div>)})}</>}
                </>)}
            </DrawerPanel>
            <DrawerPanel currentLang={currentLang} isOpen={showCurrentTripDrawer} onClose={() => setShowCurrentTripDrawer(false)} title={t.currentTripDrawerTitle} side={isRTL ? 'left' : 'right'}>
                {currentTrip ? <CurrentTripDetailsPanel currentLang={currentLang} trip={currentTrip} passenger={currentPassengerDetails} isLoadingPassenger={tripState.isLoadingPassengerDetails} passengerFetchError={tripState.passengerDetailsError} currentPhase={tripState.currentTripPhase} onNavigateToPickup={tripActions.handleNavigateToPickup} onStartTrip={tripActions.handleStartTrip} onEndTrip={tripActions.handleEndTrip} onCancelTrip={tripActions.openCancellationModal} onOpenChat={() => setIsChatModalOpen(true)} /> : <p style={noDataTextStyle}>{t.noActiveTrip}</p>}
            </DrawerPanel>
            {isChatModalOpen && currentTrip && loggedInUserId && <ChatModal isOpen={isChatModalOpen} onClose={() => setIsChatModalOpen(false)} rideRequestId={currentTrip.id} otherPartyName={currentPassengerDetails?.fullName || currentTrip.passenger_name || t.defaultPassengerName} otherPartyId={currentTrip.passenger_id} />}
            {isCancellationModalOpen && currentTrip && <CancellationModal isOpen={isCancellationModalOpen} onClose={tripActions.closeCancellationModal} onSubmit={tripActions.handleDriverCancellationSubmit} userRole="driver" currentLang={currentLang} isSubmitting={isSubmittingCancellation} />}
            {fareSummary && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, direction: isRTL ? 'rtl' : 'ltr' }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.75rem', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>{t.fareToCollect.replace('{amount}', `${fareSummary.amount}`).replace('{passengerName}', fareSummary.passengerName)}</p>
                        <button style={{ width: '100%', padding: '0.875rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '0.5rem' }} onClick={() => { tripActions.setFareSummary(null); tripActions.reset(); }}>{t.okButton}</button>
                    </div>
                </div>
            )}
             {tripState.isCalculatingFare && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, direction: isRTL ? 'rtl' : 'ltr' }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <HourglassIcon />
                        <p style={{fontSize: '1.1rem', fontWeight: 500}}>{t.calculatingFare}</p>
                    </div>
                </div>
            )}
        </div>
    );
};