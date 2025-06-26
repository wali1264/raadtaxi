import React, { useState, useEffect, useRef, CSSProperties, useCallback, useContext } from 'react'; // Added useContext
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
// translations and Language removed, will get t from context
import { APP_USER_AGENT } from '../config';
// AppService, AppServiceCategory removed, will get from context
import { RideRequest, DriverDetails, TripPhase, TripSheetDisplayLevel, DriverSearchState, AppService } from '../types'; 
import { debounce, getDistanceFromLatLonInKm } from '../utils/helpers';
import { ServiceSelectionSheet } from '../components/ServiceSelectionSheet';
import { DriverSearchSheet } from '../components/DriverSearchSheet';
import { TripInProgressSheet } from '../components/TripInProgressSheet';
import { LocationMarkerIcon, DestinationMarkerIcon, HomeIcon, ProfileIcon, GpsIcon, SearchIcon, BackArrowIcon, ChevronDownIcon, CloseIcon, DriverCarIcon } from '../components/icons';
import { AppContext, useAppContext } from '../contexts/AppContext'; // Import AppContext and useAppContext
import { userService } from '../services/userService'; // Import userService

interface MapScreenProps {
  onNavigateToProfile: () => void;
}

const PASSENGER_REQUEST_TIMEOUT_MS = 90000; // 90 seconds

