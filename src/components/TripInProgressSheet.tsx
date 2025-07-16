import React, { useState, useEffect, useRef, CSSProperties, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { translations, Language } from '../translations';
import { AppService, DriverDetails, TripPhase, TripSheetDisplayLevel, ChatMessage } from '../types';
import { StarRating } from './StarRating';
import { ChatModal } from './ChatModal';
import { useAppContext } from '../contexts/AppContext';
import { PhoneIcon, MessageBubbleIcon, EditLocationIcon, TagIcon, RideOptionsIcon, SafetyShieldIcon, CancelRideIcon, RightArrowIcon, CarIcon, ClockIcon } from './icons';

interface TripInProgressSheetProps {
  currentLang: Language;
  driverDetails: DriverDetails;
  tripFare: number | null;
  tripPhase: TripPhase;
  estimatedTimeToDestination: number | null;
  displayLevel: TripSheetDisplayLevel;
  onSetDisplayLevel: (level: TripSheetDisplayLevel) => void;
  onChangeDestination: () => void;
  onApplyCoupon: () => void;
  onRideOptions: () => void;
  onCancelTrip: () => void;
  onSafety: () => void;
  onClose: () => void;
  appServices: AppService[];
  rideRequestId: string | null;
  showTripInProgressSheet: boolean;
}

const PEEK_HEIGHT = 120;
const DEFAULT_HEIGHT = 380;
const DRAG_THRESHOLD = 5;

export const TripInProgressSheet: React.FC<TripInProgressSheetProps> = ({
  currentLang, driverDetails, tripFare, tripPhase, estimatedTimeToDestination,
  displayLevel, onSetDisplayLevel,
  onChangeDestination, onApplyCoupon, onRideOptions, onCancelTrip, onSafety, onClose,
  appServices, rideRequestId, showTripInProgressSheet
}) => {
  const { loggedInUserId, showToast } = useAppContext();
  const t = translations[currentLang];
  const isRTL = currentLang !== 'en';
  
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const chatToastChannelRef = useRef<RealtimeChannel | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartInfo = useRef({ y: 0, sheetHeight: 0 });
  const isDragging = useRef(false);

  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const FULL_HEIGHT = Math.min(viewportHeight * 0.8, 800);

  const getSheetHeight = useCallback((level: TripSheetDisplayLevel) => {
    if (tripPhase === 'arrivedAtDestination') return 350;
    switch (level) {
      case 'peek': return PEEK_HEIGHT;
      case 'default': return DEFAULT_HEIGHT;
      case 'full': return FULL_HEIGHT;
      default: return DEFAULT_HEIGHT;
    }
  }, [tripPhase, FULL_HEIGHT]);

  const currentSheetHeight = getSheetHeight(displayLevel);

  useEffect(() => {
    if (showTripInProgressSheet && !isChatModalOpen && rideRequestId && loggedInUserId) {
        if (chatToastChannelRef.current) {
            supabase.removeChannel(chatToastChannelRef.current);
        }
        chatToastChannelRef.current = supabase
            .channel(`passenger_chat_toast_${rideRequestId}`)
            .on<ChatMessage>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `ride_request_id=eq.${rideRequestId}`},
                (payload) => {
                    const newMessage = payload.new as ChatMessage;
                    if (newMessage.receiver_id === loggedInUserId) {
                        showToast(t.newChatMessageToast.replace('{name}', driverDetails.name).replace('{message}', newMessage.message_text.substring(0, 30)), 'info');
                    }
                }
            ).subscribe();
    } else {
        if (chatToastChannelRef.current) {
            supabase.removeChannel(chatToastChannelRef.current);
            chatToastChannelRef.current = null;
        }
    }
    
    return () => {
         if (chatToastChannelRef.current) {
            supabase.removeChannel(chatToastChannelRef.current);
            chatToastChannelRef.current = null;
        }
    }
  }, [showTripInProgressSheet, isChatModalOpen, rideRequestId, loggedInUserId, driverDetails.name, showToast, t]);

  const snapToClosestPoint = useCallback(() => {
    if (!sheetRef.current) return;
    const currentHeight = sheetRef.current.offsetHeight;
    const snapPoints = [{ level: 'peek', height: PEEK_HEIGHT }, { level: 'default', height: DEFAULT_HEIGHT }, { level: 'full', height: FULL_HEIGHT }];
    const closestPoint = snapPoints.reduce((closest, point) => {
      const distance = Math.abs(currentHeight - point.height);
      if (distance < closest.distance) return { distance, level: point.level as TripSheetDisplayLevel };
      return closest;
    }, { distance: Infinity, level: 'default' as TripSheetDisplayLevel });
    onSetDisplayLevel(closestPoint.level);
  }, [onSetDisplayLevel, FULL_HEIGHT]);

  const handleTap = useCallback(() => {
    if (tripPhase === 'arrivedAtDestination') return;
    if (displayLevel === 'peek') onSetDisplayLevel('default');
    else if (displayLevel === 'default') onSetDisplayLevel('full');
    else onSetDisplayLevel('default');
  }, [displayLevel, onSetDisplayLevel, tripPhase]);

  const handleDragEnd = useCallback((endY: number) => {
    if (!isDragging.current) return;
    const dragDistance = Math.abs(endY - dragStartInfo.current.y);
    isDragging.current = false;
    if (sheetRef.current) sheetRef.current.style.transition = 'height 0.3s ease-out';
    if (dragDistance < DRAG_THRESHOLD) {
      if(sheetRef.current) sheetRef.current.style.height = `${dragStartInfo.current.sheetHeight}px`;
      handleTap();
    } else {
      snapToClosestPoint();
    }
  }, [handleTap, snapToClosestPoint]);
  
  const handleDragMove = useCallback((clientY: number) => {
    if (!isDragging.current || !sheetRef.current) return;
    const deltaY = clientY - dragStartInfo.current.y;
    const newHeight = dragStartInfo.current.sheetHeight - deltaY;
    const clampedHeight = Math.max(PEEK_HEIGHT, Math.min(newHeight, viewportHeight));
    sheetRef.current.style.height = `${clampedHeight}px`;
  }, [viewportHeight]);

  const handleDragStart = useCallback((startY: number) => {
    if (tripPhase === 'arrivedAtDestination' || !sheetRef.current) return;
    isDragging.current = true;
    dragStartInfo.current = { y: startY, sheetHeight: sheetRef.current.offsetHeight };
    sheetRef.current.style.transition = 'none';
  }, [tripPhase]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleDragStart(e.clientY);
    const onMouseMove = (moveEvent: MouseEvent) => handleDragMove(moveEvent.clientY);
    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleDragEnd(upEvent.clientY);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    handleDragStart(e.targetTouches[0].clientY);
    const onTouchMove = (moveEvent: TouchEvent) => handleDragMove(moveEvent.targetTouches[0].clientY);
    const onTouchEnd = (endEvent: TouchEvent) => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      handleDragEnd(endEvent.changedTouches[0].clientY);
    };
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
  };
  
  const [currentRating, setCurrentRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  useEffect(() => { if (tripPhase === 'arrivedAtDestination') setCurrentRating(0); }, [tripPhase]);
  const handleRatingSubmit = () => { onClose(); };

  const sheetStyle: CSSProperties = { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', paddingBottom: 'env(safe-area-inset-bottom)', display: 'flex', flexDirection: 'column', zIndex: 1250, direction: isRTL ? 'rtl' : 'ltr', height: currentSheetHeight, transition: 'height 0.3s ease-out', touchAction: 'none' };
  const handleContainerStyle: CSSProperties = { padding: '0.5rem', cursor: tripPhase === 'arrivedAtDestination' ? 'default' : 'grab', flexShrink: 0, WebkitTapHighlightColor: 'transparent', textAlign: 'center' };
  const handleStyle: CSSProperties = { width: '40px', height: '4px', backgroundColor: '#ccc', borderRadius: '2px', margin: '0 auto', marginBottom: '0.5rem' };
  const contentContainerStyle: CSSProperties = { flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' };

  const infoContentContainerStyle: CSSProperties = { height: '100%', overflowY: 'auto', opacity: displayLevel === 'peek' && tripPhase !== 'arrivedAtDestination' ? 0 : 1, visibility: displayLevel === 'peek' && tripPhase !== 'arrivedAtDestination' ? 'hidden' : 'visible', transition: 'opacity 0.2s, visibility 0.2s', };
  const statusMessageStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '0.75rem' };
  const defaultViewContainerStyle: CSSProperties = { padding: '0 1.5rem 1rem', display: 'flex', flexDirection: 'column' };
  const driverAndPlateContainer: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' };
  const driverInfoContainer: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', flexDirection: isRTL ? 'row-reverse' : 'row' };
  const driverImageStyle: CSSProperties = { width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e0e0e0' };
  const driverNameStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600, color: '#333' };
  const vehicleInfoStyle: CSSProperties = { fontSize: '0.9rem', color: '#666', marginTop: '0.1rem' };
  
  const taxiNumberPlateStyle: CSSProperties = { border: '2px solid #4A5568', borderRadius: '0.375rem', padding: '0.25rem 0.75rem', backgroundColor: 'white', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' };
  const taxiNumberLabelStyle: CSSProperties = { fontSize: '0.65rem', color: '#4A5568', fontWeight: 'normal' };
  const taxiNumberValueStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 'bold', color: '#1F2937' };
  const contactContainer: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' };
  const contactIconButtonStyle: CSSProperties = { backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.2s', color: '#007bff', textDecoration: 'none' };
  const phoneNumberStyle: CSSProperties = { fontSize: '1.2rem', fontWeight: 'bold', color: '#333', flexGrow: 1, textAlign: 'center', direction: 'ltr' };
  const fareContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' };
  const fareLabelStyle: CSSProperties = { fontSize: '1rem', color: '#4B5563' };
  const fareAmountStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 'bold', color: '#1F2937' };

  const fullViewOptionsListStyle: CSSProperties = { display: displayLevel === 'full' ? 'block' : 'none', padding: '0 1.5rem 1rem' };
  const optionListItemStyle: CSSProperties = { display: 'flex', alignItems: 'center', padding: '0.875rem 0.25rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '1rem', color: '#333' };
  const optionListItemIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '1rem', color: '#555' };
  const optionListItemTextStyle: CSSProperties = { flexGrow: 1 };
  const emergencyButtonItemStyle: CSSProperties = { ...optionListItemStyle, color: '#D32F2F', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '0.5rem', marginTop: '1rem', padding: '0.875rem' };
  const emergencyButtonIconStyle: CSSProperties = { ...optionListItemIconStyle, color: '#D32F2F' };
  const cancelRideListItemStyle: CSSProperties = { ...optionListItemStyle, color: '#D32F2F' };
  const cancelRideIconStyle: CSSProperties = { ...optionListItemIconStyle, color: '#D32F2F' };

  const ratingViewContainer: CSSProperties = { padding: '1rem 1.25rem', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' };
  const ratingPromptStyle: CSSProperties = { textAlign: 'center', fontSize: '1.1rem', color: '#333', marginBottom: '0.5rem' };
  const ratingButtonContainerStyle: CSSProperties = { display: 'flex', gap: '1rem', marginTop: '1.5rem', width: '100%' };
  const ratingSubmitButtonStyle: CSSProperties = { flex: 1, padding: '0.875rem', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', opacity: currentRating > 0 ? 1 : 0.6, transition: 'opacity 0.2s' };
  const ratingSkipButtonStyle: CSSProperties = { flex: 1, padding: '0.875rem', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' };

  const getStatusMessage = () => {
    switch (tripPhase) {
      case 'enRouteToOrigin': return t.driverOnTheWay;
      case 'atPickup': return t.driverArrivedAtPickup;
      case 'enRouteToDestination': return t.tripHasStarted;
      default: return '';
    }
  };

  return (
    <>
      <div style={sheetStyle} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="trip-sheet-title">
        <div style={handleContainerStyle} onMouseDown={onMouseDown} onTouchStart={onTouchStart} role="button" aria-label={t.pullUpForDetails}>
          <div style={handleStyle}></div>
          {tripPhase !== 'arrivedAtDestination' && ( <div id="trip-sheet-title" style={statusMessageStyle}>{getStatusMessage()}</div> )}
        </div>
        <div style={contentContainerStyle}>
          {tripPhase === 'arrivedAtDestination' ? (
              <div style={ratingViewContainer}>
                  <h2 id="trip-sheet-title" style={ratingPromptStyle}>{t.tripEndedSuccessfullyTitle}</h2>
                  {tripFare !== null && (
                    <div style={{ ...fareContainerStyle, width: '100%', maxWidth: '300px', marginBottom: '1rem', paddingBottom: '1rem' }}>
                        <span style={fareLabelStyle}>{t.fareLabel}</span>
                        <span style={fareAmountStyle}>{`${Math.round(tripFare).toLocaleString(isRTL ? 'fa-IR' : 'en-US')} ${t.priceUnit}`}</span>
                    </div>
                  )}
                  <StarRating currentLang={currentLang} count={5} rating={currentRating} onRatingChange={setCurrentRating} hoverRating={hoverRating} onHoverRatingChange={setHoverRating} size="2.5rem" />
                  <div style={ratingButtonContainerStyle}>
                      <button style={ratingSkipButtonStyle} onClick={onClose}>{t.skipRatingButton}</button>
                      <button style={ratingSubmitButtonStyle} onClick={handleRatingSubmit} disabled={currentRating === 0}>{t.submitRatingButton}</button>
                  </div>
              </div>
          ) : (
              <div style={infoContentContainerStyle}>
                  <div style={defaultViewContainerStyle}>
                      <div style={driverAndPlateContainer}>
                          <div style={driverInfoContainer}>
                              <img src={driverDetails.profilePicUrl || `https://ui-avatars.com/api/?name=${driverDetails.name.replace(' ', '+')}&background=random&size=128`} alt={driverDetails.name} style={driverImageStyle} />
                              <div>
                                  <h3 style={driverNameStyle}>{driverDetails.name}</h3>
                                  <div style={vehicleInfoStyle}>{driverDetails.vehicleModel} {driverDetails.vehicleColor}</div>
                              </div>
                          </div>
                          <div style={taxiNumberPlateStyle}>
                              <div style={taxiNumberLabelStyle}>{t.taxiNumberLabel}</div>
                              <div style={taxiNumberValueStyle}>{driverDetails.plateParts.numbers}</div>
                          </div>
                      </div>
                      <div style={contactContainer}>
                          <a href={`tel:${driverDetails.phoneNumber}`} style={contactIconButtonStyle} aria-label={t.callDriverButton}><PhoneIcon style={{ width: '1.25rem', height: '1.25rem' }} /></a>
                          <span style={phoneNumberStyle}>{driverDetails.phoneNumber}</span>
                          <button style={contactIconButtonStyle} aria-label={t.messageDriverButton} onClick={() => setIsChatModalOpen(true)}>
                            <MessageBubbleIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                          </button>
                      </div>
                      <div style={fareContainerStyle}>
                          <span style={fareLabelStyle}>{t.fareLabel}</span>
                          <span style={fareAmountStyle}>{tripFare !== null ? `${Math.round(tripFare).toLocaleString(isRTL ? 'fa-IR' : 'en-US')} ${t.priceUnit}` : t.fareNotAvailable}</span>
                      </div>
                  </div>
                  
                  <div style={fullViewOptionsListStyle}>
                      <div style={optionListItemStyle} onClick={onChangeDestination} role="button"><EditLocationIcon style={optionListItemIconStyle} /><span style={optionListItemTextStyle}>{t.changeDestinationButton}</span><RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/></div>
                      <div style={optionListItemStyle} onClick={onApplyCoupon} role="button"><TagIcon style={optionListItemIconStyle} /><span style={optionListItemTextStyle}>{t.coupon}</span><RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/></div>
                      <div style={optionListItemStyle} onClick={onRideOptions} role="button"><RideOptionsIcon style={optionListItemIconStyle} /><span style={optionListItemTextStyle}>{t.rideOptionsButton}</span><RightArrowIcon style={{color: '#ccc', transform: isRTL ? 'scaleX(-1)' : 'none' }}/></div>
                      
                      {tripPhase === 'enRouteToDestination' ? (
                          <div style={emergencyButtonItemStyle} onClick={onSafety} role="button"><SafetyShieldIcon style={emergencyButtonIconStyle} /><span style={optionListItemTextStyle}>{t.emergencyButton}</span><RightArrowIcon style={{color: '#D32F2F', transform: isRTL ? 'scaleX(-1)' : 'none' }}/></div>
                      ) : (
                          <div style={cancelRideListItemStyle} onClick={onCancelTrip} role="button"><CancelRideIcon style={cancelRideIconStyle} /><span style={optionListItemTextStyle}>{t.cancelRideButton}</span><RightArrowIcon style={{color: '#D32F2F', transform: isRTL ? 'scaleX(-1)' : 'none' }}/></div>
                      )}
                  </div>
              </div>
          )}
        </div>
      </div>
      {isChatModalOpen && rideRequestId && loggedInUserId && (
        <ChatModal 
            isOpen={isChatModalOpen}
            onClose={() => setIsChatModalOpen(false)}
            rideRequestId={rideRequestId}
            otherPartyName={driverDetails.name}
            otherPartyId={driverDetails.driverId}
        />
      )}
    </>
  );
};
