
import React, { useEffect, useRef, CSSProperties } from 'react';
import { translations, Language } from '../translations';
import { DriverSearchState } from '../types';
import { SearchingCarAnimationIcon, NoDriverFoundIcon, RetryIcon, CloseIcon } from './icons';

interface DriverSearchSheetProps {
    currentLang: Language;
    searchState: DriverSearchState;
    notifiedDriverCount: number;
    onRetry: () => void;
    onCancel: () => void;
    onClose: () => void;
    selectedServiceName: string;
}

export const DriverSearchSheet: React.FC<DriverSearchSheetProps> = ({ currentLang, searchState, notifiedDriverCount, onRetry, onCancel, onClose, selectedServiceName }) => {
  const t = translations[currentLang]; const isRTL = currentLang !== 'en'; const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; } }, []);

  const sheetStyle: CSSProperties = { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '1.5rem', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', minHeight: '250px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'translateY(100%)', transition: 'transform 0.3s ease-out', zIndex: 1200, direction: isRTL ? 'rtl' : 'ltr', textAlign: 'center', };
  const titleStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 'bold', color: '#333', marginBottom: '1rem', };
  const messageStyle: CSSProperties = { fontSize: '1rem', color: '#555', marginBottom: '1.5rem', lineHeight: 1.6, };
  const buttonContainerStyle: CSSProperties = { display: 'flex', gap: '1rem', width: '100%', maxWidth: '300px', marginTop: '1rem', };
  const actionButtonStyle: CSSProperties = { flexGrow: 1, padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', };
  const primaryButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#10B981', color: 'white' };
  const secondaryButtonStyle: CSSProperties = { ...actionButtonStyle, backgroundColor: '#e0e0e0', color: '#333' };
  const closeButtonStyle: CSSProperties = { position: 'absolute', top: '1rem', [isRTL ? 'left' : 'right']: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' };

  let content;
  switch (searchState) {
    case 'searching':
    case 'awaiting_driver_acceptance':
      content = ( <> <SearchingCarAnimationIcon /> <p style={messageStyle}>{t.searchingForDriver}</p> <button style={{...secondaryButtonStyle, marginTop: '1rem', width: '80%', maxWidth: '250px'}} onClick={onCancel}> {t.cancelButton} </button> </> ); break;
    case 'noDriverFound': content = ( <> <NoDriverFoundIcon /> <h2 style={titleStyle}>{t.noDriverFoundError}</h2> <div style={buttonContainerStyle}> <button style={secondaryButtonStyle} onClick={onCancel}>{t.cancelButton}</button> <button style={primaryButtonStyle} onClick={onRetry}><RetryIcon style={{verticalAlign: 'middle', [isRTL ? 'marginLeft' : 'marginRight']: '0.5rem'}} />{t.tryAgainButton}</button> </div> </> ); break;
    case 'driversNotified': content = ( <> <SearchingCarAnimationIcon /> <p style={messageStyle}> {t.driversNotifiedMessage.replace('{count}', String(notifiedDriverCount))} </p> <button style={{...secondaryButtonStyle, marginTop: '1rem', width: '80%', maxWidth: '250px'}} onClick={onCancel}> {t.cancelButton} </button> </> ); break;
    default: content = null;
  }
  return ( <div style={sheetStyle} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="driver-search-title"> <button style={closeButtonStyle} onClick={onClose} aria-label={t.closeDriverSearchSheetAriaLabel}> <CloseIcon style={{color: '#777'}}/> </button> {content} </div> );
};
