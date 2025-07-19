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
    onArrivedAtPickup: () => void;
    onStartTrip: () => void;
    onEndTrip: () => void;
    onCancelTrip: () => void;
    onOpenChat: () => void;
    onActionClick: () => void; // New prop to handle panel collapsing
}

export const CurrentTripDetailsPanel: React.FC<CurrentTripDetailsPanelProps> = ({
    currentLang,
    trip,
    passenger,
    isLoadingPassenger,
    passengerFetchError,
    currentPhase,
    onArrivedAtPickup,
    onStartTrip,
    onEndTrip,
    onCancelTrip,
    onOpenChat,
    onActionClick,
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
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.75rem',
        marginBottom: '1rem',
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

    const primaryActionButtonStyle: CSSProperties = {
        ...actionButtonStyle,
        gridColumn: '1 / -1', // Span full width
        padding: '1rem',
        fontSize: '1.1rem',
    };

    const callButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#17a2b8' };
    const chatButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#6c757d' };
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
        onActionClick();
        if (passenger?.phoneNumber) {
            window.location.href = `tel:${passenger.phoneNumber}`;
        }
    };
    
    const handleOpenChat = () => {
        onActionClick();
        onOpenChat();
    }

    const renderPassengerInfo = () => {
        if (isLoadingPassenger) return <p style={loadingErrorStyle}>{t.passengerDetailsLoading}</p>;
        if (passengerFetchError) return <p style={{...loadingErrorStyle, color: 'red'}}>{passengerFetchError}</p>;
        
        let passengerImageUrl: string | undefined;
        if (passenger?.profilePicUrl) {
            try {
                const parsed = JSON.parse(passenger.profilePicUrl);
                passengerImageUrl = parsed.url;
            } catch (e) {
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
                <p style={passengerNameStyle}>{passenger?.fullName || trip.passenger_name || <span style={dataMissingStyle}>{t.dataMissing}</span>}</p>
            </div>
        );
    };

    const renderPrimaryActionButton = () => {
        let text = '';
        let action = () => {};
        let style = {};

        switch(currentPhase) {
            case DriverTripPhase.EN_ROUTE_TO_PICKUP:
                text = t.arrivedAtPickupButtonLabel;
                action = onArrivedAtPickup;
                style = { backgroundColor: '#007bff' };
                break;
            case DriverTripPhase.AT_PICKUP:
                text = t.startTripButtonLabel;
                action = onStartTrip;
                style = { backgroundColor: '#28a745' };
                break;
            case DriverTripPhase.EN_ROUTE_TO_DESTINATION:
                text = t.endTripButtonLabel;
                action = onEndTrip;
                style = { backgroundColor: '#dc3545' };
                break;
            default:
                return null;
        }
        
        return (
            <button style={{...primaryActionButtonStyle, ...style}} onClick={() => { action(); onActionClick(); }}>
                {text}
            </button>
        )
    }

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
                
                {renderPrimaryActionButton()}

                <div style={actionButtonsContainerStyle}>
                    <button style={passenger?.phoneNumber ? callButtonStyle : {...callButtonStyle, ...disabledButtonStyle}} onClick={handleCall} disabled={!passenger?.phoneNumber}>
                        <PhoneIcon style={buttonIconStyle} />
                        {t.callButtonLabel}
                    </button>
                    <button style={chatButtonStyle} onClick={handleOpenChat}>
                        <MessageBubbleIcon style={buttonIconStyle} />
                        {t.chatButtonLabel}
                    </button>
                     <button style={{...actionButtonStyle, backgroundColor: '#6c757d'}} onClick={() => { onCancelTrip(); onActionClick(); }} >
                        <CancelRideIcon style={buttonIconStyle} />
                        {t.cancelRideButton}
                    </button>
                    <button style={{...actionButtonStyle, backgroundColor: '#ffc107', color: '#212529'}}>
                        <NavigationIcon style={buttonIconStyle} />
                        {t.navigateToPickupButtonLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};