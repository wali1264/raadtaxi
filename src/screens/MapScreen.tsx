import React, { useState, useEffect, useRef, CSSProperties, useCallback, useContext } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { AppService, DriverDetails, TripPhase, TripSheetDisplayLevel, DriverSearchState, UserRole, DestinationSuggestion, UserDefinedPlace } from '../types'; 
import { debounce, getDistanceFromLatLonInKm, getDebugMessage, getCurrentLocation } from '../utils/helpers';
import { ServiceSelectionSheet } from '../components/ServiceSelectionSheet';
import { DriverSearchSheet } from '../components/DriverSearchSheet';
import { TripInProgressSheet } from '../components/TripInProgressSheet';
import { CancellationModal } from '../components/CancellationModal';
import { GeminiSuggestionModal } from '../components/GeminiSuggestionModal';
import { LocationMarkerIcon, DestinationMarkerIcon, HomeIcon, ProfileIcon, GpsIcon, SearchIcon, BackArrowIcon, ChevronDownIcon, CloseIcon, DriverCarIcon, GeminiSuggestIcon, UserPlaceMarkerIcon, StarIcon } from '../components/icons';
import { AppContext, useAppContext } from '../contexts/AppContext';
import { tripService, profileService } from '../services';
import { usePassengerTrip } from '../hooks/usePassengerTrip';
import { useUserDefinedPlaces } from '../hooks/useUserDefinedPlaces';

interface SearchResult {
  type: 'saved' | 'nominatim';
  lat: number;
  lng: number;
  name: string;
  displayName: string;
}

interface MapScreenProps {
  onNavigateToProfile: () => void;
}