export const MapScreen: React.FC<MapScreenProps> = ({ onNavigateToProfile }) => {
  const { 
    currentLang, 
    loggedInUserId, 
    loggedInUserFullName, 
    allAppServices, 
    appServiceCategories, 
    isLoadingServicesGlobal, 
    serviceFetchErrorGlobal, 
    t 
  } = useAppContext();
  
  const isRTL = currentLang !== 'en';
  const mapContainerRef = useRef<HTMLDivElement>(null); const mapInstanceRef = useRef<L.Map | null>(null);
  const fixedMarkerRef = useRef<HTMLDivElement>(null);
  const [selectionMode, setSelectionMode] = useState<'origin' | 'destination'>('origin');
  const [confirmedOrigin, setConfirmedOrigin] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [confirmedDestination, setConfirmedDestination] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [address, setAddress] = useState<string>(''); const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(true); const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [serviceFor, setServiceFor] = useState<'self' | 'other'>('self');
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false); const serviceDropdownRef = useRef<HTMLDivElement>(null);

  const [showServiceSheet, setShowServiceSheet] = useState<boolean>(false);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState<boolean>(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  const [showDriverSearchSheet, setShowDriverSearchSheet] = useState<boolean>(false);
  const [driverSearchState, setDriverSearchState] = useState<DriverSearchState>('idle');
  const [notifiedDriverCount, setNotifiedDriverCount] = useState<number>(0);
  const [selectedServiceForSearch, setSelectedServiceForSearch] = useState<AppService | null>(null);
  const [currentRideRequestId, setCurrentRideRequestId] = useState<string | null>(null);
  const rideRequestChannelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const passengerRequestTimeoutRef = useRef<number | null>(null);


  const [showTripInProgressSheet, setShowTripInProgressSheet] = useState<boolean>(false);
  const [tripSheetDisplayLevel, setTripSheetDisplayLevel] = useState<TripSheetDisplayLevel>('peek');
  const [currentTripFare, setCurrentTripFare] = useState<number | null>(null);
  const [currentDriverDetails, setCurrentDriverDetails] = useState<DriverDetails | null>(null);


  const [originMapMarker, setOriginMapMarker] = useState<L.Marker | null>(null);
  const [destinationMapMarker, setDestinationMapMarker] = useState<L.Marker | null>(null);
  // const [driverMarker, setDriverMarker] = useState<L.Marker | null>(null); // Replaced by driverMarkerRef
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const driverLocationChannelRef = useRef<RealtimeChannel | null>(null);
  
  const [tripPhase, setTripPhase] = useState<TripPhase>(null);
  const [estimatedTimeToDestination, setEstimatedTimeToDestination] = useState<number | null>(null);
  
  const debouncedUpdateAddressRef = useRef<((map: L.Map) => Promise<void>) | undefined>(undefined);
  const updateAddressFromMapCenter = useCallback(async (map: L.Map) => {
    if (showDriverSearchSheet || showTripInProgressSheet) return; setIsLoadingAddress(true); setSearchQuery(t.addressLoading); setSearchError(''); const center = map.getCenter();
    try { const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&accept-language=${currentLang}&zoom=18`, { headers: { 'User-Agent': APP_USER_AGENT } }); if (!response.ok) throw new Error('Network response was not ok'); const data = await response.json(); if (data && data.display_name) { setAddress(data.display_name); setSearchQuery(data.display_name); } else { setAddress(t.addressNotFound); setSearchQuery(t.addressNotFound); } } catch (error) { console.error("Error fetching address:", error); setAddress(t.addressError); setSearchQuery(t.addressError); } finally { setIsLoadingAddress(false); }
  }, [currentLang, t.addressLoading, t.addressNotFound, t.addressError, showDriverSearchSheet, showTripInProgressSheet, t]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !mapInstanceRef.current || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) return; setIsSearching(true); setSearchError(''); const map = mapInstanceRef.current;
    try { const bounds = map.getBounds(); const viewbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`; const response = await fetch( `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=af&accept-language=${currentLang}&limit=1&viewbox=${viewbox}&bounded=1`, { headers: { 'User-Agent': APP_USER_AGENT } } ); if (!response.ok) { throw new Error(`Nominatim API error: ${response.statusText}`); } const results = await response.json(); if (results && results.length > 0) { const firstResult = results[0]; const { lat, lon } = firstResult; map.setView([parseFloat(lat), parseFloat(lon)], 16); } else { setSearchError(t.searchNoResults); } } catch (error) { console.error("Error during forward geocoding search:", error); setSearchError(t.searchApiError); } finally { setIsSearching(false); }
  }, [searchQuery, currentLang, t.searchNoResults, t.searchApiError, showServiceSheet, showDriverSearchSheet, showTripInProgressSheet, t]);

  useEffect(() => { if (mapContainerRef.current && !mapInstanceRef.current) { const initialView: L.LatLngExpression = [34.5553, 69.2075]; const newMap = L.map(mapContainerRef.current, { center: initialView, zoom: 13, zoomControl: false, attributionControl: false, }); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(newMap); mapInstanceRef.current = newMap; setSearchQuery(t.addressLoading); } return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; }; }, [t.addressLoading]);
  useEffect(() => { const currentDebouncedUpdate = debounce((map: L.Map) => { return updateAddressFromMapCenter(map); }, 750); debouncedUpdateAddressRef.current = currentDebouncedUpdate; const map = mapInstanceRef.current; if (!map) return; if (!showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet) { currentDebouncedUpdate(map).catch(err => console.error("Initial debounced call failed:", err)); } const handleMoveEnd = () => { if (!showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet) { currentDebouncedUpdate(map).catch(err => console.error("Debounced move_end call failed:", err)); } }; map.on('moveend', handleMoveEnd); return () => { map.off('moveend', handleMoveEnd); }; }, [updateAddressFromMapCenter, showServiceSheet, showDriverSearchSheet, showTripInProgressSheet]);
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) { setIsServiceDropdownOpen(false); } }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);

  // Effect for managing origin and destination markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showTripInProgressSheet && confirmedOrigin) {
        if (!originMapMarker) {
            const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FFD700" style={{filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))'}} />);
            const originIcon = L.divIcon({ html: originIconHTML, className: 'origin-trip-marker', iconSize: [40, 40], iconAnchor: [20, 40] });
            const newOriginMarker = L.marker([confirmedOrigin.lat, confirmedOrigin.lng], { icon: originIcon }).addTo(map);
            setOriginMapMarker(newOriginMarker);
        }
    } else {
        if (originMapMarker && map.hasLayer(originMapMarker)) {
            map.removeLayer(originMapMarker);
            setOriginMapMarker(null);
        }
    }

    if (showTripInProgressSheet && confirmedDestination) {
        if (!destinationMapMarker) {
            const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#000000" style={{filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))'}} />);
            const destinationIcon = L.divIcon({ html: destIconHTML, className: 'destination-trip-marker', iconSize: [40, 40], iconAnchor: [20, 20] });
            const newDestMarker = L.marker([confirmedDestination.lat, confirmedDestination.lng], { icon: destinationIcon }).addTo(map);
            setDestinationMapMarker(newDestMarker);
        }
    } else {
        if (destinationMapMarker && map.hasLayer(destinationMapMarker)) {
            map.removeLayer(destinationMapMarker);
            setDestinationMapMarker(null);
        }
    }
    // Note: Driver marker and associated fitBounds logic is now in its own dedicated useEffect below.
    // Cleanup for origin/destination markers is handled by their respective 'else' blocks above.
  }, [showTripInProgressSheet, confirmedOrigin, confirmedDestination, mapInstanceRef.current]);


  // Effect for real-time driver tracking
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const driverId = currentDriverDetails?.driverId;

    if (showTripInProgressSheet && driverId && confirmedOrigin) {
        const initializeAndTrack = async () => {
            let initialLatLng: L.LatLng | null = null;
            try {
                const { data: locationData, error: locationError } = await supabase
                    .from('driver_locations')
                    .select('latitude, longitude, heading')
                    .eq('driver_id', driverId)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .single();

                if (locationError && locationError.code !== 'PGRST116') {
                    console.error("Error fetching initial driver location:", locationError);
                }
                if (locationData) {
                    initialLatLng = L.latLng(locationData.latitude, locationData.longitude);
                } else {
                    initialLatLng = L.latLng(confirmedOrigin.lat, confirmedOrigin.lng); 
                    console.warn(`No initial location for driver ${driverId}, using passenger origin.`);
                }
            } catch (e) {
                console.error("Exception fetching initial driver location:", e);
                initialLatLng = L.latLng(confirmedOrigin.lat, confirmedOrigin.lng);
            }

            if (initialLatLng) {
                if (!driverMarkerRef.current) {
                    const carIconHTML = ReactDOMServer.renderToString(<DriverCarIcon />);
                    const carIcon = L.divIcon({ html: carIconHTML, className: 'driver-car-icon', iconSize: [40, 40], iconAnchor: [20, 20] });
                    driverMarkerRef.current = L.marker(initialLatLng, {
                        icon: carIcon,
                        zIndexOffset: 1000,
                    }).addTo(map);
                } else {
                    driverMarkerRef.current.setLatLng(initialLatLng);
                }
            }

            if (driverLocationChannelRef.current) {
                 supabase.removeChannel(driverLocationChannelRef.current);
            }
            driverLocationChannelRef.current = supabase
                .channel(`driver_location_${driverId}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}`
                }, (payload) => {
                    const newLocation = payload.new as { latitude: number, longitude: number, heading?: number };
                    if (newLocation && driverMarkerRef.current) {
                        const newPos = L.latLng(newLocation.latitude, newLocation.longitude);
                        driverMarkerRef.current.setLatLng(newPos);
                        
                        if (tripPhase === 'enRouteToDestination' && confirmedDestination) {
                             const destPos = L.latLng(confirmedDestination.lat, confirmedDestination.lng);
                             const distToDest = newPos.distanceTo(destPos);
                             const estimatedMinutes = Math.round((distToDest / 1000) * 2.0 + 3); // km * 2 min/km + 3 min buffer
                             setEstimatedTimeToDestination(Math.max(1, estimatedMinutes));
                        }
                        
                        const boundsToShowUpdate: L.LatLngExpression[] = [];
                        if (confirmedOrigin) boundsToShowUpdate.push(L.latLng(confirmedOrigin.lat, confirmedOrigin.lng));
                        if (confirmedDestination) boundsToShowUpdate.push(L.latLng(confirmedDestination.lat, confirmedDestination.lng));
                        boundsToShowUpdate.push(newPos);
                        if (map && boundsToShowUpdate.length >= 2) {
                           map.fitBounds(L.latLngBounds(boundsToShowUpdate), { padding: [80, 80], maxZoom: 17, animate: true });
                        }
                    }
                })
                .subscribe(status => {
                    if (status === 'SUBSCRIBED') console.log(`Subscribed to location for driver ${driverId}`);
                    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error(`Subscription error for driver ${driverId}: ${status}`);
                });

            const boundsToShowInitial: L.LatLngExpression[] = [];
            if (confirmedOrigin) boundsToShowInitial.push(L.latLng(confirmedOrigin.lat, confirmedOrigin.lng));
            if (confirmedDestination) boundsToShowInitial.push(L.latLng(confirmedDestination.lat, confirmedDestination.lng));
            if (driverMarkerRef.current) boundsToShowInitial.push(driverMarkerRef.current.getLatLng());
            
            if (boundsToShowInitial.length >= 2) {
                map.fitBounds(L.latLngBounds(boundsToShowInitial), { padding: [70, 70], maxZoom: 17, animate: true });
            }
        };
        initializeAndTrack();
    } else {
        if (driverMarkerRef.current && map.hasLayer(driverMarkerRef.current)) {
            map.removeLayer(driverMarkerRef.current);
            driverMarkerRef.current = null;
        }
        if (driverLocationChannelRef.current) {
            supabase.removeChannel(driverLocationChannelRef.current);
            driverLocationChannelRef.current = null;
        }
        setEstimatedTimeToDestination(null);
    }

    return () => { // Cleanup for this specific effect
        if (driverMarkerRef.current && map?.hasLayer(driverMarkerRef.current)) {
            map.removeLayer(driverMarkerRef.current);
            driverMarkerRef.current = null;
        }
        if (driverLocationChannelRef.current) {
            supabase.removeChannel(driverLocationChannelRef.current);
            driverLocationChannelRef.current = null;
        }
    };
  }, [
    mapInstanceRef.current, 
    showTripInProgressSheet, 
    currentDriverDetails?.driverId, 
    confirmedOrigin, 
    confirmedDestination, 
    tripPhase, 
    supabase // supabase client directly, not from context
  ]);
  
  const handleGpsClick = () => { if (navigator.geolocation && mapInstanceRef.current && !showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet) { const map = mapInstanceRef.current; navigator.geolocation.getCurrentPosition( (position) => { const userLatLng: L.LatLngExpression = [position.coords.latitude, position.coords.longitude]; map.setView(userLatLng, 15); if (debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(map).catch(err => console.error("Debounced GPS click call failed:", err)); } }, (error: GeolocationPositionError) => { console.error("Error getting GPS location:", error); alert("Unable to retrieve your location. Please ensure location services are enabled."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } ); } };
  const calculateRouteDistance = async (origin: {lat: number, lng: number}, destination: {lat: number, lng: number}) => { setIsCalculatingDistance(true); setDistanceError(null); setRouteDistanceKm(null); try { const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`, { headers: { 'User-Agent': APP_USER_AGENT } }); if (!response.ok) { throw new Error(`OSRM API error: ${response.status} ${response.statusText}`); } const data = await response.json(); if (data.routes && data.routes.length > 0 && data.routes[0].distance) { const distanceInKm = data.routes[0].distance / 1000; setRouteDistanceKm(distanceInKm); } else { throw new Error("No route found or distance missing in OSRM response."); } } catch (error) { console.error("Error calculating route distance:", error); setDistanceError(t.priceCalculationError); } finally { setIsCalculatingDistance(false); } };
  const handleConfirmOriginOrDestination = () => { if (isLoadingAddress || isSearching || !mapInstanceRef.current || !address || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) return; const currentMap = mapInstanceRef.current; const center = currentMap.getCenter(); const currentValidAddress = address; if (selectionMode === 'origin') { setConfirmedOrigin({ lat: center.lat, lng: center.lng, address: currentValidAddress }); setSelectionMode('destination'); setSearchQuery(''); setAddress(''); setSearchError(''); if (debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(currentMap).catch(err => console.error("Update address for dest failed:", err)); } } else { const destDetails = { lat: center.lat, lng: center.lng, address: currentValidAddress }; setConfirmedDestination(destDetails); if(confirmedOrigin) { calculateRouteDistance( {lat: confirmedOrigin.lat, lng: confirmedOrigin.lng}, {lat: destDetails.lat, lng: destDetails.lng} ).finally(() => { setShowServiceSheet(true); }); } else { setDistanceError("Origin not confirmed."); setShowServiceSheet(true); } } };

  const startDriverSearchProcess = async (service: AppService, originLoc: {lat: number, lng: number, address: string}, destLoc: {lat: number, lng: number, address: string}, estimatedPrice: number | null) => {
    if (!loggedInUserId) {
        console.error("User not logged in. Cannot create ride request.");
        alert(t.rideRequestCreationError + " (User not logged in)");
        setDriverSearchState('noDriverFound');
        return;
    }

    let passengerNameForRequest = loggedInUserFullName;
    if (!passengerNameForRequest) {
        passengerNameForRequest = t.defaultPassengerName;
    }

    setDriverSearchState('searching');
    setShowDriverSearchSheet(true);
    setCurrentRideRequestId(null);

    try {
        const rideData = await userService.createRideRequest({
            passenger_id: loggedInUserId,
            passenger_name: passengerNameForRequest,
            origin_address: originLoc.address,
            destination_address: destLoc.address,
            origin_lat: originLoc.lat,
            origin_lng: originLoc.lng,
            destination_lat: destLoc.lat,
            destination_lng: destLoc.lng,
            service_id: service.id,
            estimated_fare: estimatedPrice,
            status: 'pending'
        });
        
        console.log('Ride request created:', rideData);
        setCurrentRideRequestId(rideData.id);
        setDriverSearchState('awaiting_driver_acceptance');

    } catch (error: any) {
        console.error('Error creating ride request (raw object):', error);
        let finalAlertMessage = t.rideRequestCreationError;
        if (error) {
            let detailsForAlert = "An error occurred.";
            let actualCodePrefix = "";
            const errObj = error as any;
            if (errObj.message) {
                if (typeof errObj.message === 'string' && errObj.message.trim() !== '') detailsForAlert = errObj.message;
                else if (typeof errObj.message === 'object') detailsForAlert = "Received complex error message object; please check console for full details.";
            }
            if (errObj.code != null) {
                if (typeof errObj.code === 'string' || typeof errObj.code === 'number') actualCodePrefix = `Code ${errObj.code}: `;
                else { console.warn("Error code is a complex type:", errObj.code); actualCodePrefix = `Code (see console): `; }
            }
            finalAlertMessage += ` (${actualCodePrefix}${detailsForAlert})`;
        }
        alert(finalAlertMessage);
        setDriverSearchState('noDriverFound');
        setShowDriverSearchSheet(true);
    }
  };

  const clearPassengerRequestTimeout = useCallback(() => {
    if (passengerRequestTimeoutRef.current) {
        clearTimeout(passengerRequestTimeoutRef.current);
        passengerRequestTimeoutRef.current = null;
        console.log('[MapScreen Timeout] Passenger request timeout cleared.');
    }
  }, []);
  
  const handleDriverAssigned = useCallback((updatedRequest: RideRequest) => {
    console.log('[MapScreen handleDriverAssigned] Triggered for request:', updatedRequest);
    clearPassengerRequestTimeout(); // Clear timeout as driver is assigned
    const driverServiceId = selectedServiceForSearch?.id || 'car'; 
    
    const assignedDriverDetails: DriverDetails = {
        name: updatedRequest.driver_id ? `${t.roleDriver} ${updatedRequest.driver_id.substring(0,6)}` : t.roleDriver,
        serviceId: driverServiceId,
        vehicleColor: t.defaultServiceName, 
        plateParts: { region: "N/A", numbers: "00000", type: "-" }, 
        profilePicUrl: undefined, 
        driverId: updatedRequest.driver_id
    };
    setCurrentDriverDetails(assignedDriverDetails);

    setDriverSearchState('driverAssigned');
    setShowDriverSearchSheet(false);
    setShowTripInProgressSheet(true);
    setTripPhase('enRouteToOrigin'); 
    setTripSheetDisplayLevel('peek');

    if (rideRequestChannelRef.current) {
        console.log(`[MapScreen handleDriverAssigned] Removing Realtime channel for ride ID: ${currentRideRequestId}`);
        supabase.removeChannel(rideRequestChannelRef.current);
        rideRequestChannelRef.current = null;
    }
    if (pollingIntervalRef.current) {
        console.log(`[MapScreen handleDriverAssigned] Clearing polling interval for ride ID: ${currentRideRequestId}`);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
    }
  }, [selectedServiceForSearch, t.roleDriver, currentRideRequestId, supabase, t.defaultServiceName, t, clearPassengerRequestTimeout]);


  const pollRideRequestStatus = useCallback(async (rideRequestId: string) => {
    if (driverSearchState !== 'awaiting_driver_acceptance') {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        clearPassengerRequestTimeout();
        return;
    }
    console.log(`[MapScreen Polling] Polling status for ride ID: ${rideRequestId}`);
    try {
        const polledRequest = await userService.fetchRideRequestById(rideRequestId);

        if (polledRequest) {
            console.log('[MapScreen Polling] Polled Request Data:', polledRequest);

            if (polledRequest.status === 'accepted' && polledRequest.driver_id) {
                if (driverSearchState === 'awaiting_driver_acceptance') {
                    console.log('[MapScreen Polling] CONDITION MET VIA POLLING: Ride accepted by driver!', polledRequest);
                    handleDriverAssigned(polledRequest);
                }
            } else if (['cancelled_by_driver', 'no_drivers_available', 'cancelled_by_passenger', 'timed_out_passenger'].includes(polledRequest.status)) {
                 if (driverSearchState === 'awaiting_driver_acceptance') {
                    console.log(`[MapScreen Polling] Ride status is terminal (${polledRequest.status}), updating UI.`);
                    setDriverSearchState('noDriverFound');
                    clearPassengerRequestTimeout();
                     if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                    if (rideRequestChannelRef.current) {
                        supabase.removeChannel(rideRequestChannelRef.current);
                        rideRequestChannelRef.current = null;
                    }
                 }
            } else {
                console.log(`[MapScreen Polling] Status not 'accepted' or no driver_id. Status: ${polledRequest.status}, Driver ID: ${polledRequest.driver_id}`);
            }
        }
    } catch (e) {
        console.error('[MapScreen Polling] Exception during pollRideRequestStatus:', e);
    }
  }, [supabase, driverSearchState, handleDriverAssigned, clearPassengerRequestTimeout]);


  useEffect(() => {
    if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) {
        console.log(`[MapScreen Realtime/Timeout] Setting up listener and timeout for ride ID: ${currentRideRequestId}`);
        
        clearPassengerRequestTimeout(); // Clear any pre-existing timeout for this ref
        passengerRequestTimeoutRef.current = window.setTimeout(async () => {
            if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) { // Double check state
                console.log(`[MapScreen Timeout] Passenger request ${currentRideRequestId} timed out.`);
                try {
                    await userService.updateRide(currentRideRequestId, { status: 'no_drivers_available' }); 
                    // The Realtime/Polling listener should pick this up and set state to noDriverFound
                } catch (error) {
                    console.error("[MapScreen Timeout] Error updating ride to 'no_drivers_available' on timeout:", error);
                    // Fallback UI update if DB update fails or isn't picked up quickly
                    setDriverSearchState('noDriverFound');
                }
            }
        }, PASSENGER_REQUEST_TIMEOUT_MS);
        console.log(`[MapScreen Timeout] Timeout of ${PASSENGER_REQUEST_TIMEOUT_MS}ms set for ride ${currentRideRequestId}.`);


        if (rideRequestChannelRef.current) {
            console.log(`[MapScreen Realtime] Removing existing channel for ride ID: ${currentRideRequestId}`);
            supabase.removeChannel(rideRequestChannelRef.current);
            rideRequestChannelRef.current = null;
        }

        const channel = supabase
            .channel(`ride_request_updates_${currentRideRequestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'ride_requests',
                    filter: `id=eq.${currentRideRequestId}`
                },
                (payload) => {
                    console.log('[MapScreen Realtime] Raw Payload Received:', payload);
                    const updatedRequest = payload.new as RideRequest;
                    console.log('[MapScreen Realtime] Parsed Updated Request:', updatedRequest);

                    if (driverSearchState !== 'awaiting_driver_acceptance') {
                        console.log('[MapScreen Realtime] State no longer awaiting, ignoring stale Realtime event. Clearing timeout.');
                        clearPassengerRequestTimeout();
                        if (rideRequestChannelRef.current) {
                             supabase.removeChannel(rideRequestChannelRef.current);
                             rideRequestChannelRef.current = null;
                        }
                        return;
                    }

                    if (updatedRequest.status === 'accepted' && updatedRequest.driver_id) {
                        console.log('[MapScreen Realtime] CONDITION MET: Ride accepted by driver!', updatedRequest);
                        handleDriverAssigned(updatedRequest); // This will also clear the timeout
                    } else if (['cancelled_by_driver', 'no_drivers_available', 'cancelled_by_passenger', 'timed_out_passenger'].includes(updatedRequest.status)) {
                        console.log(`[MapScreen Realtime] Ride cancelled or no drivers: ${updatedRequest.status}`);
                        setDriverSearchState('noDriverFound');
                        clearPassengerRequestTimeout();
                         if (rideRequestChannelRef.current) {
                            supabase.removeChannel(rideRequestChannelRef.current);
                            rideRequestChannelRef.current = null;
                        }
                         if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }
                    } else {
                        console.log('[MapScreen Realtime] Condition NOT met. Status:', updatedRequest.status, 'Driver ID:', updatedRequest.driver_id);
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`[MapScreen Realtime] Subscription status for ${currentRideRequestId}:`, status);
                if (status === 'SUBSCRIBED') {
                    console.log(`[MapScreen Realtime] Successfully subscribed to updates for ride request ID: ${currentRideRequestId}`);
                }
                if (status === 'CHANNEL_ERROR' || err) {
                    console.error('[MapScreen Realtime] Subscription Error for ride request:', err || 'Channel Error', `Ride ID: ${currentRideRequestId}`);
                }
                if (status === 'TIMED_OUT') {
                     console.warn('[MapScreen Realtime] Subscription Timed Out for ride request:', currentRideRequestId);
                }
            });

        rideRequestChannelRef.current = channel;

        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        console.log(`[MapScreen Polling] Starting polling for ride ID: ${currentRideRequestId} in Realtime useEffect`);
        pollingIntervalRef.current = window.setInterval(() => {
            pollRideRequestStatus(currentRideRequestId);
        }, 3000);

        return () => {
            clearPassengerRequestTimeout();
            if (rideRequestChannelRef.current) {
                console.log(`[MapScreen Realtime Cleanup] Removing channel for ride ID: ${currentRideRequestId}`);
                supabase.removeChannel(rideRequestChannelRef.current);
                rideRequestChannelRef.current = null;
            }
            if (pollingIntervalRef.current) {
                 console.log(`[MapScreen Polling Cleanup] Clearing polling interval for ride ID: ${currentRideRequestId} in Realtime useEffect cleanup`);
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    } else {
         clearPassengerRequestTimeout(); // Ensure timeout is cleared if state changes away from awaiting_driver_acceptance
         if (rideRequestChannelRef.current) {
            console.log(`[MapScreen Realtime Cleanup] State not awaiting or no ride ID, removing channel. State: ${driverSearchState}`);
            supabase.removeChannel(rideRequestChannelRef.current);
            rideRequestChannelRef.current = null;
        }
        if (pollingIntervalRef.current) {
            console.log(`[MapScreen Polling Cleanup] State not awaiting or no ride ID, clearing interval. State: ${driverSearchState}`);
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }
  }, [driverSearchState, currentRideRequestId, supabase, handleDriverAssigned, pollRideRequestStatus, clearPassengerRequestTimeout]);


  const resetToInitialMapState = () => {
    setShowDriverSearchSheet(false);
    setShowTripInProgressSheet(false);
    clearPassengerRequestTimeout();

    if (rideRequestChannelRef.current) {
      console.log(`[MapScreen Reset] Removing channel during reset for ride ID: ${currentRideRequestId}`);
      supabase.removeChannel(rideRequestChannelRef.current);
      rideRequestChannelRef.current = null;
    }
    if (pollingIntervalRef.current) {
        console.log(`[MapScreen Reset] Clearing polling interval for ride ID: ${currentRideRequestId}`);
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
    }
    
    setDriverSearchState('idle');
    setNotifiedDriverCount(0);
    setSelectionMode('origin');
    setConfirmedOrigin(null);
    setConfirmedDestination(null);
    setSearchQuery(''); setAddress(''); setRouteDistanceKm(null);
    setIsCalculatingDistance(false); setDistanceError(null);
    setSelectedServiceForSearch(null); setCurrentTripFare(null);
    setTripSheetDisplayLevel('peek');
    setTripPhase(null);
    setEstimatedTimeToDestination(null);
    setCurrentRideRequestId(null);
    setCurrentDriverDetails(null);

    const map = mapInstanceRef.current;
    if (map) { // Origin and Destination markers are handled by their own useEffect now.
      // Driver marker is handled by its dedicated useEffect's cleanup.
    }

    if (mapInstanceRef.current && debouncedUpdateAddressRef.current) {
        debouncedUpdateAddressRef.current(mapInstanceRef.current)
            .catch(err => console.error("Update address for new origin failed:", err));
    }
  };

  const handleRequestRideFromSheet = (service: AppService, originAddressText: string, destinationAddressText: string, estimatedPrice: number | null) => {
    setShowServiceSheet(false);
    setSelectedServiceForSearch(service);
    setCurrentTripFare(estimatedPrice);
    if (confirmedOrigin && confirmedDestination) {
      startDriverSearchProcess(service, confirmedOrigin, confirmedDestination, estimatedPrice);
    } else {
      console.error("Origin or destination not confirmed for ride request.");
      alert(t.rideRequestCreationError + " (Origin/Dest missing)");
    }
  };

  const handleRetryDriverSearch = () => {
    if (selectedServiceForSearch && confirmedOrigin && confirmedDestination) {
      startDriverSearchProcess(selectedServiceForSearch, confirmedOrigin, confirmedDestination, currentTripFare);
    }
  };
  const handleCancelDriverSearch = async () => {
    clearPassengerRequestTimeout(); // Clear timeout if user manually cancels
    if (currentRideRequestId) {
        console.log(`[MapScreen Cancel Search] Cancelling ride ID: ${currentRideRequestId}`);
        try {
            await userService.updateRide(currentRideRequestId, { status: 'cancelled_by_passenger' });
            console.log(`[MapScreen Cancel Search] Request ${currentRideRequestId} marked as cancelled_by_passenger`);
        } catch (error) {
            console.error("Error cancelling request in DB:", error);
        }
    }
    resetToInitialMapState();
  };
  const handleGoBackToOriginSelection = () => { setSelectionMode('origin'); setSearchError(''); setShowServiceSheet(false); setRouteDistanceKm(null); setIsCalculatingDistance(false); setDistanceError(null); if (confirmedOrigin) { setAddress(confirmedOrigin.address); setSearchQuery(confirmedOrigin.address); if (mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedOrigin.lat, confirmedOrigin.lng]); } } else if (mapInstanceRef.current && debouncedUpdateAddressRef.current) { setAddress(''); setSearchQuery(''); debouncedUpdateAddressRef.current(mapInstanceRef.current).catch(err => console.error("Update address on back failed:", err)); } };
  const handleCloseServiceSheet = () => { setShowServiceSheet(false); if (confirmedDestination && mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedDestination.lat, confirmedDestination.lng]); setAddress(confirmedDestination.address); setSearchQuery(confirmedDestination.address); setSelectionMode('destination'); setIsLoadingAddress(false); setSearchError(''); } };
  const toggleServiceDropdown = () => setIsServiceDropdownOpen(!isServiceDropdownOpen);
  const selectServiceType = (type: 'self' | 'other') => { setServiceFor(type); setIsServiceDropdownOpen(false); };

  const mapScreenContainerStyle: CSSProperties = { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#e0e0e0' };
  const leafletMapContainerStyle: CSSProperties = { width: '100%', height: '100%' };
  const fixedMarkerStyle: CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none', display: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet || !mapInstanceRef.current) ? 'none' : 'block' };
  const topControlsContainerStyle: CSSProperties = { position: 'absolute', top: '1rem', left: '1rem', right: '1rem', height: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1010, pointerEvents: 'none', };
  const topBarButtonStyle: CSSProperties = { backgroundColor: 'white', borderRadius: '50%', width: '2.75rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer', border: 'none', padding: 0, };
  const serviceTypePillContainerStyle: CSSProperties = { flexGrow: 1, display: 'flex', justifyContent: 'center', pointerEvents: 'none', visibility: (showDriverSearchSheet || showTripInProgressSheet) ? 'hidden' : 'visible', };
  const serviceTypePillStyle: CSSProperties = { backgroundColor: 'white', borderRadius: '2rem', padding: '0.5rem 1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#333', fontWeight: 500, pointerEvents: 'auto', margin: '0 auto', };
  const serviceDropdownStyle: CSSProperties = { position: 'absolute', top: 'calc(100% + 0.5rem)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 1011, minWidth: '150px', border: '1px solid #eee' };
  const serviceDropdownItemStyle: CSSProperties = { padding: '0.75rem 1rem', cursor: 'pointer', fontSize: '0.875rem', textAlign: isRTL ? 'right' : 'left' }; const serviceDropdownItemHoverStyle: CSSProperties = { backgroundColor: '#f0f0f0' };

  const getGpsButtonBottom = () => {
    if (showServiceSheet) return 'calc(70vh + 1rem)';
    if (showDriverSearchSheet) return 'calc(250px + 1rem)';
    if (showTripInProgressSheet) {
        if (tripSheetDisplayLevel === 'peek') return 'calc(180px + 1rem)';
        if (tripSheetDisplayLevel === 'default') return 'calc(320px + 1rem)';
        return 'calc(85vh + 1rem)';
    }
    return '13rem';
  };
  const gpsButtonVisibilityLogic = (showServiceSheet || showDriverSearchSheet || (showTripInProgressSheet && tripSheetDisplayLevel === 'full')) ? 'hidden' : 'visible';

  const gpsButtonStyle: CSSProperties = {
    position: 'absolute',
    bottom: getGpsButtonBottom(),
    [isRTL ? 'right' : 'left']: '1rem',
    backgroundColor: 'white',
    borderRadius: '50%',
    width: '3.25rem', height: '3.25rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    cursor: 'pointer', zIndex: 1000, border: 'none',
    transition: 'bottom 0.3s ease-out, visibility 0.3s ease-out',
    visibility: gpsButtonVisibilityLogic,
  };

  const bottomPanelStyle: CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: '1rem 1.5rem 1.5rem', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex', flexDirection: 'column', transform: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) ? 'translateY(100%)' : 'translateY(0)', visibility: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) ? 'hidden' : 'visible', transition: 'transform 0.3s ease-out, visibility 0.3s ease-out' };
  const addressInputContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: '0.5rem', padding: isRTL ? '0.75rem 1rem 0.75rem 0.5rem' : '0.75rem 0.5rem 0.75rem 1rem', marginBottom: '0.5rem' };
  const addressPointStyle: CSSProperties = { width: '10px', height: '10px', backgroundColor: selectionMode === 'origin' ? '#FFD700' : '#000000', borderRadius: selectionMode === 'origin' ? '50%' : '2px', [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', flexShrink: 0 };
  const addressInputStyle: CSSProperties = { flexGrow: 1, fontSize: '0.9rem', color: '#333', textAlign: isRTL ? 'right' : 'left', backgroundColor: 'transparent', border: 'none', outline: 'none', padding: '0 0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', };
  const searchButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0, [isRTL ? 'marginRight' : 'marginLeft'] : '0.5rem' }; const searchButtonDisabledStyle: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };
  const searchErrorStyle: CSSProperties = { fontSize: '0.75rem', color: 'red', textAlign: 'center', minHeight: '1.2em', marginBottom: '0.5rem' };
  const confirmMainButtonStyle: CSSProperties = { width: '100%', backgroundColor: selectionMode === 'destination' ? '#28a745' : '#007bff', color: 'white', border: 'none', padding: '0.875rem', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' };
  if (selectionMode === 'destination') { confirmMainButtonStyle.backgroundColor = '#28a745'; }
  const confirmMainButtonHoverStyle: CSSProperties = { backgroundColor: selectionMode === 'destination' ? '#218838' : '#0056b3' };
  if (selectionMode === 'destination') { confirmMainButtonHoverStyle.backgroundColor = '#218838'; }
  const confirmMainButtonDisabledStyle: CSSProperties = { backgroundColor: '#a5d6a7', cursor: 'not-allowed' };
  const [isConfirmMainButtonHovered, setIsConfirmMainButtonHovered] = useState(false);
  let currentConfirmMainButtonStyle = confirmMainButtonStyle;
  if (isLoadingAddress || isSearching || !address) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonDisabledStyle}; } else if (isConfirmMainButtonHovered) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonHoverStyle}; }

  const handleToggleTripSheetDisplay = () => {
    setTripSheetDisplayLevel(prevLevel => {
        if (prevLevel === 'peek') return 'default';
        if (prevLevel === 'default') return 'full';
        if (prevLevel === 'full') return 'peek';
        return 'default';
    });
  };

  return (
    <div style={mapScreenContainerStyle}>
      <div ref={mapContainerRef} style={leafletMapContainerStyle} />
      <div ref={fixedMarkerRef} style={fixedMarkerStyle} aria-live="polite" aria-atomic="true">
        {selectionMode === 'origin' ?
          <LocationMarkerIcon color="#FFD700" ariaLabel={t.originMarkerAriaLabel} /> :
          <DestinationMarkerIcon color="#000000" ariaLabel={t.destinationMarkerAriaLabel} />
        }
      </div>
      <div style={topControlsContainerStyle}>
        <div style={{ pointerEvents: 'auto' }}>
          { (showDriverSearchSheet || showTripInProgressSheet) ? ( <button style={topBarButtonStyle} onClick={handleCancelDriverSearch} aria-label={t.closeDriverSearchSheetAriaLabel}> <CloseIcon /> </button> ) : showServiceSheet ? ( <button style={topBarButtonStyle} onClick={handleCloseServiceSheet} aria-label={t.closeSheetButtonAriaLabel}> <BackArrowIcon style={{transform: isRTL ? 'scaleX(-1)' : 'none'}}/> </button> ) : selectionMode === 'destination' ? ( <button style={topBarButtonStyle} onClick={handleGoBackToOriginSelection} aria-label={t.backButtonAriaLabel}> <BackArrowIcon style={{transform: isRTL ? 'scaleX(-1)' : 'none'}}/> </button> ) : ( <button style={topBarButtonStyle} aria-label={t.homeButtonAriaLabel}><HomeIcon /></button> )}
        </div>
        <div style={serviceTypePillContainerStyle}> {!(showDriverSearchSheet || showTripInProgressSheet) && ( <div ref={serviceDropdownRef} style={{ position: 'relative', pointerEvents: 'auto' }}> <div style={serviceTypePillStyle} onClick={toggleServiceDropdown}> {serviceFor === 'self' ? t.serviceForSelf : t.serviceForOther} <ChevronDownIcon style={{ [isRTL ? 'marginRight' : 'marginLeft']: '0.5rem', transform: isServiceDropdownOpen ? 'rotate(180deg)' : '' }} /> </div> {isServiceDropdownOpen && ( <div style={serviceDropdownStyle}> <div style={serviceDropdownItemStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemStyle.backgroundColor!} onClick={() => selectServiceType('self')}>{t.serviceForSelf}</div> <div style={serviceDropdownItemStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemStyle.backgroundColor!} onClick={() => selectServiceType('other')}>{t.serviceForOther}</div> </div> )} </div> )} </div>
        <div style={{ pointerEvents: 'auto' }}>
            <button style={topBarButtonStyle} aria-label={t.profileButtonAriaLabel} onClick={onNavigateToProfile}><ProfileIcon /></button>
        </div>
      </div>
      <button style={gpsButtonStyle} onClick={handleGpsClick} aria-label={t.gpsButtonAriaLabel}><GpsIcon /></button>
      <div style={bottomPanelStyle}>
        <div style={addressInputContainerStyle}> <div style={addressPointStyle} /> <input type="text" style={addressInputStyle} value={isLoadingAddress ? t.addressLoading : (isSearching ? t.searchingAddress : searchQuery)} onChange={(e) => { setSearchQuery(e.target.value); if (searchError) setSearchError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} placeholder={selectionMode === 'origin' ? t.searchPlaceholderOrigin : t.searchPlaceholderDestination} readOnly={isLoadingAddress || isSearching} aria-label={t.searchAddressLabel} dir={isRTL ? 'rtl': 'ltr'} /> <button onClick={handleSearch} style={ (isSearching || isLoadingAddress || !searchQuery.trim()) ? {...searchButtonStyle, ...searchButtonDisabledStyle} : searchButtonStyle } disabled={isSearching || isLoadingAddress || !searchQuery.trim()} aria-label={t.searchIconAriaLabel} > <SearchIcon /> </button> </div>
        {searchError ? <p style={searchErrorStyle} role="alert">{searchError}</p> : <div style={{...searchErrorStyle, visibility: 'hidden'}}>Placeholder</div> }
        <button style={currentConfirmMainButtonStyle} onMouseEnter={() => setIsConfirmMainButtonHovered(true)} onMouseLeave={() => setIsConfirmMainButtonHovered(false)} onClick={handleConfirmOriginOrDestination} disabled={isLoadingAddress || isSearching || !address} > {selectionMode === 'origin' ? t.confirmOriginButton : t.confirmDestinationButton} </button>
      </div>
      {showServiceSheet && confirmedOrigin && confirmedDestination && ( <ServiceSelectionSheet currentLang={currentLang} originAddress={confirmedOrigin.address} destinationAddress={confirmedDestination.address} routeDistanceKm={routeDistanceKm} isCalculatingDistance={isCalculatingDistance} distanceError={distanceError} onClose={handleCloseServiceSheet} onRequestRide={handleRequestRideFromSheet} serviceCategories={appServiceCategories} isLoadingServices={isLoadingServicesGlobal} serviceFetchError={serviceFetchErrorGlobal} /> )}
      {showDriverSearchSheet && selectedServiceForSearch && ( <DriverSearchSheet currentLang={currentLang} searchState={driverSearchState} notifiedDriverCount={notifiedDriverCount} onRetry={handleRetryDriverSearch} onCancel={handleCancelDriverSearch} onClose={handleCancelDriverSearch} selectedServiceName={t[selectedServiceForSearch.nameKey] || selectedServiceForSearch.id} /> )}
      {showTripInProgressSheet && currentDriverDetails && ( <TripInProgressSheet currentLang={currentLang} driverDetails={currentDriverDetails} tripFare={currentTripFare}
        tripPhase={tripPhase} estimatedTimeToDestination={estimatedTimeToDestination}
        displayLevel={tripSheetDisplayLevel} onToggleDisplayLevel={handleToggleTripSheetDisplay}
        onCallDriver={() => console.log("Call driver clicked")} onMessageDriver={() => console.log("Message driver clicked")}
        onPayment={() => console.log("Payment clicked")}
        onChangeDestination={() => console.log("Change destination clicked (Not implemented)")}
        onApplyCoupon={() => console.log("Apply coupon clicked (Not implemented)")}
        onRideOptions={() => console.log("Ride options clicked (Not implemented)")}
        onCancelTrip={async () => { 
            console.log("Cancel trip clicked");
            clearPassengerRequestTimeout(); // Ensure timeout is cleared on manual cancel as well
            if (currentRideRequestId && currentDriverDetails?.driverId) { 
                try {
                    await userService.updateRide(currentRideRequestId, { status: 'cancelled_by_passenger' });
                    console.log(`Trip ${currentRideRequestId} marked as cancelled_by_passenger by passenger.`);
                } catch (error) {
                     console.error("Error cancelling trip in DB:", error);
                }
            }
            resetToInitialMapState();
        }}
        onSafety={() => console.log("Safety clicked (Not implemented)")}
        onClose={resetToInitialMapState}
        appServices={allAppServices} />
      )}
    </div>
  );
};
  