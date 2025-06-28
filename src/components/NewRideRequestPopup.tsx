import React, { useEffect, useRef, CSSProperties } from 'react';
import ReactDOMServer from 'react-dom/server';
import L from 'leaflet';
import { translations, Language } from '../translations';
import { AppService, RideRequest } from '../types';
import { getDistanceFromLatLonInKm } from '../utils/helpers';
import { LocationMarkerIcon, DestinationMarkerIcon } from './icons'; // Removed DriverCarIcon

interface NewRideRequestPopupProps {
    currentLang: Language;
    request: RideRequest;
    allAppServices: AppService[];
    timer: number;
    onAccept: () => void;
    onDecline: () => void;
    // simulatedDriverLocation prop removed
}

export const NewRideRequestPopup: React.FC<NewRideRequestPopupProps> = ({
    currentLang, request, allAppServices, timer, onAccept, onDecline
}) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);

    const service = allAppServices.find(s => s.id === request.service_id);
    const serviceName = service ? (t[service.nameKey] || request.service_id) : t.defaultServiceName;

    // distanceToPickup calculation removed as simulatedDriverLocation is removed

    const estimatedTotalTripTime = Math.round(
        getDistanceFromLatLonInKm(request.origin_lat, request.origin_lng, request.destination_lat, request.destination_lng) * 2.5 + 10 // km * 2.5 min/km + 10 min base
    );


    useEffect(() => {
        if (mapRef.current && !mapInstance.current) {
            const newMap = L.map(mapRef.current, {
                zoomControl: false,
                attributionControl: false,
                dragging: false, 
                scrollWheelZoom: false,
                doubleClickZoom: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(newMap);
            mapInstance.current = newMap;
        }

        if (mapInstance.current) {
            mapInstance.current.eachLayer(layer => {
                if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                    mapInstance.current?.removeLayer(layer);
                }
            });

            // DriverCarIcon marker removed

            const originIconHTML = ReactDOMServer.renderToString(<LocationMarkerIcon color="#34A853" style={{width: '2rem', height: '2rem'}}/>);
            const originLeafletIcon = L.divIcon({ html: originIconHTML, className: 'origin-popup-icon', iconSize: [24,24], iconAnchor: [12,24] });
            L.marker([request.origin_lat, request.origin_lng], { icon: originLeafletIcon }).addTo(mapInstance.current);

            const destIconHTML = ReactDOMServer.renderToString(<DestinationMarkerIcon color="#EA4335" style={{width: '2rem', height: '2rem'}}/>);
            const destLeafletIcon = L.divIcon({ html: destIconHTML, className: 'dest-popup-icon', iconSize: [24,24], iconAnchor: [12,12] });
            L.marker([request.destination_lat, request.destination_lng], { icon: destLeafletIcon }).addTo(mapInstance.current);

            const bounds = L.latLngBounds([
                //simulatedDriverLocation removed from bounds
                [request.origin_lat, request.origin_lng],
                [request.destination_lat, request.destination_lng]
            ]);
            mapInstance.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });

            L.polyline([[request.origin_lat, request.origin_lng], [request.destination_lat, request.destination_lng]], { color: '#4285F4', weight: 3 }).addTo(mapInstance.current);
        }

    }, [request]);

    const popupStyle: CSSProperties = {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '450px',
        height: 'auto',
        maxHeight: '85vh',
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        direction: isRTL ? 'rtl' : 'ltr',
    };

    const mapContainerStyle: CSSProperties = {
        width: '100%',
        height: '180px',
        backgroundColor: '#f0f0f0',
    };

    const contentStyle: CSSProperties = {
        padding: '1rem',
        flexGrow: 1,
        overflowY: 'auto',
    };

    const titleStyle: CSSProperties = {
      fontSize: '1.25rem',
      fontWeight: 'bold',
      color: '#202124',
      textAlign: 'center',
      marginBottom: '1rem',
    };

    const detailItemStyle: CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.9rem',
        marginBottom: '0.6rem',
        paddingBottom: '0.6rem',
        borderBottom: '1px solid #e8eaed',
    };
    const detailLabelStyle: CSSProperties = { color: '#5f6368', fontWeight: 500 };
    const detailValueStyle: CSSProperties = { color: '#202124', fontWeight: 'bold', textAlign: isRTL ? 'left' : 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
    const fareValueStyle: CSSProperties = { ...detailValueStyle, color: '#1a73e8' };

    const timerContainerStyle: CSSProperties = {
        textAlign: 'center',
        margin: '1rem 0',
    };
    const timerTextStyle: CSSProperties = {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: timer <= 5 ? '#d93025' : '#1a73e8',
        padding: '0.5rem 1rem',
        borderRadius: '2rem',
        backgroundColor: timer <=5 ? 'rgba(217, 48, 37, 0.1)' : 'rgba(26, 115, 232, 0.1)',
        display: 'inline-block',
    };

    const buttonContainerStyle: CSSProperties = {
        display: 'flex',
        gap: '0.75rem',
        marginTop: '1rem',
    };
    const buttonBaseStyle: CSSProperties = {
        flex: 1,
        padding: '0.875rem 1rem',
        fontSize: '1rem',
        fontWeight: 'bold',
        borderRadius: '0.5rem',
        border: 'none',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    };
    const acceptBtnStyle: CSSProperties = { ...buttonBaseStyle, backgroundColor: '#34a853', color: 'white' };
    const declineBtnStyle: CSSProperties = { ...buttonBaseStyle, backgroundColor: '#ea4335', color: 'white' };

    return (
        <div style={popupStyle}>
            <div ref={mapRef} style={mapContainerStyle} aria-label={t.mapScreenTitleOrigin + " and " + t.mapScreenTitleDestination}></div>
            <div style={contentStyle}>
                <h2 style={titleStyle}>{t.newRideRequestTitle}</h2>

                <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>{t.pickupLocationLabel}:</span>
                    <span style={detailValueStyle} title={request.origin_address}>{request.origin_address}</span>
                </div>
                <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>{t.dropoffLocationLabel}:</span>
                    <span style={detailValueStyle} title={request.destination_address}>{request.destination_address}</span>
                </div>
                 <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>{t.requestFareLabel}:</span>
                    <span style={fareValueStyle}>
                      {t.earningsAmountUnit.replace('{amount}', Math.round(request.estimated_fare ?? 0).toLocaleString(isRTL ? 'fa-IR' : 'en-US'))}
                    </span>
                </div>
                {/* Distance to Pickup removed */}
                <div style={detailItemStyle}>
                    <span style={detailLabelStyle}>{t.estimatedTripTimeLabel}:</span>
                    <span style={detailValueStyle}>{estimatedTotalTripTime} {t.etaUnitMinutes}</span>
                </div>
                <div style={{...detailItemStyle, borderBottom: 'none'}}>
                    <span style={detailLabelStyle}>{t.serviceCategoryPassenger}:</span>
                    <span style={detailValueStyle}>{serviceName}</span>
                </div>


                <div style={timerContainerStyle}>
                    <span style={timerTextStyle}>{timer} {t.secondsSuffix}</span>
                </div>

                <div style={buttonContainerStyle}>
                    <button style={declineBtnStyle} onClick={onDecline}>{t.declineButton}</button>
                    <button style={acceptBtnStyle} onClick={onAccept}>{t.acceptRideButton}</button>
                </div>
            </div>
        </div>
    );
};