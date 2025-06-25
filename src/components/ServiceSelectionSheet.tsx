
import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { translations, Language } from '../translations';
import { AppService, AppServiceCategory } from '../types';
import { FilterIcon, TagIcon, ScheduledRideIcon } from './icons';

interface ServiceSelectionSheetProps {
    currentLang: Language;
    originAddress: string;
    destinationAddress: string;
    routeDistanceKm: number | null;
    isCalculatingDistance: boolean;
    distanceError: string | null;
    onClose: () => void;
    onRequestRide: (service: AppService, origin: string, destination: string, estimatedPrice: number | null) => void;
    serviceCategories: AppServiceCategory[];
    isLoadingServices: boolean;
    serviceFetchError: string | null;
}
export const ServiceSelectionSheet: React.FC<ServiceSelectionSheetProps> = ({
    currentLang, originAddress, destinationAddress, routeDistanceKm,
    isCalculatingDistance, distanceError, onClose, onRequestRide,
    serviceCategories, isLoadingServices, serviceFetchError
}) => {
  const t = translations[currentLang]; const isRTL = currentLang !== 'en';

  const [activeCategoryId, setActiveCategoryId] = useState<string>(serviceCategories[0]?.id || '');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (serviceCategories.length > 0 && (!activeCategoryId || !serviceCategories.find(cat => cat.id === activeCategoryId)) ) {
        setActiveCategoryId(serviceCategories[0].id);
    }
  }, [serviceCategories, activeCategoryId]);

  useEffect(() => {
    if (activeCategoryId) {
        const currentCategory = serviceCategories.find(cat => cat.id === activeCategoryId);
        if (currentCategory && currentCategory.services.length > 0) {
            const currentSelectedService = currentCategory.services.find(s => s.id === selectedServiceId);
            if (!currentSelectedService) { // If selected service is not in new active category, select first
                 setSelectedServiceId(currentCategory.services[0].id);
            }
        } else {
             setSelectedServiceId(null); // No services in category or category itself gone
        }
    }
  }, [activeCategoryId, serviceCategories, selectedServiceId]);


  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; } }, []);

  const handleRequestClick = () => {
    const activeCategory = serviceCategories.find(cat => cat.id === activeCategoryId);
    const service = activeCategory?.services.find(s => s.id === selectedServiceId);
    if (service) {
      let estimatedPrice: number | null = null;
      if (service.pricePerKm && routeDistanceKm !== null) {
        estimatedPrice = Math.round(service.pricePerKm * routeDistanceKm);
      } else if (service.price) {
        estimatedPrice = Math.round(service.price);
      }
      onRequestRide(service, originAddress, destinationAddress, estimatedPrice);
    } else {
      alert(t.selectServicePrompt);
    }
  };

  const activeCategoryServices = serviceCategories.find(cat => cat.id === activeCategoryId)?.services || [];
  const sheetStyle: CSSProperties = { position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', padding: '1rem', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))', maxHeight: '70vh', display: 'flex', flexDirection: 'column', transform: 'translateY(100%)', transition: 'transform 0.3s ease-out', zIndex: 1100, direction: isRTL ? 'rtl' : 'ltr', };
  const tabsContainerStyle: CSSProperties = { display: 'flex', borderBottom: '1px solid #e0e0e0', marginBottom: '1rem', flexShrink: 0, };
  const tabStyle = (isActive: boolean): CSSProperties => ({ padding: '0.75rem 1rem', cursor: 'pointer', color: isActive ? '#10B981' : '#555', fontWeight: isActive ? 'bold' : 'normal', borderBottom: isActive ? '3px solid #10B981' : '3px solid transparent', transition: 'color 0.2s, border-bottom 0.2s', fontSize: '0.9rem', textAlign: 'center', flexGrow: 1, });
  const serviceListStyle: CSSProperties = { overflowY: 'auto', flexGrow: 1, paddingRight: isRTL ? 0 : '0.5rem', paddingLeft: isRTL ? '0.5rem' : 0, };
  const serviceItemStyle = (isSelected: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '0.5rem', backgroundColor: isSelected ? '#e6f7f0' : 'transparent', border: isSelected ? '1px solid #10B981' : '1px solid #eee', cursor: 'pointer', transition: 'background-color 0.2s, border-color 0.2s', });
  const serviceItemImageStyle: CSSProperties = { width: '3.5rem', height: '3.5rem', [isRTL ? 'marginLeft' : 'marginRight']: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const serviceItemDetailsStyle: CSSProperties = { flexGrow: 1 }; const serviceItemNameStyle: CSSProperties = { fontWeight: 'bold', fontSize: '1rem', color: '#333' }; const serviceItemDescStyle: CSSProperties = { fontSize: '0.8rem', color: '#777' }; const serviceItemPriceStyle: CSSProperties = { fontSize: '1rem', fontWeight: 'bold', color: '#10B981', whiteSpace: 'nowrap' }; const priceLoadingErrorStyle: CSSProperties = { fontSize: '0.85rem', color: '#777', whiteSpace: 'nowrap', textAlign: isRTL ? 'left' : 'right' };
  const optionsContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '1px solid #e0e0e0', marginTop: 'auto', flexShrink: 0, };
  const optionItemStyle: CSSProperties = { display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: '#555', cursor: 'pointer', opacity: 0.7, }; const optionIconStyle: CSSProperties = { [isRTL ? 'marginLeft' : 'marginRight']: '0.5rem', color: '#10B981' };
  const footerStyle: CSSProperties = { display: 'flex', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #e0e0e0', flexShrink: 0, };
  const requestButtonStyle: CSSProperties = { flexGrow: 1, backgroundColor: '#10B981', color: 'white', padding: '0.875rem 1rem', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', textAlign: 'center', opacity: selectedServiceId ? 1 : 0.6, }; const requestButtonDisabledStyle: CSSProperties = { backgroundColor: '#9CA3AF', cursor: 'not-allowed' };
  const scheduleButtonStyle: CSSProperties = { background: 'none', border: '1px solid #ccc', borderRadius: '0.5rem', padding: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', [isRTL ? 'marginRight' : 'marginLeft']: '0.75rem', opacity: 0.7, };

  if (isLoadingServices) {
    return <div style={sheetStyle} ref={sheetRef}><p style={{textAlign: 'center', padding: '2rem'}}>{t.servicesLoading}</p></div>;
  }
  if (serviceFetchError) {
    return <div style={sheetStyle} ref={sheetRef}><p style={{textAlign: 'center', padding: '2rem', color: 'red'}}>{serviceFetchError}</p></div>;
  }
  if (serviceCategories.length === 0) {
    return <div style={sheetStyle} ref={sheetRef}><p style={{textAlign: 'center', padding: '2rem'}}>{t.noServicesAvailable.replace(' این دسته', '')}</p></div>;
  }

  return ( <div style={sheetStyle} ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="service-sheet-title"> <div style={tabsContainerStyle}> {serviceCategories.map(category => ( <button key={category.id} style={tabStyle(category.id === activeCategoryId)} onClick={() => { setActiveCategoryId(category.id); }} role="tab" aria-selected={category.id === activeCategoryId} > {t[category.nameKey] || category.id} </button> ))} </div> <div style={serviceListStyle}> {activeCategoryServices.length > 0 ? activeCategoryServices.map(service => { const ServiceImage = service.imageComponent; let priceDisplay: React.ReactNode; if (isCalculatingDistance) { priceDisplay = <div style={priceLoadingErrorStyle}>{t.calculatingPrice}</div>; } else if (distanceError) { priceDisplay = <div style={{...priceLoadingErrorStyle, color: 'red'}}>{distanceError}</div>; } else if (service.pricePerKm && routeDistanceKm !== null) { const estimatedPrice = Math.round(service.pricePerKm * routeDistanceKm);
            priceDisplay = <div style={serviceItemPriceStyle}>{`${estimatedPrice.toLocaleString(currentLang === 'fa' || currentLang === 'ps' ? 'fa-IR' : 'en-US')} ${t.priceUnit}`}</div>; } else if (service.price) { const fixedPrice = Math.round(service.price);
            priceDisplay = <div style={serviceItemPriceStyle}>{`${fixedPrice.toLocaleString(currentLang === 'fa' || currentLang === 'ps' ? 'fa-IR' : 'en-US')} ${t.priceUnit}`}</div>; } else { priceDisplay = <div style={priceLoadingErrorStyle}>-</div>; } return ( <div key={service.id} style={serviceItemStyle(service.id === selectedServiceId)} onClick={() => setSelectedServiceId(service.id)} role="radio" aria-checked={service.id === selectedServiceId} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedServiceId(service.id); }} > <div style={serviceItemImageStyle}><ServiceImage style={{width: '90%', height: '90%'}} /></div> <div style={serviceItemDetailsStyle}> <div style={serviceItemNameStyle}>{t[service.nameKey] || t.defaultServiceName}</div> <div style={serviceItemDescStyle}>{t[service.descKey] || t.defaultServiceDesc}</div> </div> {priceDisplay} </div> ) }) : <p style={{textAlign: 'center', color: '#777', padding: '1rem'}}>{t.noServicesAvailable}</p>} </div> <div style={optionsContainerStyle}> <div style={optionItemStyle} role="button" tabIndex={0} aria-disabled="true"> <FilterIcon style={optionIconStyle} /> {t.rideOptions} </div> <div style={optionItemStyle} role="button" tabIndex={0} aria-disabled="true"> <TagIcon style={optionIconStyle} /> {t.coupon} </div> </div> <div style={footerStyle}> <button style={{...requestButtonStyle, ...( !selectedServiceId || isCalculatingDistance || distanceError ? requestButtonDisabledStyle : {})}} onClick={handleRequestClick} disabled={!selectedServiceId || isCalculatingDistance || !!distanceError} > {t.requestRideButtonText} </button> <button style={scheduleButtonStyle} aria-label={t.scheduledRideButtonAriaLabel} disabled={true}> <ScheduledRideIcon style={{ color: '#555'}}/> </button> </div> </div> );
};
