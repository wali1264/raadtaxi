
import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { translations, Language } from '../translations';
import { AppService, DriverDetails, TripPhase, TripSheetDisplayLevel } from '../types';
import { StarRating } from './StarRating';
import { LicensePlateAFGIcon } from './LicensePlateAFGIcon';
import { PhoneIcon, MessageBubbleIcon, ClockIcon, EditLocationIcon, TagIcon, RideOptionsIcon, SafetyShieldIcon, CancelRideIcon, RightArrowIcon } from './icons';

interface TripInProgressSheetProps {
  currentLang: Language;
  driverDetails: DriverDetails;
  tripFare: number | null;
  tripPhase: TripPhase;
  estimatedTimeToDestination: number | null;
  displayLevel: TripSheetDisplayLevel;
  onToggleDisplayLevel: () => void;
  onCallDriver: () => void;
  onMessageDriver: () => void;
  onPayment: () => void;
  onChangeDestination: () => void;
  onApplyCoupon: () => void;
  onRideOptions: () => void;
  onCancelTrip: () => void;
  onSafety: () => void;
  onClose: () => void;
  appServices: AppService[];
}

export const TripInProgressSheet: React.FC<TripInProgressSheetProps> = ({
  currentLang, driverDetails, tripFare, tripPhase, estimatedTimeToDestination,
  displayLevel, onToggleDisplayLevel, onCallDriver, onMessageDriver, onPayment,
  onChangeDestination, onApplyCoupon, onRideOptions, onCancelTrip, onSafety, onClose,
  appServices
}) => {
  const t = translations[currentLang]; const isRTL = currentLang !== 'en';
  const sheetRef = useRef<HTMLDivElement>(null);
  const [currentRating, setCurrentRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => { if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; } }, []);
  useEffect(() => { if (tripPhase === 'arrivedAtDestination') setCurrentRating(0); }, [tripPhase]);


  const service = appServices.find(s => s.id === driverDetails.serviceId);
  const serviceName = service ? (t[service.nameKey] || t.defaultServiceName) : driverDetails.serviceId;
  const vehicleDescription = `${serviceName} - ${driverDetails.vehicleColor}`;

  let sheetTitleText = t.driverAssignedTitle;
  if (tripPhase === 'enRouteToDestination') { sheetTitleText = t.tripInProgressTitle;
  } else if (tripPhase === 'arrivedAtDestination') { sheetTitleText = t.tripEndedSuccessfullyTitle; }

  const tripStatusMessage = tripPhase === 'enRouteToDestination' ? t.enRouteToDestinationStatus : null;

  const getSheetHeight = () => {
    if (tripPhase === 'arrivedAtDestination') return 'auto';
    if (displayLevel === 'peek') return '180px';
    if (displayLevel === 'default') return '320px';
    if (displayLevel === 'full') return '85vh';
    return '320px';
  };

  const sheetStyle: CSSProperties = { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '0.75rem 1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', transform: 'translateY(100%)', transition: 'transform 0.3s ease-out, height 0.3s ease-out', zIndex: 1250, direction: isRTL ? 'rtl' : 'ltr', height: getSheetHeight(), maxHeight: '85vh', overflow: displayLevel === 'full' && tripPhase !== 'arrivedAtDestination' ? 'hidden' : 'visible' };
  const handleStyle: CSSProperties = { width: '40px', height: '4px', backgroundColor: '#ccc', borderRadius: '2px', margin: '0.25rem auto 0.5rem', cursor: 'pointer', flexShrink: 0, };
  const topContentStyle: CSSProperties = { padding: '0 0.5rem', flexShrink: 0, overflowY: displayLevel === 'peek' || displayLevel === 'default' ? 'hidden' : 'auto' };
  const sheetTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: '0.25rem' };
  const tripStatusMessageStyle: CSSProperties = { fontSize: '0.85rem', color: '#059669', textAlign: 'center', marginBottom: '0.75rem', fontWeight: 500 };
  const driverInfoContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '0.75rem', };
  const driverImageStyle: CSSProperties = { width: displayLevel === 'peek' ? '3rem' : '4rem', height: displayLevel === 'peek' ? '3rem' : '4rem', borderRadius: '50%', backgroundColor: '#e0e0e0', [isRTL ? 'marginLeft' : 'marginRight']: '1rem', objectFit: 'cover', transition: 'width 0.3s, height 0.3s' };
  const driverTextInfoStyle: CSSProperties = { flexGrow: 1 };
  const driverNameStyle: CSSProperties = { fontSize: displayLevel === 'peek' ? '1rem':'1.1rem', fontWeight: 'bold', color: '#333' };
  const carModelStyle: CSSProperties = { fontSize: displayLevel === 'peek' ? '0.8rem':'0.9rem', color: '#555', marginTop: '0.1rem' };
  const plateContainerStyle: CSSProperties = { marginTop: '0.25rem', transform: displayLevel === 'peek' ? 'scale(0.9)' : 'scale(1)', transformOrigin: isRTL ? 'right' : 'left', transition: 'transform 0.3s' };
  const actionButtonsContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-around', marginBottom: '0.75rem', };
  const contactButtonStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#007bff', fontSize: '0.8rem', padding: '0.5rem' };
  const contactButtonIconStyle: CSSProperties = { marginBottom: '0.25rem', fontSize: '1.5rem' };
  const etaAndFareContainer: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.5rem', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', marginBottom: '0.75rem' };
  const etaContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#555' };
  const etaIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.35rem', color: '#555'};
  const fareInfoStyle: CSSProperties = { fontSize: '0.9rem', color: '#333', textAlign: isRTL ? 'left' : 'right' };
  const fareAmountStyle: CSSProperties = { fontWeight: 'bold', color: '#10B981' };
  const insufficientBalanceStyle: CSSProperties = { fontSize: '0.75rem', color: 'red', marginTop: '0.1rem', textAlign: isRTL ? 'left' : 'right' };
  const payButtonStyle: CSSProperties = { backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '0.375rem', padding: '0.6rem 1.2rem', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' };
  const expandedContentStyle: CSSProperties = { flexGrow: 1, overflowY: 'auto', padding: '0 0.5rem', display: displayLevel === 'full' ? 'block' : 'none' };
  const optionListItemStyle: CSSProperties = { display: 'flex', alignItems: 'center', padding: '0.85rem 0.25rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '0.95rem', color: '#333' };
  const optionListItemIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', color: '#555', fontSize: '1.1rem' };
  const optionListItemTextStyle: CSSProperties = { flexGrow: 1 };
  const changeDestinationButtonStyle: CSSProperties = { ...optionListItemStyle, backgroundColor: tripPhase === 'enRouteToDestination' ? '#e6f7f0' : undefined, border: tripPhase === 'enRouteToDestination' ? '1px solid #10b981' : optionListItemStyle.borderBottom, borderRadius: tripPhase === 'enRouteToDestination' ? '0.375rem' : undefined, marginBottom: tripPhase === 'enRouteToDestination' ? '0.5rem' : undefined, marginTop: tripPhase === 'enRouteToDestination' ? '0.25rem' : undefined };
  const cancelRideListItemStyle: CSSProperties = { ...optionListItemStyle, color: '#D32F2F' };
  const cancelRideIconStyle: CSSProperties = { ...optionListItemIconStyle, color: '#D32F2F' };
  const ratingPromptStyle: CSSProperties = { textAlign: 'center', fontSize: '1rem', color: '#333', margin: '1rem 0 0.5rem 0' };
  const ratingButtonContainerStyle: CSSProperties = { display: 'flex', gap: '1rem', marginTop: '1rem', padding: '0 0.5rem' };
  const ratingSubmitButtonStyle: CSSProperties = { flex: 1, padding: '0.75rem', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', opacity: currentRating > 0 ? 1 : 0.5 };
  const ratingSkipButtonStyle: CSSProperties = { flex: 1, padding: '0.75rem', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '0.375rem', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' };

  const handleRatingSubmit = () => {
    console.log(`Driver rated: ${currentRating} stars`);
    onClose();
  };

  const mainContentVisible = displayLevel !== 'peek' || tripPhase === 'arrivedAtDestination';

  return (
    <div style={sheetStyle} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="trip-sheet-title">
      <div style={handleStyle} onClick={onToggleDisplayLevel} onTouchStart={onToggleDisplayLevel} role="button" aria-label={t.pullUpForDetails}></div>
      <div style={topContentStyle}>
        <h2 id="trip-sheet-title" style={sheetTitleStyle}>{sheetTitleText}</h2>

        {tripPhase !== 'arrivedAtDestination' ? (
            <>
                {tripStatusMessage && mainContentVisible && <p style={tripStatusMessageStyle}>{tripStatusMessage}</p>}
                <div style={driverInfoContainerStyle}>
                <img src={driverDetails.profilePicUrl || `https://ui-avatars.com/api/?name=${driverDetails.name.replace(' ', '+')}&background=random&size=128`} alt={driverDetails.name} style={driverImageStyle} />
                <div style={driverTextInfoStyle}>
                    <div style={driverNameStyle}>{driverDetails.name}</div>
                    { (displayLevel !== 'peek' || !tripStatusMessage) && <div style={carModelStyle}>{vehicleDescription}</div> }
                    { mainContentVisible && <div style={plateContainerStyle}><LicensePlateAFGIcon plateParts={driverDetails.plateParts} /></div> }
                </div>
                </div>
                {mainContentVisible && (
                    <>
                        <div style={actionButtonsContainerStyle}>
                        <button style={contactButtonStyle} onClick={onCallDriver}><PhoneIcon style={contactButtonIconStyle}/> {t.callDriverButton}</button>
                        <button style={contactButtonStyle} onClick={onMessageDriver}><MessageBubbleIcon style={contactButtonIconStyle}/> {t.messageDriverButton}</button>
                        </div>
                        <div style={etaAndFareContainer}>
                            <div>
                            <div style={fareInfoStyle}>
                                {t.fareLabel}{' '}
                                {tripFare !== null ? (
                                <span style={fareAmountStyle}>
                                    {Math.round(tripFare).toLocaleString(currentLang === 'fa' || currentLang === 'ps' ? 'fa-IR' : 'en-US')}{' '}
                                    {t.priceUnit}
                                </span>
                                ) : (
                                <span style={fareAmountStyle}>{t.fareNotAvailable}</span>
                                )}
                            </div>
                            <div style={insufficientBalanceStyle}>{t.insufficientBalance}</div>
                            </div>
                        {tripPhase === 'enRouteToDestination' && estimatedTimeToDestination !== null && estimatedTimeToDestination > 0 && (
                            <div style={etaContainerStyle}>
                            <ClockIcon style={etaIconStyle} />
                            {t.etaLabel} {estimatedTimeToDestination} {t.etaUnitMinutes}
                            </div>
                        )}
                        </div>
                        <div style={{display: 'flex', justifyContent:'center', paddingBottom: '0.5rem'}}>
                            <button style={{...payButtonStyle, display: tripPhase !== 'enRouteToDestination' ? 'block' : 'none' }} onClick={onPayment}>{t.payButton}</button>
                        </div>
                    </>
                )}
            </>
        ) : (
            <div style={{padding: '1rem 0', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
                <p style={ratingPromptStyle}>{t.rateDriverPrompt}</p>
                <StarRating
                    currentLang={currentLang}
                    count={5}
                    rating={currentRating}
                    onRatingChange={setCurrentRating}
                    hoverRating={hoverRating}
                    onHoverRatingChange={setHoverRating}
                />
                <div style={ratingButtonContainerStyle}>
                    <button style={ratingSkipButtonStyle} onClick={onClose}>{t.skipRatingButton}</button>
                    <button style={{...ratingSubmitButtonStyle, opacity: currentRating > 0 ? 1 : 0.6}} onClick={handleRatingSubmit} disabled={currentRating === 0}>{t.submitRatingButton}</button>
                </div>
            </div>
        )}
      </div>

      {tripPhase !== 'arrivedAtDestination' && (
        <div style={expandedContentStyle}>
          <div style={changeDestinationButtonStyle} onClick={onChangeDestination} role="button"> <EditLocationIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.changeDestinationButton}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={optionListItemStyle} onClick={onApplyCoupon} role="button"> <TagIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.coupon}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={optionListItemStyle} onClick={onRideOptions} role="button"> <RideOptionsIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.rideOptionsButton}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={optionListItemStyle} onClick={onSafety} role="button"> <SafetyShieldIcon style={optionListItemIconStyle} /> <span style={optionListItemTextStyle}>{t.safetyButton}</span> <RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
          <div style={cancelRideListItemStyle} onClick={onCancelTrip} role="button"> <CancelRideIcon style={cancelRideIconStyle} /> <span style={optionListItemTextStyle}>{t.cancelRideButton}</span> <RightArrowIcon style={{color: '#D32F2F', transform: isRTL ? 'scaleX(-1)' : 'none' }}/> </div>
        </div>
      )}
    </div>
  );
};
