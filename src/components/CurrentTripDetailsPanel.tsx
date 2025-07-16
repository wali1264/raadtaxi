
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
    onArrivedAtPickup: () => void;
    onStartTrip: () => void;
    onNavigateToDestination: () => void;
    onArrivedAtDestination: () => void;
    onEndTrip: () => void;
    onCancelTrip: () => void;
    onOpenChat: () => void;
}

export const CurrentTripDetailsPanel: React.FC<CurrentTripDetailsPanelProps> = ({
    currentLang,
    trip,
    passenger,
    isLoadingPassenger,
    passengerFetchError,
    currentPhase,
    onNavigateToPickup,
    onArrivedAtPickup,
    onStartTrip,
    onNavigateToDestination,
    onArrivedAtDestination,
    onEndTrip,
    onCancelTrip,
    onOpenChat,
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

    const mainActionButtonStyle: CSSProperties = {
        gridColumn: '1 / -1', // Span across both columns
        padding: '0.875rem 1rem',
        fontSize: '1rem',
        fontWeight: 'bold',
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
    const primaryButtonStyle: CSSProperties = { ...actionButtonStyle, ...mainActionButtonStyle, backgroundColor: '#007bff' };
    const successButtonStyle: CSSProperties = { ...actionButtonStyle, ...mainActionButtonStyle, backgroundColor: '#28a745' };
    const dangerButtonStyle: CSSProperties = { ...actionButtonStyle, ...mainActionButtonStyle, backgroundColor: '#dc3545' };
    
    const secondaryButtonContainerStyle: CSSProperties = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        marginTop: '1rem',
        gridColumn: '1 / -1',
    };

    const callButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#17a2b8' };
    const chatButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#6c757d' };
    const cancelButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#6c757d', gridColumn: '1 / -1', marginTop: '0.5rem' };

    const disabledButtonStyle: CSSProperties = { backgroundColor: '#adb5bd', cursor: 'not-allowed' };
    const buttonIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.5rem' };
    const loadingErrorStyle: CSSProperties = { textAlign: 'center', color: '#718096', padding: '1rem 0', fontSize: '0.9rem' };
    const dataMissingStyle: CSSProperties = { fontStyle: 'italic', color: '#718096' };

    const handleCall = () => { if (passenger?.phoneNumber) window.location.href = `tel:${passenger.phoneNumber}`; };

    const renderPassengerInfo = () => {
        if (isLoadingPassenger) return <p style={loadingErrorStyle}>{t.passengerDetailsLoading}</p>;
        if (passengerFetchError) return <p style={{...loadingErrorStyle, color: 'red'}}>{passengerFetchError}</p>;
        
        const passengerImageUrl = passenger?.profilePicUrl || `https://ui-avatars.com/api/?name=${(passenger?.fullName || trip.passenger_name || 'P').replace(' ', '+')}&background=random`;

        return (
            <div style={passengerInfoContainerStyle}>
                <img src={passengerImageUrl} alt={t.profilePictureLabelAltText} style={profilePicStyle} />
                <p style={passengerNameStyle}>{passenger?.fullName || trip.passenger_name || <span style={dataMissingStyle}>{t.dataMissing}</span>}</p>
            </div>
        );
    };

    const renderMainAction = () => {
        switch (currentPhase) {
            case DriverTripPhase.EN_ROUTE_TO_PICKUP:
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button style={primaryButtonStyle} onClick={onNavigateToPickup}>
                            <NavigationIcon style={buttonIconStyle} />
                            {t.navigateToPickupButtonLabel}
                        </button>
                        <button style={successButtonStyle} onClick={onArrivedAtPickup}>
                            {t.driverArrivedAtPickupButtonLabel}
                        </button>
                    </div>
                );
            case DriverTripPhase.AT_PICKUP:
                return (
                    <button style={successButtonStyle} onClick={onStartTrip}>
                        {t.startTripButtonLabel}
                    </button>
                );
            case DriverTripPhase.EN_ROUTE_TO_DESTINATION:
                 return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button style={primaryButtonStyle} onClick={onNavigateToDestination}>
                             <NavigationIcon style={buttonIconStyle} />
                            {t.navigateToDestinationButtonLabel}
                        </button>
                        <button style={successButtonStyle} onClick={onArrivedAtDestination}>
                            {t.driverArrivedAtDestinationButtonLabel}
                        </button>
                    </div>
                );
            case DriverTripPhase.AT_DESTINATION:
                 return (
                    <button style={dangerButtonStyle} onClick={onEndTrip}>
                        {t.endTripButtonLabel}
                    </button>
                );
            default:
                return null;
        }
    };


    return (
        <div style={panelStyle}>
            <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>{t.passengerInfoSectionTitle}</h3>
                {renderPassengerInfo()}
            </div>
            
            <div style={sectionStyle}>
                <p style={addressStyle}>
                    <span style={addressLabelStyle}>{t.originLabel}: </span> 
                    {trip.origin_address || <span style={dataMissingStyle}>{t.dataMissing}</span>}
                </p>
                <p style={addressStyle}>
                    <span style={addressLabelStyle}>{t.destinationLabel}: </span>
                    {trip.destination_address || <span style={dataMissingStyle}>{t.dataMissing}</span>}
                </p>
            </div>
            
            <div style={lastSectionStyle}>
                <h3 style={sectionTitleStyle}>{t.tripActionsSectionTitle}</h3>
                {renderMainAction()}
                <div style={secondaryButtonContainerStyle}>
                     <button style={passenger?.phoneNumber ? callButtonStyle : {...callButtonStyle, ...disabledButtonStyle}} onClick={handleCall} disabled={!passenger?.phoneNumber}>
                        <PhoneIcon style={buttonIconStyle} />
                        {t.callButtonLabel}
                    </button>
                    <button style={chatButtonStyle} onClick={onOpenChat}>
                        <MessageBubbleIcon style={buttonIconStyle} />
                        {t.chatButtonLabel}
                    </button>
                </div>
                 <button style={currentPhase !== DriverTripPhase.NONE ? cancelButtonStyle : {...cancelButtonStyle, ...disabledButtonStyle}} onClick={onCancelTrip} disabled={currentPhase === DriverTripPhase.NONE}>
                    <CancelRideIcon style={buttonIconStyle} />
                    {t.cancelRideButton}
                </button>
            </div>
        </div>
    );
};
