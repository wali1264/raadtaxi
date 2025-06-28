import React, { CSSProperties } from 'react';
import { RideRequest, PassengerDetails, DriverTripPhase } from '../types';
import { translations, Language } from '../translations';
import { PhoneIcon, MessageBubbleIcon, NavigationIcon, UserCircleIcon, CancelRideIcon } from './icons';

interface CurrentTripDetailsPanelProps {
    currentLang: Language;
    trip: RideRequest;
    passenger: PassengerDetails | null;
    isLoadingPassenger: boolean;
    passengerFetchError: string | null;
    currentPhase: DriverTripPhase;
    onNavigateToPickup: () => void;
    onStartTrip: () => void;
    onEndTrip: () => void;
    onCancelTrip: () => void;
}

export const CurrentTripDetailsPanel: React.FC<CurrentTripDetailsPanelProps> = ({
    currentLang,
    trip,
    passenger,
    isLoadingPassenger,
    passengerFetchError,
    currentPhase,
    onNavigateToPickup,
    onStartTrip,
    onEndTrip,
    onCancelTrip,
}) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';

    const panelStyle: CSSProperties = {
        padding: '1rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#333',
    };

    const sectionStyle: CSSProperties = {
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e0e0e0',
    };
    const lastSectionStyle: CSSProperties = {
        ...sectionStyle,
        borderBottom: 'none',
        marginBottom: 0,
        paddingBottom: 0,
    };

    const sectionTitleStyle: CSSProperties = { 
        fontSize: '1rem',
        fontWeight: '600',
        color: '#4A5568',
        marginBottom: '0.75rem',
    };

    const profilePicStyle: CSSProperties = {
        width: '70px',
        height: '70px',
        borderRadius: '50%',
        objectFit: 'cover',
        margin: isRTL ? '0 0 0.5rem 0' : '0 0 0.5rem 0', 
        backgroundColor: '#e2e8f0',
        display: 'block', 
    };
    
    const passengerInfoContainerStyle: CSSProperties = {
        display: 'flex',
        flexDirection: 'column', 
        alignItems: 'center', 
        textAlign: 'center',
    };

    const passengerNameStyle: CSSProperties = {
        fontSize: '1.1rem',
        fontWeight: 'bold',
        marginBottom: '0.25rem',
    };

    const passengerPhoneContainerStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.9rem',
        color: '#555',
        marginBottom: '0.5rem',
    };

    const phoneButtonStyle: CSSProperties = {
        background: 'none',
        padding: '0.3rem', 
        border: '1px solid #007bff', 
        borderRadius: '50%', 
        color: '#007bff', 
        cursor: 'pointer',
        [isRTL ? 'marginRight' : 'marginLeft']: '0.75rem', 
        display: 'inline-flex', 
        alignItems: 'center',
        justifyContent: 'center',
    };
    const phoneIconInnerStyle: CSSProperties = {
        width: '1rem', 
        height: '1rem',
    };

    const chatIconStyle: CSSProperties = { 
        width: '1rem',
        height: '1rem',
    };
    const chatButtonStyle: CSSProperties = { 
        background: 'none',
        padding: '0.3rem',
        border: '1px solid #ccc',
        borderRadius: '50%',
        color: '#ccc',
        cursor: 'not-allowed',
        [isRTL ? 'marginRight' : 'marginLeft']: '0.5rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };


    const addressStyle: CSSProperties = {
        fontSize: '0.9rem',
        marginBottom: '0.5rem',
        lineHeight: 1.5,
        textAlign: isRTL ? 'right' : 'left', 
    };
    const addressLabelStyle: CSSProperties = {
        fontWeight: 500,
        color: '#5f6368',
    };

    const actionButtonsContainerStyle: CSSProperties = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
    };

    const actionButtonStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem 1rem',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        transition: 'background-color 0.2s, opacity 0.2s',
    };
    const navigateButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#007bff' };
    const startButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#28a745' };
    const endButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#dc3545' };
    const cancelButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#6c757d' };
    const disabledButtonStyle: CSSProperties = { backgroundColor: '#adb5bd', cursor: 'not-allowed' };

    const buttonIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.5rem' };
    
    const loadingErrorStyle: CSSProperties = {
        textAlign: 'center',
        color: '#718096',
        padding: '1rem 0',
        fontSize: '0.9rem',
    };
    const dataMissingStyle: CSSProperties = {
      fontStyle: 'italic',
      color: '#718096',
    };

    const handleCall = () => {
        if (passenger?.phoneNumber) {
            window.location.href = `tel:${passenger.phoneNumber}`;
        }
    };

    const renderPassengerInfo = () => {
        if (isLoadingPassenger) return <p style={loadingErrorStyle}>{t.passengerDetailsLoading}</p>;
        if (passengerFetchError) return <p style={{...loadingErrorStyle, color: 'red'}}>{passengerFetchError}</p>;
        
        let passengerImageUrl: string | undefined;
        if (passenger?.profilePicUrl) {
            try {
                const parsed = JSON.parse(passenger.profilePicUrl);
                passengerImageUrl = parsed.url;
            } catch (e) {
                // Legacy data might be a plain URL
                passengerImageUrl = passenger.profilePicUrl;
            }
        }

        return (
            <div style={passengerInfoContainerStyle}>
                {passengerImageUrl ? (
                    <img src={passengerImageUrl} alt={t.profilePictureLabelAltText} style={profilePicStyle} />
                ) : (
                    <UserCircleIcon style={profilePicStyle} />
                )}
                <div>
                    <p style={passengerNameStyle}>{passenger?.fullName || <span style={dataMissingStyle}>{t.dataMissing}</span>}</p>
                    <div style={passengerPhoneContainerStyle}>
                        <span>{passenger?.phoneNumber || <span style={dataMissingStyle}>{t.dataMissing}</span>}</span>
                        <button onClick={handleCall} aria-label={t.callButtonLabel} style={phoneButtonStyle}>
                            <PhoneIcon style={phoneIconInnerStyle} />
                        </button>
                        <button aria-label={t.chatButtonLabel} style={chatButtonStyle} disabled>
                             <MessageBubbleIcon style={chatIconStyle} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const canNavigateToPickup = currentPhase === DriverTripPhase.EN_ROUTE_TO_PICKUP;
    const canStartTrip = currentPhase === DriverTripPhase.EN_ROUTE_TO_PICKUP || currentPhase === DriverTripPhase.AT_PICKUP;
    const isRidePhase = currentPhase === DriverTripPhase.EN_ROUTE_TO_DESTINATION;

    return (
        <div style={panelStyle}>
            <div style={sectionStyle}>
                {renderPassengerInfo()}
            </div>

            <div style={sectionStyle}>
                <p style={addressStyle}>
                    <span style={addressLabelStyle}>{t.requestFromLabel} </span> 
                    {trip.origin_address || <span style={dataMissingStyle}>{t.dataMissing}</span>}
                </p>
            </div>

            <div style={sectionStyle}>
                <p style={addressStyle}>
                    <span style={addressLabelStyle}>{t.requestToLabel} </span>
                    {trip.destination_address || <span style={dataMissingStyle}>{t.dataMissing}</span>}
                </p>
            </div>
            
            <div style={lastSectionStyle}>
                <h3 style={sectionTitleStyle}>{t.tripActionsSectionTitle}</h3>
                <div style={actionButtonsContainerStyle}>
                    <button style={canNavigateToPickup ? navigateButtonStyle : {...navigateButtonStyle, ...disabledButtonStyle}} onClick={onNavigateToPickup} disabled={!canNavigateToPickup}>
                        <NavigationIcon style={buttonIconStyle} />
                        {t.navigateToPickupButtonLabel}
                    </button>
                     <button style={canStartTrip ? startButtonStyle : {...startButtonStyle, ...disabledButtonStyle}} onClick={onStartTrip} disabled={!canStartTrip}>
                        {t.startTripButtonLabel}
                    </button>
                    <button style={isRidePhase ? endButtonStyle : {...endButtonStyle, ...disabledButtonStyle}} onClick={onEndTrip} disabled={!isRidePhase}>
                        {t.endTripButtonLabel}
                    </button>
                     <button style={currentPhase !== DriverTripPhase.NONE ? cancelButtonStyle : {...cancelButtonStyle, ...disabledButtonStyle}} onClick={onCancelTrip} disabled={currentPhase === DriverTripPhase.NONE}>
                        <CancelRideIcon style={buttonIconStyle} />
                        {t.cancelRideButton}
                    </button>
                </div>
            </div>
        </div>
    );
};
