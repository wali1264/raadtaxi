import React, { useState, useEffect, useRef, CSSProperties, useCallback, useContext } from 'react'; // Added useContext
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { RealtimeChannel, PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
// translations and Language removed, will get t from context
import { APP_USER_AGENT } from '../config';
// AppService, AppServiceCategory removed, will get from context
import { RideRequest, DriverDetails, TripPhase, TripSheetDisplayLevel, DriverSearchState, AppService, UserRole } from '../types'; 
import { debounce, getDistanceFromLatLonInKm, getDebugMessage } from '../utils/helpers';
import { ServiceSelectionSheet } from '../components/ServiceSelectionSheet';
import { DriverSearchSheet } from '../components/DriverSearchSheet';
import { TripInProgressSheet } from '../components/TripInProgressSheet';
import { CancellationModal } from '../components/CancellationModal';
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
    isUserVerified,
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
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyPhone, setThirdPartyPhone] = useState('');
  const [thirdPartyFormError, setThirdPartyFormError] = useState('');
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
  const activeTripChannelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const passengerRequestTimeoutRef = useRef<number | null>(null);

  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [isSubmittingCancellation, setIsSubmittingCancellation] = useState(false);

  const [showTripInProgressSheet, setShowTripInProgressSheet] = useState<boolean>(false);
  const [tripSheetDisplayLevel, setTripSheetDisplayLevel] = useState<TripSheetDisplayLevel>('default');
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
    try { 
        const fetchOptions: RequestInit = {
            method: 'GET',
            mode: 'cors',
            referrerPolicy: 'strict-origin-when-cross-origin'
        };
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&accept-language=${currentLang}&zoom=18`, fetchOptions);
        if (!response.ok) throw new Error('Network response was not ok'); const data = await response.json(); if (data && data.display_name) { setAddress(data.display_name); setSearchQuery(data.display_name); } else { setAddress(t.addressNotFound); setSearchQuery(t.addressNotFound); } } catch (error) { console.error("Error fetching address:", error); setAddress(t.addressError); setSearchQuery(t.addressError); } finally { setIsLoadingAddress(false); }
  }, [currentLang, t.addressLoading, t.addressNotFound, t.addressError, showDriverSearchSheet, showTripInProgressSheet, t]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !mapInstanceRef.current || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) return; setIsSearching(true); setSearchError(''); const map = mapInstanceRef.current;
    try { 
        const bounds = map.getBounds(); const viewbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`; 
        const fetchOptions: RequestInit = {
            method: 'GET',
            mode: 'cors',
            referrerPolicy: 'strict-origin-when-cross-origin'
        };
        const response = await fetch( `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=af&accept-language=${currentLang}&limit=1&viewbox=${viewbox}&bounded=1`, fetchOptions ); 
        if (!response.ok) { throw new Error(`Nominatim API error: ${response.statusText}`); } const results = await response.json(); if (results && results.length > 0) { const firstResult = results[0]; const { lat, lon } = firstResult; map.setView([parseFloat(lat), parseFloat(lon)], 16); } else { setSearchError(t.searchNoResults); } } catch (error) { console.error("Error during forward geocoding search:", error); setSearchError(t.searchApiError); } finally { setIsSearching(false); }
  }, [searchQuery, currentLang, t.searchNoResults, t.searchApiError, showServiceSheet, showDriverSearchSheet, showTripInProgressSheet, t]);

  useEffect(() => { 
    if (mapContainerRef.current && !mapInstanceRef.current) { 
        const initialView: L.LatLngExpression = [32.3745, 62.1164]; 
        const newMap = L.map(mapContainerRef.current, { center: initialView, zoom: 13, zoomControl: false, attributionControl: false, }); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(newMap); 
        mapInstanceRef.current = newMap; 
        setSearchQuery(t.addressLoading); 
    } 
    return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; }; 
  }, [t.addressLoading]);
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
                .subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') {
                        return;
                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                        const errorDetails = err ? ` Details: ${getDebugMessage(err)}` : '';
                        console.warn(
                            `[MapScreen Realtime Warning] Subscription to driver location updates failed with status: ${status}.${errorDetails} ` +
                            `This is likely due to missing RLS policies on 'driver_locations'. ` +
                            `The driver's location on the map may not update in real-time.`
                        );
                    }
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
  
  const handleGpsClick = () => {
    if (navigator.geolocation && mapInstanceRef.current && !showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet) {
      const map = mapInstanceRef.current;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLatLng: L.LatLngExpression = [position.coords.latitude, position.coords.longitude];
          map.setView(userLatLng, 15);
          if (debouncedUpdateAddressRef.current) {
            debouncedUpdateAddressRef.current(map).catch(err => console.error("Debounced GPS click call failed:", getDebugMessage(err), err));
          }
        },
        (error: GeolocationPositionError) => {
          console.error("Error getting GPS location:", getDebugMessage(error), error);
          let message = "";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = t.geolocationPermissionDenied;
              break;
            case error.POSITION_UNAVAILABLE:
              message = t.geolocationUnavailableHintVpnOrSignal;
              break;
            case error.TIMEOUT:
              message = t.geolocationTimeout;
              break;
            default:
              message = t.geolocationUnavailable;
              break;
          }
          alert(message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };
  const calculateRouteDistance = async (origin: {lat: number, lng: number}, destination: {lat: number, lng: number}) => { setIsCalculatingDistance(true); setDistanceError(null); setRouteDistanceKm(null); try { 
    const fetchOptions: RequestInit = {
        method: 'GET',
        mode: 'cors',
        referrerPolicy: 'strict-origin-when-cross-origin'
    };
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`, fetchOptions); 
    if (!response.ok) { throw new Error(`OSRM API error: ${response.status} ${response.statusText}`); } const data = await response.json(); if (data.routes && data.routes.length > 0 && data.routes[0].distance) { const distanceInKm = data.routes[0].distance / 1000; setRouteDistanceKm(distanceInKm); } else { throw new Error("No route found or distance missing in OSRM response."); } } catch (error) { console.error("Error calculating route distance:", error); setDistanceError(t.priceCalculationError); } finally { setIsCalculatingDistance(false); } };
  const handleConfirmOriginOrDestination = () => { if (isLoadingAddress || isSearching || !mapInstanceRef.current || !address || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet) return; const currentMap = mapInstanceRef.current; const center = currentMap.getCenter(); const currentValidAddress = address; 
  if (serviceFor === 'other') {
    if (!thirdPartyName.trim()) {
        setThirdPartyFormError(t.fullNameLabel + ' ' + (isRTL ? 'الزامی است' : 'is required'));
        return;
    }
    if (!/^07[0-9]{8}$/.test(thirdPartyPhone)) {
        setThirdPartyFormError(t.invalidPhoneError);
        return;
    }
    setThirdPartyFormError('');
  }
  
  if (selectionMode === 'origin') { setConfirmedOrigin({ lat: center.lat, lng: center.lng, address: currentValidAddress }); setSelectionMode('destination'); setSearchQuery(''); setAddress(''); setSearchError(''); if (debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(currentMap).catch(err => console.error("Update address for dest failed:", err)); } } else { const destDetails = { lat: center.lat, lng: center.lng, address: currentValidAddress }; setConfirmedDestination(destDetails); if(confirmedOrigin) { calculateRouteDistance( {lat: confirmedOrigin.lat, lng: confirmedOrigin.lng}, {lat: destDetails.lat, lng: destDetails.lng} ).finally(() => { setShowServiceSheet(true); }); } else { setDistanceError("Origin not confirmed."); setShowServiceSheet(true); } } };

  const startDriverSearchProcess = async (service: AppService, originLoc: {lat: number, lng: number, address: string}, destLoc: {lat: number, lng: number, address: string}, estimatedPrice: number | null) => {
    if (!loggedInUserId) {
        console.error("User not logged in. Cannot create ride request.");
        alert(t.rideRequestCreationError + " (User not logged in)");
        setDriverSearchState('noDriverFound');
        return;
    }

    const rideRequestPayload: Omit<RideRequest, 'id' | 'created_at' | 'updated_at'> = {
        passenger_id: loggedInUserId,
        passenger_name: serviceFor === 'self' ? loggedInUserFullName : thirdPartyName.trim(),
        passenger_phone: serviceFor === 'self' ? null : thirdPartyPhone,
        is_third_party: serviceFor === 'other',
        origin_address: originLoc.address,
        origin_lat: originLoc.lat,
        origin_lng: originLoc.lng,
        destination_address: destLoc.address,
        destination_lat: destLoc.lat,
        destination_lng: destLoc.lng,
        service_id: service.id,
        estimated_fare: estimatedPrice,
        status: 'pending'
    };

    setDriverSearchState('searching');
    setShowDriverSearchSheet(true);
    setCurrentRideRequestId(null);

    try {
        const rideData = await userService.createRideRequest(rideRequestPayload);
        
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
    }
  }, []);
  
  const resetToInitialMapState = useCallback(() => {
    setShowDriverSearchSheet(false);
    setShowTripInProgressSheet(false);
    clearPassengerRequestTimeout();

    if (rideRequestChannelRef.current) {
      supabase.removeChannel(rideRequestChannelRef.current);
      rideRequestChannelRef.current = null;
    }
     if (activeTripChannelRef.current) {
        supabase.removeChannel(activeTripChannelRef.current);
        activeTripChannelRef.current = null;
    }
    if (pollingIntervalRef.current) {
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
    setTripSheetDisplayLevel('default');
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
  }, [supabase, clearPassengerRequestTimeout, currentRideRequestId]);

  const handleDriverAssigned = useCallback(async (updatedRequest: RideRequest) => {
    clearPassengerRequestTimeout();

    try {
        if (!updatedRequest.driver_id) {
            throw new Error("Driver ID is missing in the accepted request payload.");
        }
        
        const fullDriverProfile = await userService.fetchDriverProfile(updatedRequest.driver_id);
        const driverPlateNumbers = fullDriverProfile.plateNumbers;
        
        let profilePicUrl = '';
        if (fullDriverProfile.profilePicUrl) {
            try {
                const parsed = JSON.parse(fullDriverProfile.profilePicUrl);
                profilePicUrl = parsed.url || '';
            } catch (e) {
                profilePicUrl = fullDriverProfile.profilePicUrl;
            }
        }
        
        const assignedDriverDetails: DriverDetails = {
            name: fullDriverProfile.fullName || `${t.roleDriver} ${updatedRequest.driver_id.substring(0, 6)}`,
            serviceId: selectedServiceForSearch?.id || 'car',
            vehicleModel: fullDriverProfile.vehicleModel || t.dataMissing,
            vehicleColor: fullDriverProfile.vehicleColor || t.dataMissing,
            plateParts: { 
                region: fullDriverProfile.plateRegion || "N/A", 
                numbers: driverPlateNumbers || t.dataMissing, 
                type: fullDriverProfile.plateTypeChar || "-"
            }, 
            profilePicUrl: profilePicUrl,
            driverId: updatedRequest.driver_id,
            phoneNumber: fullDriverProfile.phoneNumber || t.dataMissing,
        };
        
        setCurrentDriverDetails(assignedDriverDetails);

    } catch (error) {
        console.error("Error fetching full driver details. Falling back to placeholder.", getDebugMessage(error));
        const assignedDriverDetails: DriverDetails = {
            name: updatedRequest.driver_id ? `${t.roleDriver} ${updatedRequest.driver_id.substring(0,6)}` : t.roleDriver,
            serviceId: selectedServiceForSearch?.id || 'car',
            vehicleModel: t.dataMissing,
            vehicleColor: t.defaultServiceName, 
            plateParts: { region: "N/A", numbers: t.dataMissing, type: "-" }, 
            profilePicUrl: undefined, 
            driverId: updatedRequest.driver_id,
            phoneNumber: t.dataMissing,
        };
        setCurrentDriverDetails(assignedDriverDetails);
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
    if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
    }
  }, [selectedServiceForSearch, t, supabase, clearPassengerRequestTimeout, currentRideRequestId]);


  const pollRideRequestStatus = useCallback(async (rideRequestId: string) => {
    if (driverSearchState !== 'awaiting_driver_acceptance') {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        clearPassengerRequestTimeout();
        return;
    }
    try {
        const polledRequest = await userService.fetchRideRequestById(rideRequestId);

        if (polledRequest) {

            if (polledRequest.status === 'accepted' && polledRequest.driver_id) {
                if (driverSearchState === 'awaiting_driver_acceptance') {
                    handleDriverAssigned(polledRequest);
                }
            } else if (['cancelled_by_driver', 'no_drivers_available', 'cancelled_by_passenger', 'timed_out_passenger'].includes(polledRequest.status)) {
                 if (driverSearchState === 'awaiting_driver_acceptance') {
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
            }
        }
    } catch (e) {
        console.error('[MapScreen Polling] Exception during pollRideRequestStatus:', e);
    }
  }, [supabase, driverSearchState, handleDriverAssigned, clearPassengerRequestTimeout]);


  useEffect(() => {
    if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) {
        clearPassengerRequestTimeout(); // Clear any pre-existing timeout for this ref
        passengerRequestTimeoutRef.current = window.setTimeout(async () => {
            if (driverSearchState === 'awaiting_driver_acceptance' && currentRideRequestId) { // Double check state
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

        if (rideRequestChannelRef.current) {
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
                    const updatedRequest = payload.new as RideRequest;

                    if (driverSearchState !== 'awaiting_driver_acceptance') {
                        clearPassengerRequestTimeout();
                        if (rideRequestChannelRef.current) {
                             supabase.removeChannel(rideRequestChannelRef.current);
                             rideRequestChannelRef.current = null;
                        }
                        return;
                    }

                    if (updatedRequest.status === 'accepted' && updatedRequest.driver_id) {
                        handleDriverAssigned(updatedRequest); // This will also clear the timeout
                    } else if (['cancelled_by_driver', 'no_drivers_available', 'cancelled_by_passenger', 'timed_out_passenger'].includes(updatedRequest.status)) {
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
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    return;
                }

                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                    const errorDetails = err ? ` Details: ${getDebugMessage(err)}` : '';
                    console.warn(
                        `[MapScreen Realtime Warning] Subscription to ride request updates failed with status: ${status}.${errorDetails} ` +
                        `This is likely due to missing Row-Level Security (RLS) policies on the 'ride_requests' table. ` +
                        `The application will gracefully fall back to its polling mechanism to check for updates.`
                    );
                }
            });

        rideRequestChannelRef.current = channel;

        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = window.setInterval(() => {
            pollRideRequestStatus(currentRideRequestId);
        }, 3000);

        return () => {
            clearPassengerRequestTimeout();
            if (rideRequestChannelRef.current) {
                supabase.removeChannel(rideRequestChannelRef.current);
                rideRequestChannelRef.current = null;
            }
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    } else {
         clearPassengerRequestTimeout(); // Ensure timeout is cleared if state changes away from awaiting_driver_acceptance
         if (rideRequestChannelRef.current) {
            supabase.removeChannel(rideRequestChannelRef.current);
            rideRequestChannelRef.current = null;
        }
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }
  }, [driverSearchState, currentRideRequestId, supabase, handleDriverAssigned, pollRideRequestStatus, clearPassengerRequestTimeout]);


  useEffect(() => {
    if (showTripInProgressSheet && currentRideRequestId) {
        if (activeTripChannelRef.current) {
            supabase.removeChannel(activeTripChannelRef.current);
        }
        activeTripChannelRef.current = supabase
            .channel(`active_trip_updates_${currentRideRequestId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${currentRideRequestId}`
            }, (payload) => {
                const updatedTrip = payload.new as RideRequest;
                if (updatedTrip.status === 'cancelled_by_driver') {
                    alert(t.tripCancelledByDriver);
                    resetToInitialMapState();
                } else if (updatedTrip.status === 'trip_started') {
                    setTripPhase('enRouteToDestination');
                } else if (updatedTrip.status === 'trip_completed') {
                    setTripPhase('arrivedAtDestination');
                    setCurrentTripFare(updatedTrip.actual_fare || updatedTrip.estimated_fare || null);
                }
            })
            .subscribe((status, err) => {
                if (status !== 'SUBSCRIBED') {
                    console.warn(`[MapScreen ActiveTrip] Could not subscribe to active trip updates for ${currentRideRequestId}. Status: ${status}`, err);
                }
            });
    }

    return () => {
        if (activeTripChannelRef.current) {
            supabase.removeChannel(activeTripChannelRef.current);
            activeTripChannelRef.current = null;
        }
    };
  }, [showTripInProgressSheet, currentRideRequestId, supabase, t.tripCancelledByDriver, resetToInitialMapState]);


  // Trip recovery effect
  useEffect(() => {
    const recoverTrip = async () => {
      // Don't run if user not logged in or a trip/search is already active in the UI
      if (!loggedInUserId || showTripInProgressSheet || showDriverSearchSheet || currentRideRequestId) {
        return;
      }
      
      try {
        const activeTrip = await userService.fetchActivePassengerTrip(loggedInUserId);

        // Ensure we found a trip and it has a driver assigned.
        if (activeTrip && activeTrip.driver_id) {
          // 1. Restore trip data to state
          setConfirmedOrigin({ lat: activeTrip.origin_lat, lng: activeTrip.origin_lng, address: activeTrip.origin_address });
          setConfirmedDestination({ lat: activeTrip.destination_lat, lng: activeTrip.destination_lng, address: activeTrip.destination_address });
          setCurrentRideRequestId(activeTrip.id);
          
          if (activeTrip.status === 'trip_completed' && activeTrip.actual_fare !== null) {
              setCurrentTripFare(activeTrip.actual_fare);
          } else {
              setCurrentTripFare(activeTrip.estimated_fare || null);
          }

          // 2. Fetch driver details and set UI state
          try {
              const fullDriverProfile = await userService.fetchDriverProfile(activeTrip.driver_id);
              const driverPlateNumbers = fullDriverProfile.plateNumbers;

              let profilePicUrl = '';
              if (fullDriverProfile.profilePicUrl) {
                  try {
                      const parsed = JSON.parse(fullDriverProfile.profilePicUrl);
                      profilePicUrl = parsed.url || '';
                  } catch (e) {
                      profilePicUrl = fullDriverProfile.profilePicUrl;
                  }
              }

              const serviceForTrip = allAppServices.find(s => s.id === activeTrip.service_id);
              if (serviceForTrip) setSelectedServiceForSearch(serviceForTrip);
              
              const recoveredDriverDetails: DriverDetails = {
                  name: fullDriverProfile.fullName || `${t.roleDriver} ${activeTrip.driver_id.substring(0, 6)}`,
                  serviceId: serviceForTrip?.id || 'car',
                  vehicleModel: fullDriverProfile.vehicleModel || t.dataMissing,
                  vehicleColor: fullDriverProfile.vehicleColor || t.dataMissing,
                  plateParts: { region: fullDriverProfile.plateRegion || "N/A", numbers: driverPlateNumbers || t.dataMissing, type: fullDriverProfile.plateTypeChar || "-" },
                  profilePicUrl: profilePicUrl,
                  driverId: activeTrip.driver_id,
                  phoneNumber: fullDriverProfile.phoneNumber || t.dataMissing,
              };
              setCurrentDriverDetails(recoveredDriverDetails);

          } catch (error) {
              console.error("[Trip Recovery] Error fetching driver details:", getDebugMessage(error));
              setCurrentDriverDetails({
                  name: activeTrip.driver_id ? `${t.roleDriver} ${activeTrip.driver_id.substring(0,6)}` : t.roleDriver,
                  serviceId: 'car', vehicleModel: t.dataMissing, vehicleColor: t.dataMissing,
                  plateParts: { region: "N/A", numbers: t.dataMissing, type: "-" },
                  driverId: activeTrip.driver_id, phoneNumber: t.dataMissing,
              });
          }
          
          // 3. Set UI state to show trip progress
          setShowDriverSearchSheet(false);
          setShowTripInProgressSheet(true);
          setTripSheetDisplayLevel('default');

          // 4. Determine and set the correct trip phase from the recovered trip status
          let recoveredTripPhase: TripPhase = 'enRouteToOrigin';
          switch (activeTrip.status) {
            case 'trip_started':
              recoveredTripPhase = 'enRouteToDestination'; break;
            case 'driver_at_destination':
            case 'trip_completed':
              recoveredTripPhase = 'arrivedAtDestination'; break;
          }
          setTripPhase(recoveredTripPhase);
        }
      } catch (error) {
        console.error("[Trip Recovery] Error recovering passenger trip:", getDebugMessage(error));
      }
    };

    if (loggedInUserId && allAppServices.length > 0) {
        recoverTrip();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUserId, allAppServices]);


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
        try {
            await userService.updateRide(currentRideRequestId, { status: 'cancelled_by_passenger' });
        } catch (error) {
            console.error("Error cancelling request in DB:", error);
        }
    }
    resetToInitialMapState();
  };

  const handleCancellationSubmit = async (reasonKey: string, customReason: string) => {
      if (!currentRideRequestId || !loggedInUserId) {
          alert(t.errorCancellingTrip + " (Missing IDs)");
          return;
      }
      setIsSubmittingCancellation(true);
      try {
          await userService.updateRide(currentRideRequestId, { status: 'cancelled_by_passenger' });
          await userService.submitCancellationReport({
              rideId: currentRideRequestId,
              userId: loggedInUserId,
              role: 'passenger',
              reasonKey: reasonKey,
              customReason: customReason || null
          });
          resetToInitialMapState();
      } catch (error: any) {
          console.error("Error submitting cancellation:", getDebugMessage(error), error);
          alert(t.errorSubmittingCancellation + `\n\n${getDebugMessage(error)}`);
          resetToInitialMapState();
      } finally {
          setIsCancellationModalOpen(false);
          setIsSubmittingCancellation(false);
      }
  };
  
  const handleOpenCancellationModal = () => {
      if (currentRideRequestId) {
          setIsCancellationModalOpen(true);
      } else {
          console.warn("Attempted to open cancellation modal without a current ride request ID.");
          resetToInitialMapState();
      }
  };

  const handleGoBackToOriginSelection = () => { setSelectionMode('origin'); setSearchError(''); setShowServiceSheet(false); setRouteDistanceKm(null); setIsCalculatingDistance(false); setDistanceError(null); if (confirmedOrigin) { setAddress(confirmedOrigin.address); setSearchQuery(confirmedOrigin.address); if (mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedOrigin.lat, confirmedOrigin.lng]); } } else if (mapInstanceRef.current && debouncedUpdateAddressRef.current) { setAddress(''); setSearchQuery(''); debouncedUpdateAddressRef.current(mapInstanceRef.current).catch(err => console.error("Update address on back failed:", err)); } };
  const handleCloseServiceSheet = () => { setShowServiceSheet(false); if (confirmedDestination && mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedDestination.lat, confirmedDestination.lng]); setAddress(confirmedDestination.address); setSearchQuery(confirmedDestination.address); setSelectionMode('destination'); setIsLoadingAddress(false); setSearchError(''); } };
  const toggleServiceDropdown = () => setIsServiceDropdownOpen(!isServiceDropdownOpen);
  const selectServiceType = (type: 'self' | 'other') => { 
    setServiceFor(type); 
    setIsServiceDropdownOpen(false); 
    if (type === 'self') {
        setThirdPartyName('');
        setThirdPartyPhone('');
        setThirdPartyFormError('');
    }
  };

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
        if (tripSheetDisplayLevel === 'peek') return 'calc(80px + 1rem)';
        if (tripSheetDisplayLevel === 'default') return 'calc(310px + 1rem)';
        return 'calc(75vh + 1rem)';
    }
    return '18rem'; // Adjusted to make space for third party form
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
  const addressPointStyle: CSSProperties = { width: '10px', height: '10px', backgroundColor: selectionMode === 'origin' ? '#007bff' : '#28a745', borderRadius: selectionMode === 'origin' ? '50%' : '2px', [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', flexShrink: 0 };
  const addressInputStyle: CSSProperties = { flexGrow: 1, fontSize: '0.9rem', color: '#333', textAlign: isRTL ? 'right' : 'left', backgroundColor: 'transparent', border: 'none', outline: 'none', padding: '0 0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', };
  const searchButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0, [isRTL ? 'marginRight' : 'marginLeft'] : '0.5rem' }; const searchButtonDisabledStyle: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };
  const searchErrorStyle: CSSProperties = { fontSize: '0.75rem', color: 'red', textAlign: 'center', minHeight: '1.2em', marginBottom: '0.5rem' };
  const verificationWarningStyle: CSSProperties = {
    fontSize: '0.8rem',
    color: '#D97706', // Amber color
    textAlign: 'center',
    marginBottom: '0.5rem',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: '0.4rem',
    borderRadius: '0.25rem',
  };
  const confirmMainButtonStyle: CSSProperties = { width: '100%', backgroundColor: selectionMode === 'destination' ? '#28a745' : '#007bff', color: 'white', border: 'none', padding: '0.875rem', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' };
  if (selectionMode === 'destination') { confirmMainButtonStyle.backgroundColor = '#28a745'; }
  const confirmMainButtonHoverStyle: CSSProperties = { backgroundColor: selectionMode === 'destination' ? '#218838' : '#0056b3' };
  if (selectionMode === 'destination') { confirmMainButtonHoverStyle.backgroundColor = '#218838'; }
  const isThirdPartyFormInvalid = serviceFor === 'other' && (!thirdPartyName.trim() || !/^07[0-9]{8}$/.test(thirdPartyPhone));
  const confirmMainButtonDisabledStyle: CSSProperties = { backgroundColor: '#a5d6a7', cursor: 'not-allowed' };
  const [isConfirmMainButtonHovered, setIsConfirmMainButtonHovered] = useState(false);
  let currentConfirmMainButtonStyle = confirmMainButtonStyle;
  if (isLoadingAddress || isSearching || !address || isThirdPartyFormInvalid || !isUserVerified) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonDisabledStyle}; } else if (isConfirmMainButtonHovered) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonHoverStyle}; }

  const handleToggleTripSheetDisplay = () => {
    setTripSheetDisplayLevel(prevLevel => {
        if (prevLevel === 'peek') return 'default';
        if (prevLevel === 'default') return 'full';
        if (prevLevel === 'full') return 'default';
        return 'default';
    });
  };

  return (
    <div style={mapScreenContainerStyle}>
      <div ref={mapContainerRef} style={leafletMapContainerStyle} />
      <div ref={fixedMarkerRef} style={fixedMarkerStyle} aria-live="polite" aria-atomic="true">
        {selectionMode === 'origin' ?
          <LocationMarkerIcon ariaLabel={t.originMarkerAriaLabel} /> :
          <DestinationMarkerIcon ariaLabel={t.destinationMarkerAriaLabel} />
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
        {serviceFor === 'other' && (
            <div style={{ marginBottom: '0.5rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem' }}>
                <input 
                    type="text" 
                    placeholder={t.passengerNameLabel} 
                    value={thirdPartyName}
                    onChange={(e) => {
                        setThirdPartyName(e.target.value);
                        if (thirdPartyFormError) setThirdPartyFormError('');
                    }}
                    style={{...addressInputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem', backgroundColor: '#fff', border: '1px solid #ddd', padding: '0.75rem'}}
                />
                <input 
                    type="tel" 
                    placeholder={t.passengerPhoneLabel} 
                    value={thirdPartyPhone}
                    onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setThirdPartyPhone(value);
                        if (thirdPartyFormError) setThirdPartyFormError('');
                    }}
                    style={{...addressInputStyle, width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: '1px solid #ddd', padding: '0.75rem'}}
                    maxLength={10}
                    dir="ltr"
                />
            </div>
        )}
        <div style={addressInputContainerStyle}> <div style={addressPointStyle} /> <input type="text" style={addressInputStyle} value={isLoadingAddress ? t.addressLoading : (isSearching ? t.searchingAddress : searchQuery)} onChange={(e) => { setSearchQuery(e.target.value); if (searchError) setSearchError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} placeholder={selectionMode === 'origin' ? t.searchPlaceholderOrigin : t.searchPlaceholderDestination} readOnly={isLoadingAddress || isSearching} aria-label={t.searchAddressLabel} dir={isRTL ? 'rtl': 'ltr'} /> <button onClick={handleSearch} style={ (isSearching || isLoadingAddress || !searchQuery.trim()) ? {...searchButtonStyle, ...searchButtonDisabledStyle} : searchButtonStyle } disabled={isSearching || isLoadingAddress || !searchQuery.trim()} aria-label={t.searchIconAriaLabel} > <SearchIcon /> </button> </div>
        {searchError || thirdPartyFormError ? <p style={searchErrorStyle} role="alert">{searchError || thirdPartyFormError}</p> : <div style={{...searchErrorStyle, visibility: 'hidden'}}>Placeholder</div> }
        {!isUserVerified && <p style={verificationWarningStyle}>{t.accountNotVerifiedWarning}</p>}
        <button style={currentConfirmMainButtonStyle} onMouseEnter={() => setIsConfirmMainButtonHovered(true)} onMouseLeave={() => setIsConfirmMainButtonHovered(false)} onClick={handleConfirmOriginOrDestination} disabled={isLoadingAddress || isSearching || !address || isThirdPartyFormInvalid || !isUserVerified} > {selectionMode === 'origin' ? t.confirmOriginButton : t.confirmDestinationButton} </button>
      </div>
      {showServiceSheet && confirmedOrigin && confirmedDestination && ( <ServiceSelectionSheet currentLang={currentLang} originAddress={confirmedOrigin.address} destinationAddress={confirmedDestination.address} routeDistanceKm={routeDistanceKm} isCalculatingDistance={isCalculatingDistance} distanceError={distanceError} onClose={handleCloseServiceSheet} onRequestRide={handleRequestRideFromSheet} serviceCategories={appServiceCategories} isLoadingServices={isLoadingServicesGlobal} serviceFetchError={serviceFetchErrorGlobal} /> )}
      {showDriverSearchSheet && selectedServiceForSearch && ( <DriverSearchSheet currentLang={currentLang} searchState={driverSearchState} notifiedDriverCount={notifiedDriverCount} onRetry={handleRetryDriverSearch} onCancel={handleCancelDriverSearch} onClose={handleCancelDriverSearch} selectedServiceName={t[selectedServiceForSearch.nameKey] || selectedServiceForSearch.id} /> )}
      {showTripInProgressSheet && currentDriverDetails && ( <TripInProgressSheet currentLang={currentLang} driverDetails={currentDriverDetails} tripFare={currentTripFare}
        tripPhase={tripPhase} estimatedTimeToDestination={estimatedTimeToDestination}
        displayLevel={tripSheetDisplayLevel} onSetDisplayLevel={setTripSheetDisplayLevel}
        onChangeDestination={() => {}}
        onApplyCoupon={() => {}}
        onRideOptions={() => {}}
        onCancelTrip={handleOpenCancellationModal}
        onSafety={() => {}}
        onClose={resetToInitialMapState}
        appServices={allAppServices} />
      )}
      {isCancellationModalOpen && (
          <CancellationModal
              isOpen={isCancellationModalOpen}
              onClose={() => setIsCancellationModalOpen(false)}
              onSubmit={handleCancellationSubmit}
              userRole={'passenger'}
              currentLang={currentLang}
              isSubmitting={isSubmittingCancellation}
          />
      )}
    </div>
  );
};