const getPoiIcon = (tags: { [key: string]: string }): L.DivIcon => {
    let iconSvg = '';
    let color = '#718096'; // Default gray

    if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food') {
        color = '#F59E0B';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 2A2.5 2.5 0 003 4.5v1.783c.092.34.264.654.49.913l1.838 2.05a1.5 1.5 0 001.172.554H13a1.5 1.5 0 001.172-.554l1.838-2.05c.226-.259.398-.573.49-.913V4.5A2.5 2.5 0 0014.5 2h-9zM3 12.5A2.5 2.5 0 005.5 15h9a2.5 2.5 0 002.5-2.5V11H3v1.5z"/></svg>`;
    } else if (tags.shop) {
        color = '#3B82F6';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H4.72l-.38-1.522A1 1 0 003 1z"/><path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>`;
    } else if (tags.amenity === 'pharmacy') {
        color = '#EF4444';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clip-rule="evenodd"/></svg>`;
    } else if (tags.amenity === 'place_of_worship') {
        color = '#10B981';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 21V10.08l6-3.04 6 3.04V21H4zM2 21h1V10L12 4l9 6v11h1v-1l-1-1v-9l-9-6-9 6v10l-1 1v1zM12 14l-4 2v2h8v-2l-4-2z"/></svg>`;
    } else if (tags.tourism === 'hotel') {
        color = '#8B5CF6';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v2.5a.5.5 0 001 0V4a1 1 0 112 0v2.5a.5.5 0 001 0V4a1 1 0 112 0v1.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 5.5V4a1 1 0 112 0v1.5a.5.5 0 001 0V4a1 1 0 011-1h5zM2 13.5A1.5 1.5 0 013.5 12h13a1.5 1.5 0 011.5 1.5V15a1 1 0 01-1 1H3a1 1 0 01-1-1v-1.5z" clip-rule="evenodd" /></svg>`;
    }
    
    const style = `width:100%;height:100%;background:${color};color:white;padding:4px;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4);`;
    return L.divIcon({
        html: `<div style="${style}">${iconSvg}</div>`,
        className: 'poi-marker-icon',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });
};


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
  
  const { tripState, tripActions } = usePassengerTrip();
  const { userDefinedPlaces } = useUserDefinedPlaces();
  const {
      showDriverSearchSheet, driverSearchState, notifiedDriverCount,
      showTripInProgressSheet, tripSheetDisplayLevel, currentTripFare,
      currentDriverDetails, tripPhase, estimatedTimeToDestination,
      isCancellationModalOpen, isSubmittingCancellation, currentRideRequestId
  } = tripState;

  const isRTL = currentLang !== 'en';
  const mapContainerRef = useRef<HTMLDivElement>(null); const mapInstanceRef = useRef<L.Map | null>(null);
  const fixedMarkerRef = useRef<HTMLDivElement>(null);
  const [selectionMode, setSelectionMode] = useState<'origin' | 'destination'>('origin');
  const [confirmedOrigin, setConfirmedOrigin] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [confirmedDestination, setConfirmedDestination] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [address, setAddress] = useState<string>(''); 
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);


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

  const [originMapMarker, setOriginMapMarker] = useState<L.Marker | null>(null);
  const [destinationMapMarker, setDestinationMapMarker] = useState<L.Marker | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const driverLocationChannelRef = useRef<RealtimeChannel | null>(null);
  
  const debouncedUpdateAddressRef = useRef<((map: L.Map) => Promise<void>) | undefined>(undefined);
  
  const [isFetchingPois, setIsFetchingPois] = useState(false);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const userPlacesLayerRef = useRef<L.LayerGroup | null>(null);
  const userPlaceMarkersRef = useRef<L.Marker[]>([]);

  const [showSuggestionModal, setShowSuggestionModal] = useState<boolean>(false);
  const [suggestedDestinations, setSuggestedDestinations] = useState<DestinationSuggestion[]>([]);
  const [currentUserLocation, setCurrentUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const suggestionMarkersLayerRef = useRef<L.LayerGroup | null>(null);


  const updateAddressFromMapCenter = useCallback(async (map: L.Map) => {
    if (showDriverSearchSheet || showTripInProgressSheet || showSuggestionModal) return; 
    setIsLoadingAddress(true); 
    setSearchQuery(t.addressLoading); 
    setSearchError(''); 
    const center = map.getCenter();
    setCurrentUserLocation({ lat: center.lat, lng: center.lng });

    try { 
        const fetchOptions: RequestInit = { method: 'GET', mode: 'cors', referrerPolicy: 'strict-origin-when-cross-origin' };
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat}&lon=${center.lng}&accept-language=${currentLang}&zoom=18`, fetchOptions);
        if (!response.ok) throw new Error('Network response was not ok'); const data = await response.json(); if (data && data.display_name) { setAddress(data.display_name); setSearchQuery(data.display_name); } else { setAddress(t.addressNotFound); setSearchQuery(t.addressNotFound); } } catch (error) { console.error("Error fetching address:", error); setAddress(t.addressError); setSearchQuery(t.addressError); } finally { setIsLoadingAddress(false); }
  }, [currentLang, t.addressLoading, t.addressNotFound, t.addressError, showDriverSearchSheet, showTripInProgressSheet, showSuggestionModal, t]);

  const debouncedSearch = useCallback(debounce(async (query: string) => {
    if (!query.trim()) {
        setSearchResults([]);
        return;
    }
    
    setIsSearching(true);
    setSearchError('');

    try {
        const savedPlacesPromise = profileService.searchUserDefinedPlaces(query);
        
        const map = mapInstanceRef.current;
        const bounds = map ? map.getBounds() : null;
        const viewbox = bounds ? `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}` : '';
        const nominatimPromise = fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=af&accept-language=${currentLang}&limit=5&viewbox=${viewbox}&bounded=1`, { method: 'GET', mode: 'cors', referrerPolicy: 'strict-origin-when-cross-origin' });

        const [savedPlacesResult, nominatimResponse] = await Promise.all([savedPlacesPromise, nominatimPromise]);

        let nominatimResults: any[] = [];
        if (nominatimResponse.ok) {
            nominatimResults = await nominatimResponse.json();
        } else {
            console.warn("Nominatim search failed:", nominatimResponse.statusText);
        }
        
        const combinedResults: SearchResult[] = [];

        if (savedPlacesResult) {
            savedPlacesResult.forEach(place => {
                combinedResults.push({
                    type: 'saved',
                    lat: place.location.lat,
                    lng: place.location.lng,
                    name: place.name,
                    displayName: place.name,
                });
            });
        }
        
        if (nominatimResults) {
            nominatimResults.forEach((result: any) => {
                if (!combinedResults.some(cr => cr.name.toLowerCase() === result.display_name.split(',')[0].toLowerCase())) {
                    combinedResults.push({
                        type: 'nominatim',
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon),
                        name: result.display_name,
                        displayName: result.display_name,
                    });
                }
            });
        }
        
        setSearchResults(combinedResults);
        if (combinedResults.length === 0) {
            setSearchError(t.searchNoResults);
        }

    } catch (error) {
        console.error("Error during combined search:", error);
        setSearchError(t.searchApiError);
    } finally {
        setIsSearching(false);
    }
}, 400), [currentLang, t.searchNoResults, t.searchApiError]);

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      if (searchError) setSearchError('');
      if (query.trim()) {
          debouncedSearch(query);
      } else {
          setSearchResults([]);
      }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([result.lat, result.lng], 16);
    }
    setSearchQuery(result.name);
    setSearchResults([]);
    setIsSearchFocused(false);
  };

  useEffect(() => { 
    if (mapContainerRef.current && !mapInstanceRef.current) { 
        const initialView: L.LatLngExpression = [32.3745, 62.1164]; 
        const newMap = L.map(mapContainerRef.current, { center: initialView, zoom: 13, zoomControl: false, attributionControl: true, }); 
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
        }).addTo(newMap); 
        mapInstanceRef.current = newMap; 
        setSearchQuery(t.addressLoading); 

        if (!poiLayerRef.current) { poiLayerRef.current = L.layerGroup().addTo(newMap); }
        if (!userPlacesLayerRef.current) { userPlacesLayerRef.current = L.layerGroup().addTo(newMap); }
        if (!suggestionMarkersLayerRef.current) { suggestionMarkersLayerRef.current = L.layerGroup().addTo(newMap); }
    } 
    return () => { mapInstanceRef.current?.remove(); mapInstanceRef.current = null; }; 
  }, [t.addressLoading]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const fetchAndDisplayPois = async () => {
        if (showSuggestionModal) { poiLayerRef.current?.clearLayers(); return; }
        const mapBounds = map.getBounds(); const zoom = map.getZoom();
        if (zoom < 15) { poiLayerRef.current?.clearLayers(); return; }
        setIsFetchingPois(true);
        const boundsStr = `${mapBounds.getSouth()},${mapBounds.getWest()},${mapBounds.getNorth()},${mapBounds.getEast()}`;
        const poiQuery = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|pharmacy|place_of_worship|fast_food"](${boundsStr});node["shop"~"supermarket|convenience"](${boundsStr});node["tourism"="hotel"](${boundsStr}););out body;>;out skel qt;`;
        
        try {
            const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(poiQuery)}`);
            if (!response.ok) throw new Error(`Overpass API query failed with status ${response.status}`);
            const data = await response.json();
            poiLayerRef.current?.clearLayers();
            if (data.elements) {
                data.elements.forEach((element: any) => {
                    if (element.type === 'node' && element.tags && element.tags.name) {
                        const marker = L.marker([element.lat, element.lon], { icon: getPoiIcon(element.tags) }).bindPopup(`<b>${element.tags.name}</b>`);
                        poiLayerRef.current?.addLayer(marker);
                    }
                });
            }
        } catch (err) { console.error('Error fetching or displaying POIs:', err); } finally { setIsFetchingPois(false); }
    };
    const debouncedFetchPois = debounce(fetchAndDisplayPois, 1200);
    map.on('moveend', debouncedFetchPois); map.on('zoomend', debouncedFetchPois); debouncedFetchPois();
    return () => { map.off('moveend', debouncedFetchPois); map.off('zoomend', debouncedFetchPois); poiLayerRef.current?.clearLayers(); };
  }, [mapInstanceRef.current, showSuggestionModal]); 

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
      handleZoomEnd(); // Initial check

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

      // Set initial visibility based on current zoom
      const currentZoom = map.getZoom();
      userPlaceMarkersRef.current.forEach(marker => {
          if (currentZoom < 15) {
              marker.closeTooltip();
          }
      });
  }, [userDefinedPlaces, mapInstanceRef.current]);


  useEffect(() => { if (mapContainerRef.current) { mapContainerRef.current.style.cursor = isFetchingPois ? 'wait' : 'default'; } }, [isFetchingPois]);

  useEffect(() => { const currentDebouncedUpdate = debounce((map: L.Map) => { return updateAddressFromMapCenter(map); }, 750); debouncedUpdateAddressRef.current = currentDebouncedUpdate; const map = mapInstanceRef.current; if (!map) return; if (!showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet && !showSuggestionModal) { currentDebouncedUpdate(map).catch(err => console.error("Initial debounced call failed:", err)); } const handleMoveEnd = () => { if (!showServiceSheet && !showDriverSearchSheet && !showTripInProgressSheet && !showSuggestionModal) { currentDebouncedUpdate(map).catch(err => console.error("Debounced move_end call failed:", err)); } }; map.on('moveend', handleMoveEnd); return () => { map.off('moveend', handleMoveEnd); }; }, [updateAddressFromMapCenter, showServiceSheet, showDriverSearchSheet, showTripInProgressSheet, showSuggestionModal]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) { setIsServiceDropdownOpen(false); }
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) { setIsSearchFocused(false); }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current; if (!map) return;
    if (showTripInProgressSheet && confirmedOrigin) { if (!originMapMarker) { const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#FFD700" style={{filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))'}} />); const originIcon = L.divIcon({ html: originIconHTML, className: 'origin-trip-marker', iconSize: [40, 40], iconAnchor: [20, 40] }); const newOriginMarker = L.marker([confirmedOrigin.lat, confirmedOrigin.lng], { icon: originIcon }).addTo(map); setOriginMapMarker(newOriginMarker); } } else { if (originMapMarker && map.hasLayer(originMapMarker)) { map.removeLayer(originMapMarker); setOriginMapMarker(null); } }
    if (showTripInProgressSheet && confirmedDestination) { if (!destinationMapMarker) { const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#000000" style={{filter: 'drop-shadow(0px 0px 3px rgba(0,0,0,0.5))'}} />); const destinationIcon = L.divIcon({ html: destIconHTML, className: 'destination-trip-marker', iconSize: [40, 40], iconAnchor: [20, 20] }); const newDestMarker = L.marker([confirmedDestination.lat, confirmedDestination.lng], { icon: destinationIcon }).addTo(map); setDestinationMapMarker(newDestMarker); } } else { if (destinationMapMarker && map.hasLayer(destinationMapMarker)) { map.removeLayer(destinationMapMarker); setDestinationMapMarker(null); } }
  }, [showTripInProgressSheet, confirmedOrigin, confirmedDestination, mapInstanceRef.current]);

  useEffect(() => {
    const map = mapInstanceRef.current; if (!map) return; const driverId = currentDriverDetails?.driverId;
    if (showTripInProgressSheet && driverId && confirmedOrigin) {
      const initializeAndTrack = async () => {
        let initialLatLng: L.LatLng | null = null;
        try {
          const locationData = await profileService.fetchDriverProfile(driverId);
          initialLatLng = L.latLng(confirmedOrigin.lat, confirmedOrigin.lng);
        } catch (e) { console.error("Exception fetching initial driver location:", e); initialLatLng = L.latLng(confirmedOrigin.lat, confirmedOrigin.lng); }
        
        if (initialLatLng) { if (!driverMarkerRef.current) { const carIconHTML = ReactDOMServer.renderToString(<DriverCarIcon />); const carIcon = L.divIcon({ html: carIconHTML, className: 'driver-car-icon', iconSize: [40, 40], iconAnchor: [20, 20] }); driverMarkerRef.current = L.marker(initialLatLng, { icon: carIcon, zIndexOffset: 1000, }).addTo(map); } else { driverMarkerRef.current.setLatLng(initialLatLng); } }
        
        if (driverLocationChannelRef.current) { supabase.removeChannel(driverLocationChannelRef.current); }
        driverLocationChannelRef.current = supabase.channel(`driver_location_${driverId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` }, (payload) => {
          const newLocation = payload.new as { latitude: number, longitude: number, heading?: number };
          if (newLocation && driverMarkerRef.current) {
            const newPos = L.latLng(newLocation.latitude, newLocation.longitude); driverMarkerRef.current.setLatLng(newPos);
            const boundsToShowUpdate: L.LatLngExpression[] = [];
            if (confirmedOrigin) boundsToShowUpdate.push(L.latLng(confirmedOrigin.lat, confirmedOrigin.lng));
            if (confirmedDestination) boundsToShowUpdate.push(L.latLng(confirmedDestination.lat, confirmedDestination.lng));
            boundsToShowUpdate.push(newPos);
            if (map && boundsToShowUpdate.length >= 2) { map.fitBounds(L.latLngBounds(boundsToShowUpdate), { padding: [80, 80], maxZoom: 17, animate: true }); }
          }
        }).subscribe();
      };
      initializeAndTrack();
    } else {
        if (driverMarkerRef.current && map.hasLayer(driverMarkerRef.current)) { map.removeLayer(driverMarkerRef.current); driverMarkerRef.current = null; }
        if (driverLocationChannelRef.current) { supabase.removeChannel(driverLocationChannelRef.current); driverLocationChannelRef.current = null; }
    }
    return () => { if (driverMarkerRef.current && map?.hasLayer(driverMarkerRef.current)) { map.removeLayer(driverMarkerRef.current); driverMarkerRef.current = null; } if (driverLocationChannelRef.current) { supabase.removeChannel(driverLocationChannelRef.current); driverLocationChannelRef.current = null; } };
  }, [ mapInstanceRef.current, showTripInProgressSheet, currentDriverDetails?.driverId, confirmedOrigin, confirmedDestination, tripPhase, supabase ]);

  useEffect(() => {
    const layer = suggestionMarkersLayerRef.current;
    if (!mapInstanceRef.current || !layer) return;
    layer.clearLayers();
    if (suggestedDestinations.length > 0) {
        const bounds = L.latLngBounds([]);
        suggestedDestinations.forEach(suggestion => {
            const marker = L.marker([suggestion.latitude, suggestion.longitude], {
                icon: L.divIcon({
                    html: `<div style="background-color: #8B5CF6; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">AI</div>`,
                    className: 'gemini-suggestion-marker', iconSize: [32, 32], iconAnchor: [16, 16]
                })
            }).bindPopup(`<b>${suggestion.name}</b><br>${suggestion.description}`);
            layer.addLayer(marker); bounds.extend([suggestion.latitude, suggestion.longitude]);
        });
        if (currentUserLocation) { bounds.extend([currentUserLocation.lat, currentUserLocation.lng]); }
        if (bounds.isValid()) { mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 }); }
    }
  }, [suggestedDestinations, currentUserLocation]);
  
  const handleGpsClick = async () => {
    const map = mapInstanceRef.current; if (!map || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet || showSuggestionModal) return;
    try { const position = await getCurrentLocation(); const userLatLng: L.LatLngExpression = [position.coords.latitude, position.coords.longitude]; map.setView(userLatLng, 15); if (debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(map).catch(err => console.error("Debounced GPS click call failed:", getDebugMessage(err), err)); } } catch (error: any) { console.error("Error getting GPS location:", getDebugMessage(error), error); let message = ""; switch (error.code) { case 1: message = t.geolocationPermissionDenied; break; case 2: message = t.geolocationUnavailableHintVpnOrSignal; break; case 3: message = t.geolocationTimeout; break; default: message = t.geolocationNotSupported; break; } alert(message); }
  };

  const calculateRouteDistance = async (origin: {lat: number, lng: number}, destination: {lat: number, lng: number}) => { setIsCalculatingDistance(true); setDistanceError(null); setRouteDistanceKm(null); try { 
    const fetchOptions: RequestInit = { method: 'GET', mode: 'cors', referrerPolicy: 'strict-origin-when-cross-origin' };
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`, fetchOptions); 
    if (!response.ok) { throw new Error(`OSRM API error: ${response.status} ${response.statusText}`); } const data = await response.json(); if (data.routes && data.routes.length > 0 && data.routes[0].distance) { const distanceInKm = data.routes[0].distance / 1000; setRouteDistanceKm(distanceInKm); } else { throw new Error("No route found or distance missing in OSRM response."); } } catch (error) { console.error("Error calculating route distance:", error); setDistanceError(t.priceCalculationError); } finally { setIsCalculatingDistance(false); } };
  
  const handleConfirmOriginOrDestination = () => { if (isLoadingAddress || isSearching || !mapInstanceRef.current || !address || showServiceSheet || showDriverSearchSheet || showTripInProgressSheet || showSuggestionModal) return; const currentMap = mapInstanceRef.current; const center = currentMap.getCenter(); const currentValidAddress = address; 
  if (serviceFor === 'other') { if (!thirdPartyName.trim()) { setThirdPartyFormError(t.fullNameLabel + ' ' + (isRTL ? 'الزامی است' : 'is required')); return; } if (!/^07[0-9]{8}$/.test(thirdPartyPhone)) { setThirdPartyFormError(t.invalidPhoneError); return; } setThirdPartyFormError(''); }
  if (selectionMode === 'origin') { setConfirmedOrigin({ lat: center.lat, lng: center.lng, address: currentValidAddress }); setSelectionMode('destination'); setSearchQuery(''); setAddress(''); setSearchError(''); if (debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(currentMap).catch(err => console.error("Update address for dest failed:", err)); } } else { const destDetails = { lat: center.lat, lng: center.lng, address: currentValidAddress }; setConfirmedDestination(destDetails); if(confirmedOrigin) { calculateRouteDistance( {lat: confirmedOrigin.lat, lng: confirmedOrigin.lng}, {lat: destDetails.lat, lng: destDetails.lng} ).finally(() => { setShowServiceSheet(true); }); } else { setDistanceError("Origin not confirmed."); setShowServiceSheet(true); } } };

  useEffect(() => {
    if (loggedInUserId && allAppServices.length > 0) {
        tripActions.recoverTrip();
    }
  }, [loggedInUserId, allAppServices, tripActions.recoverTrip]);

  const handleRequestRideFromSheet = (service: AppService, originAddressText: string, destinationAddressText: string, estimatedPrice: number | null) => { setShowServiceSheet(false); if (confirmedOrigin && confirmedDestination) { tripActions.startRideRequest(service, confirmedOrigin, confirmedDestination, estimatedPrice, serviceFor, thirdPartyName, thirdPartyPhone); } else { console.error("Origin or destination not confirmed for ride request."); alert(t.rideRequestCreationError + " (Origin/Dest missing)"); } };
  
  const resetToInitialMapState = () => {
    tripActions.resetTripState();
    setShowServiceSheet(false); setSelectionMode('origin'); setConfirmedOrigin(null); setConfirmedDestination(null); setSearchQuery(''); setAddress(''); setRouteDistanceKm(null); setIsCalculatingDistance(false); setDistanceError(null);
    if (mapInstanceRef.current && debouncedUpdateAddressRef.current) { debouncedUpdateAddressRef.current(mapInstanceRef.current) .catch(err => console.error("Update address for new origin failed:", err)); }
  };
  
  const handleDestinationSuggested = (suggestion: DestinationSuggestion) => {
    setShowSuggestionModal(false); setSuggestedDestinations([]); const destDetails = { lat: suggestion.latitude, lng: suggestion.longitude, address: suggestion.name }; setConfirmedDestination(destDetails); if (confirmedOrigin) { calculateRouteDistance({ lat: confirmedOrigin.lat, lng: confirmedOrigin.lng }, { lat: destDetails.lat, lng: destDetails.lng }).finally(() => { setShowServiceSheet(true); }); } else { setDistanceError("Origin not confirmed."); setShowServiceSheet(true); }
  };

  const handleGoBackToOriginSelection = () => { setSelectionMode('origin'); setSearchError(''); setShowServiceSheet(false); setRouteDistanceKm(null); setIsCalculatingDistance(false); setDistanceError(null); if (confirmedOrigin) { setAddress(confirmedOrigin.address); setSearchQuery(confirmedOrigin.address); if (mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedOrigin.lat, confirmedOrigin.lng]); } } else if (mapInstanceRef.current && debouncedUpdateAddressRef.current) { setAddress(''); setSearchQuery(''); debouncedUpdateAddressRef.current(mapInstanceRef.current).catch(err => console.error("Update address on back failed:", err)); } };
  const handleCloseServiceSheet = () => { setShowServiceSheet(false); if (confirmedDestination && mapInstanceRef.current) { mapInstanceRef.current.setView([confirmedDestination.lat, confirmedDestination.lng]); setAddress(confirmedDestination.address); setSearchQuery(confirmedDestination.address); setSelectionMode('destination'); setIsLoadingAddress(false); setSearchError(''); } };
  const toggleServiceDropdown = () => setIsServiceDropdownOpen(!isServiceDropdownOpen);
  const selectServiceType = (type: 'self' | 'other') => { setServiceFor(type); setIsServiceDropdownOpen(false); if (type === 'self') { setThirdPartyName(''); setThirdPartyPhone(''); setThirdPartyFormError(''); } };
  
  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    // Clear the search query if it's currently showing a geocoded address,
    // allowing the user to type a new query without manually deleting.
    if (
      searchQuery === address ||
      searchQuery === t.addressLoading ||
      searchQuery === t.addressError ||
      searchQuery === t.addressNotFound
    ) {
      setSearchQuery('');
    }
  };

  const mapScreenContainerStyle: CSSProperties = { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#e0e0e0' };
  const leafletMapContainerStyle: CSSProperties = { width: '100%', height: '100%' };
  const fixedMarkerStyle: CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', zIndex: 1000, pointerEvents: 'none', display: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet || !mapInstanceRef.current || showSuggestionModal) ? 'none' : 'block' };
  const topControlsContainerStyle: CSSProperties = { position: 'absolute', top: '1rem', left: '1rem', right: '1rem', height: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1010, pointerEvents: 'none', gap: '0.5rem' };
  const topBarButtonStyle: CSSProperties = { backgroundColor: 'white', borderRadius: '50%', width: '2.75rem', height: '2.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer', border: 'none', padding: 0, };
  const serviceTypePillContainerStyle: CSSProperties = { flexGrow: 1, display: 'flex', justifyContent: 'center', pointerEvents: 'none', visibility: (showDriverSearchSheet || showTripInProgressSheet || showSuggestionModal) ? 'hidden' : 'visible', };
  const serviceTypePillStyle: CSSProperties = { backgroundColor: 'white', borderRadius: '2rem', padding: '0.5rem 1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#333', fontWeight: 500, pointerEvents: 'auto', margin: '0 auto', };
  const serviceDropdownStyle: CSSProperties = { position: 'absolute', top: 'calc(100% + 0.5rem)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 1011, minWidth: '150px', border: '1px solid #eee' };
  const serviceDropdownItemStyle: CSSProperties = { padding: '0.75rem 1rem', cursor: 'pointer', fontSize: '0.875rem', textAlign: isRTL ? 'right' : 'left' }; const serviceDropdownItemHoverStyle: CSSProperties = { backgroundColor: '#f0f0f0' };
  const getGpsButtonBottom = () => {
    if (showServiceSheet) return 'calc(70vh + 1rem)';
    if (showDriverSearchSheet) return 'calc(250px + 1rem)';
    if (showTripInProgressSheet) { if (tripSheetDisplayLevel === 'peek') return 'calc(80px + 1rem)'; if (tripSheetDisplayLevel === 'default') return 'calc(310px + 1rem)'; return 'calc(75vh + 1rem)'; }
    return '18rem';
  };
  const gpsButtonVisibilityLogic = (showServiceSheet || showDriverSearchSheet || showSuggestionModal || (showTripInProgressSheet && tripSheetDisplayLevel === 'full')) ? 'hidden' : 'visible';
  const gpsButtonStyle: CSSProperties = { position: 'absolute', bottom: getGpsButtonBottom(), [isRTL ? 'right' : 'left']: '1rem', backgroundColor: 'white', borderRadius: '50%', width: '3.25rem', height: '3.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 1000, border: 'none', transition: 'bottom 0.3s ease-out, visibility 0.3s ease-out', visibility: gpsButtonVisibilityLogic, };
  const bottomPanelStyle: CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: '1rem 1.5rem 1.5rem', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex', flexDirection: 'column', transform: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet || showSuggestionModal) ? 'translateY(100%)' : 'translateY(0)', visibility: (showServiceSheet || showDriverSearchSheet || showTripInProgressSheet || showSuggestionModal) ? 'hidden' : 'visible', transition: 'transform 0.3s ease-out, visibility 0.3s ease-out' };
  const searchSectionStyle: CSSProperties = { position: 'relative' };
  const addressInputContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: '0.5rem', padding: isRTL ? '0.75rem 1rem 0.75rem 0.5rem' : '0.75rem 0.5rem 0.75rem 1rem' };
  const addressPointStyle: CSSProperties = { width: '10px', height: '10px', backgroundColor: selectionMode === 'origin' ? '#007bff' : '#28a745', borderRadius: selectionMode === 'origin' ? '50%' : '2px', [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', flexShrink: 0 };
  const addressInputStyle: CSSProperties = { flexGrow: 1, fontSize: '0.9rem', color: '#333', textAlign: isRTL ? 'right' : 'left', backgroundColor: 'transparent', border: 'none', outline: 'none', padding: '0 0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', };
  const searchResultsContainerStyle: CSSProperties = { position: 'absolute', bottom: 'calc(100% - 0.5rem)', left: 0, right: 0, backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)', zIndex: 1001, maxHeight: '250px', overflowY: 'auto', border: '1px solid #e0e0e0' };
  const searchResultItemStyle: CSSProperties = { padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '0.75rem' };
  const searchResultItemHoverStyle: CSSProperties = { backgroundColor: '#f8f9fa' };
  const searchResultTextStyle: CSSProperties = { fontSize: '0.9rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const searchErrorStyle: CSSProperties = { fontSize: '0.75rem', color: 'red', textAlign: 'center', minHeight: '1.2em', margin: '0.5rem 0' };
  const verificationWarningStyle: CSSProperties = { fontSize: '0.8rem', color: '#D97706', textAlign: 'center', marginBottom: '0.5rem', backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: '0.4rem', borderRadius: '0.25rem', };
  const confirmMainButtonStyle: CSSProperties = { width: '100%', backgroundColor: selectionMode === 'destination' ? '#28a745' : '#007bff', color: 'white', border: 'none', padding: '0.875rem', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '0.5rem' };
  const confirmMainButtonHoverStyle: CSSProperties = { backgroundColor: selectionMode === 'destination' ? '#218838' : '#0056b3' };
  const isThirdPartyFormInvalid = serviceFor === 'other' && (!thirdPartyName.trim() || !/^07[0-9]{8}$/.test(thirdPartyPhone));
  const confirmMainButtonDisabledStyle: CSSProperties = { backgroundColor: '#a5d6a7', cursor: 'not-allowed' };
  const [isConfirmMainButtonHovered, setIsConfirmMainButtonHovered] = useState(false);
  let currentConfirmMainButtonStyle = confirmMainButtonStyle;
  if (isLoadingAddress || isSearching || !address || isThirdPartyFormInvalid || !isUserVerified) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonDisabledStyle}; } else if (isConfirmMainButtonHovered) { currentConfirmMainButtonStyle = {...currentConfirmMainButtonStyle, ...confirmMainButtonHoverStyle}; }

  return (
    <div style={mapScreenContainerStyle}>
      <div ref={mapContainerRef} style={leafletMapContainerStyle} />
      <div ref={fixedMarkerRef} style={fixedMarkerStyle} aria-live="polite" aria-atomic="true">
        {selectionMode === 'origin' ? <LocationMarkerIcon ariaLabel={t.originMarkerAriaLabel} /> : <DestinationMarkerIcon ariaLabel={t.destinationMarkerAriaLabel} /> }
      </div>
      <div style={topControlsContainerStyle}>
        <div style={{ pointerEvents: 'auto' }}>
          { (showDriverSearchSheet || showTripInProgressSheet) ? ( <button style={topBarButtonStyle} onClick={resetToInitialMapState} aria-label={t.closeDriverSearchSheetAriaLabel}> <CloseIcon /> </button> ) : (showServiceSheet || showSuggestionModal) ? ( <button style={topBarButtonStyle} onClick={() => { setShowServiceSheet(false); setShowSuggestionModal(false); setSuggestedDestinations([]); }} aria-label={t.closeSheetButtonAriaLabel}> <BackArrowIcon style={{transform: isRTL ? 'scaleX(-1)' : 'none'}}/> </button> ) : selectionMode === 'destination' ? ( <button style={topBarButtonStyle} onClick={handleGoBackToOriginSelection} aria-label={t.backButtonAriaLabel}> <BackArrowIcon style={{transform: isRTL ? 'scaleX(-1)' : 'none'}}/> </button> ) : ( <button style={topBarButtonStyle} aria-label={t.homeButtonAriaLabel}><HomeIcon /></button> )}
        </div>
        <div style={serviceTypePillContainerStyle}> {!(showDriverSearchSheet || showTripInProgressSheet || showSuggestionModal) && ( <div ref={serviceDropdownRef} style={{ position: 'relative', pointerEvents: 'auto' }}> <div style={serviceTypePillStyle} onClick={toggleServiceDropdown}> {serviceFor === 'self' ? t.serviceForSelf : t.serviceForOther} <ChevronDownIcon style={{ [isRTL ? 'marginRight' : 'marginLeft']: '0.5rem', transform: isServiceDropdownOpen ? 'rotate(180deg)' : '' }} /> </div> {isServiceDropdownOpen && ( <div style={serviceDropdownStyle}> <div style={serviceDropdownItemStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemStyle.backgroundColor!} onClick={() => selectServiceType('self')}>{t.serviceForSelf}</div> <div style={serviceDropdownItemStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = serviceDropdownItemStyle.backgroundColor!} onClick={() => selectServiceType('other')}>{t.serviceForOther}</div> </div> )} </div> )} </div>
        <div style={{ pointerEvents: 'auto', display: 'flex', gap: '0.5rem' }}>
            {selectionMode === 'origin' && !showServiceSheet && !showTripInProgressSheet && !showDriverSearchSheet &&
                <button style={topBarButtonStyle} aria-label={t.geminiSuggestButtonLabel} onClick={() => setShowSuggestionModal(true)}>
                    <GeminiSuggestIcon />
                </button>
            }
            <button style={topBarButtonStyle} aria-label={t.profileButtonAriaLabel} onClick={onNavigateToProfile}><ProfileIcon /></button>
        </div>
      </div>
      <button style={gpsButtonStyle} onClick={handleGpsClick} aria-label={t.gpsButtonAriaLabel}><GpsIcon /></button>
      <div style={bottomPanelStyle}>
        {serviceFor === 'other' && (
            <div style={{ marginBottom: '0.5rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem' }}>
                <input type="text" placeholder={t.passengerNameLabel} value={thirdPartyName} onChange={(e) => { setThirdPartyName(e.target.value); if (thirdPartyFormError) setThirdPartyFormError(''); }} style={{...addressInputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '0.75rem', backgroundColor: '#fff', border: '1px solid #ddd', padding: '0.75rem'}} />
                <input type="tel" placeholder={t.passengerPhoneLabel} value={thirdPartyPhone} onChange={(e) => { const value = e.target.value.replace(/[^0-9]/g, ''); setThirdPartyPhone(value); if (thirdPartyFormError) setThirdPartyFormError(''); }} style={{...addressInputStyle, width: '100%', boxSizing: 'border-box', backgroundColor: '#fff', border: '1px solid #ddd', padding: '0.75rem'}} maxLength={10} dir="ltr" />
            </div>
        )}
        <div style={searchSectionStyle} ref={searchContainerRef}>
          <div style={addressInputContainerStyle}> 
              <div style={addressPointStyle} /> 
              <input type="text" style={addressInputStyle} value={isLoadingAddress ? t.addressLoading : (isSearching ? t.searchingAddress : searchQuery)} onChange={handleSearchInputChange} onFocus={handleSearchFocus} placeholder={selectionMode === 'origin' ? t.searchPlaceholderOrigin : t.searchPlaceholderDestination} readOnly={isLoadingAddress} aria-label={t.searchAddressLabel} dir={isRTL ? 'rtl': 'ltr'} /> 
              <button style={ { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0 } } disabled={isSearching || isLoadingAddress} > 
                {isSearching ? <div style={{width:'1rem', height:'1rem', border:'2px solid #ccc', borderTopColor:'#555', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div> : <SearchIcon />} 
              </button> 
          </div>
          {isSearchFocused && searchResults.length > 0 && (
            <div style={searchResultsContainerStyle}>
                {searchResults.map((result, index) => (
                    <div 
                        key={`${result.type}-${index}`} 
                        style={searchResultItemStyle} 
                        onClick={() => handleSelectSearchResult(result)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = searchResultItemHoverStyle.backgroundColor!}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                    >
                        {result.type === 'saved' && <StarIcon filled={true} style={{width: '1rem', height: '1rem', color: '#F59E0B', flexShrink:0}} />}
                        {result.type === 'nominatim' && <LocationMarkerIcon color="#718096" style={{width: '1rem', height: '1rem', flexShrink:0}} />}
                        <span style={searchResultTextStyle} title={result.displayName}>{result.displayName}</span>
                    </div>
                ))}
            </div>
          )}
        </div>
        {searchError || thirdPartyFormError ? <p style={searchErrorStyle} role="alert">{searchError || thirdPartyFormError}</p> : <div style={{...searchErrorStyle, visibility: 'hidden'}}>Placeholder</div> }
        {!isUserVerified && <p style={verificationWarningStyle}>{t.accountNotVerifiedWarning}</p>}
        <button style={currentConfirmMainButtonStyle} onMouseEnter={() => setIsConfirmMainButtonHovered(true)} onMouseLeave={() => setIsConfirmMainButtonHovered(false)} onClick={handleConfirmOriginOrDestination} disabled={isLoadingAddress || isSearching || !address || isThirdPartyFormInvalid || !isUserVerified || searchResults.length > 0} > {selectionMode === 'origin' ? t.confirmOriginButton : t.confirmDestinationButton} </button>
      </div>
      {showServiceSheet && confirmedOrigin && confirmedDestination && ( <ServiceSelectionSheet currentLang={currentLang} originAddress={confirmedOrigin.address} destinationAddress={confirmedDestination.address} routeDistanceKm={routeDistanceKm} isCalculatingDistance={isCalculatingDistance} distanceError={distanceError} onClose={handleCloseServiceSheet} onRequestRide={handleRequestRideFromSheet} serviceCategories={appServiceCategories} isLoadingServices={isLoadingServicesGlobal} serviceFetchError={serviceFetchErrorGlobal} /> )}
      {showDriverSearchSheet && tripActions.getSelectedService() && ( <DriverSearchSheet currentLang={currentLang} searchState={driverSearchState} notifiedDriverCount={notifiedDriverCount} onRetry={tripActions.retryRideRequest} onCancel={resetToInitialMapState} onClose={resetToInitialMapState} selectedServiceName={t[tripActions.getSelectedService()!.nameKey] || tripActions.getSelectedService()!.id} /> )}
      {showTripInProgressSheet && currentDriverDetails && ( <TripInProgressSheet currentLang={currentLang} driverDetails={currentDriverDetails} tripFare={currentTripFare} tripPhase={tripPhase} estimatedTimeToDestination={estimatedTimeToDestination} displayLevel={tripSheetDisplayLevel} onSetDisplayLevel={tripActions.setTripSheetDisplayLevel} onChangeDestination={() => {}} onApplyCoupon={() => {}} onRideOptions={() => {}} onCancelTrip={tripActions.openCancellationModal} onSafety={() => {}} onClose={resetToInitialMapState} appServices={allAppServices} /> )}
      {isCancellationModalOpen && ( <CancellationModal isOpen={isCancellationModalOpen} onClose={tripActions.closeCancellationModal} onSubmit={tripActions.submitCancellation} userRole={'passenger'} currentLang={currentLang} isSubmitting={isSubmittingCancellation} /> )}
      {showSuggestionModal && ( <GeminiSuggestionModal currentLang={currentLang} userLocation={currentUserLocation} onClose={() => { setShowSuggestionModal(false); setSuggestedDestinations([]); }} onDestinationSelect={handleDestinationSuggested} onSuggestionsLoaded={setSuggestedDestinations} /> )}
    </div>
  );
};