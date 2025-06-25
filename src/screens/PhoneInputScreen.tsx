
import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { translations, Language } from '../translations';
import { UserRole } from '../types';
import { RightArrowIcon } from '../components/icons';

interface PhoneInputScreenProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
  onNext: (phoneNumber: string, role: UserRole) => void;
}

export const PhoneInputScreen: React.FC<PhoneInputScreenProps> = ({ currentLang, onLangChange, onNext }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('passenger');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const t = translations[currentLang];
  const isRTL = currentLang !== 'en';

  const handleNextClick = () => {
    setError('');
    if (!/^07[0-9]{8}$/.test(phoneNumber)) {
      setError(t.invalidPhoneError);
      return;
    }
    if (!termsAccepted) {
      setError(t.acceptTermsError);
      return;
    }
    onNext(phoneNumber, selectedRole);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectLang = (lang: Language) => {
    onLangChange(lang);
    setIsLangDropdownOpen(false);
  }
  const selectRole = (role: UserRole) => {
    setSelectedRole(role);
    setIsRoleDropdownOpen(false);
  }

  const isNextDisabled = !termsAccepted || !(/^07[0-9]{8}$/.test(phoneNumber)) || !!error;

  const containerStyle: CSSProperties = { backgroundColor: 'white', padding: '2rem 2.5rem', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', width: '100%', maxWidth: '32rem', margin: '2rem auto', position: 'relative', boxSizing: 'border-box', paddingBottom: '7rem', paddingTop: '4rem' };
  const dropdownContainerBaseStyle: CSSProperties = { position: 'absolute', top: '1rem', zIndex: 10 };
  const langDropdownContainerStyle: CSSProperties = { ...dropdownContainerBaseStyle, [isRTL ? 'left' : 'right']: '1rem', };
  const roleDropdownContainerStyle: CSSProperties = { ...dropdownContainerBaseStyle, [isRTL ? 'right' : 'left']: '1rem', };
  const dropdownButtonStyle: CSSProperties = { background: 'transparent', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem', fontWeight: 500, display: 'flex', alignItems: 'center' };
  const dropdownButtonHoverStyle: CSSProperties = { color: '#0056b3' };
  const dropdownMenuStyle: CSSProperties = { position: 'absolute', marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '0.375rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', border: '1px solid #E5E7EB', zIndex: 20, minWidth: '120px' };
  const langMenuStyleSpecific: CSSProperties = {...dropdownMenuStyle, [isRTL ? 'left' : 'right']: 0};
  const roleMenuStyleSpecific: CSSProperties = {...dropdownMenuStyle, [isRTL ? 'right' : 'left']: 0};
  const dropdownMenuItemStyle: CSSProperties = { padding: '0.625rem 1rem', cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap' };
  const dropdownMenuItemHoverStyle: CSSProperties = { backgroundColor: '#F3F4F6' };
  const titleStyle: CSSProperties = { fontSize: '1.875rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '0.5rem', textAlign: 'center' };
  const subtitleStyle: CSSProperties = { fontSize: '1rem', color: '#4B5563', marginBottom: '2rem', lineHeight: 1.6, textAlign: 'center' };
  const inputContainerStyle: CSSProperties = { position: 'relative', marginBottom: '0.5rem' };
  const inputBaseStyle: CSSProperties = { width: '100%', padding: '1.5rem 1rem 0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', fontSize: '1.125rem', outline: 'none', backgroundColor: 'transparent', transition: 'border-color 0.2s, box-shadow 0.2s', textAlign: isRTL ? 'right' : 'left', appearance: 'none' };
  const inputFocusStyle: CSSProperties = { borderColor: '#10B981', boxShadow: '0 0 0 1px #10B981' };
  const inputErrorStyle: CSSProperties = { borderColor: '#EF4444', boxShadow: '0 0 0 1px #EF4444' };
  const currentInputStyle = { ...inputBaseStyle, ...(isFocused ? inputFocusStyle : {}), ...(error && error === t.invalidPhoneError ? inputErrorStyle : {}) };
  const labelBaseStyle: CSSProperties = { position: 'absolute', [isRTL ? 'right' : 'left']: '1rem', padding: '0 0.25rem', transition: 'all 0.2s ease-out', pointerEvents: 'none', backgroundColor: 'white', color: '#6B7280' };
  const labelFloatingStyle: CSSProperties = { top: '-0.625rem', fontSize: '0.75rem' };
  const labelInitialStyle: CSSProperties = { top: '1rem', fontSize: '1rem' };
  const currentLabelStyle = { ...labelBaseStyle, ...((isFocused || phoneNumber) ? labelFloatingStyle : labelInitialStyle), color: isFocused ? '#059669' : (error && error === t.invalidPhoneError ? '#DC2626' : '#6B7280') };
  const errorMessageStyle: CSSProperties = { color: '#DC2626', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1rem', textAlign: isRTL ? 'right' : 'left', minHeight: '1.5em' };
  const termsContainerStyle: CSSProperties = { display: 'flex', alignItems: 'center', marginBottom: '0.5rem', textAlign: isRTL ? 'right' : 'left' };
  const checkboxStyle: CSSProperties = { height: '1.25rem', width: '1.25rem', cursor: 'pointer', accentColor: '#10B981', [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.25rem' };
  const termsLabelStyle: CSSProperties = { fontSize: '0.875rem', color: '#374151', cursor: 'pointer', flex: 1 };
  const nextButtonBaseStyle: CSSProperties = { position: 'absolute', bottom: '1.5rem', [isRTL ? 'right' : 'left']: '1.5rem', backgroundColor: '#10B981', color: 'white', width: '3.5rem', height: '3.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', transition: 'all 0.3s ease-in-out', zIndex: 10, border: 'none' };
  const nextButtonHoverStyle: CSSProperties = { backgroundColor: '#059669' };
  const nextButtonActiveStyle: CSSProperties = { transform: 'scale(0.95)' };
  const nextButtonDisabledStyle: CSSProperties = { opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#9CA3AF' };
  const [isNextButtonHovered, setIsNextButtonHovered] = useState(false);
  let currentNextButtonStyle = {...nextButtonBaseStyle};
  if (isNextDisabled) currentNextButtonStyle = {...currentNextButtonStyle, ...nextButtonDisabledStyle};
  else if (isNextButtonHovered) currentNextButtonStyle = {...currentNextButtonStyle, ...nextButtonHoverStyle};
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const value = e.target.value.replace(/[^0-9]/g, ''); setPhoneNumber(value); if (error === t.invalidPhoneError || error) { setError(''); } };
  const handleTermsChange = (e: React.ChangeEvent<HTMLInputElement>) => { setTermsAccepted(e.target.checked); if(error === t.acceptTermsError) { setError(''); } };

  return (
    <div style={containerStyle}>
      <div style={langDropdownContainerStyle} ref={langDropdownRef}>
        <button style={dropdownButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.color = dropdownButtonHoverStyle.color!)} onMouseLeave={(e) => (e.currentTarget.style.color = dropdownButtonStyle.color!)} onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)} aria-haspopup="true" aria-expanded={isLangDropdownOpen} aria-label="Select language">
          {translations[currentLang].languageName} <span style={{ display: 'inline-block', transform: isLangDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', [isRTL ? 'marginRight' : 'marginLeft']: '0.35rem' }}>▼</span>
        </button>
        {isLangDropdownOpen && <div style={langMenuStyleSpecific}>{(Object.keys(translations) as Language[]).map((langKey) => (<div key={langKey} style={{...dropdownMenuItemStyle, textAlign: isRTL ? 'right' : 'left'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = dropdownMenuItemHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = dropdownMenuItemStyle.backgroundColor!} onClick={() => selectLang(langKey)}>{translations[langKey].languageName}</div>))}</div>}
      </div>

      <div style={roleDropdownContainerStyle} ref={roleDropdownRef}>
        <button style={dropdownButtonStyle} onMouseEnter={(e) => (e.currentTarget.style.color = dropdownButtonHoverStyle.color!)} onMouseLeave={(e) => (e.currentTarget.style.color = dropdownButtonStyle.color!)} onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)} aria-haspopup="true" aria-expanded={isRoleDropdownOpen} aria-label={t.selectRole}>
          {selectedRole === 'passenger' ? t.rolePassenger : t.roleDriver} <span style={{ display: 'inline-block', transform: isRoleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', [isRTL ? 'marginRight' : 'marginLeft']: '0.35rem' }}>▼</span>
        </button>
        {isRoleDropdownOpen && (
          <div style={roleMenuStyleSpecific}>
            {(['passenger', 'driver'] as UserRole[]).map((roleKey) => (
              <div
                key={roleKey}
                style={{...dropdownMenuItemStyle, textAlign: isRTL ? 'right' : 'left'}}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = dropdownMenuItemHoverStyle.backgroundColor!}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = dropdownMenuItemStyle.backgroundColor!}
                onClick={() => selectRole(roleKey)}>
                {roleKey === 'passenger' ? t.rolePassenger : t.roleDriver}
              </div>
            ))}
          </div>
        )}
      </div>

      <h1 style={titleStyle}>{t.welcomeTitle}</h1><p style={subtitleStyle}>{t.welcomeSubtitle}</p>
      <div style={inputContainerStyle}><input id="phone-input" type="tel" style={currentInputStyle} value={phoneNumber} onChange={handlePhoneInputChange} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} maxLength={10} aria-labelledby="phone-label" aria-invalid={!!(error && error === t.invalidPhoneError)} aria-describedby="phone-error-message" dir="ltr" /><label htmlFor="phone-input" id="phone-label" style={currentLabelStyle}>{t.mobileNumberLabel}</label></div>
      {error && error === t.invalidPhoneError && <p id="phone-error-message" style={errorMessageStyle} aria-live="assertive">{error}</p>} {!error && <div style={{...errorMessageStyle, visibility: 'hidden'}}>Placeholder</div>}
      <div style={termsContainerStyle}><input type="checkbox" id="terms-checkbox" style={checkboxStyle} checked={termsAccepted} onChange={handleTermsChange} aria-labelledby="terms-label" aria-describedby="terms-error-message" /><label htmlFor="terms-checkbox" id="terms-label" style={termsLabelStyle} dangerouslySetInnerHTML={{ __html: t.termsAcceptance }} /></div>
      {error && error === t.acceptTermsError && <p id="terms-error-message" style={{...errorMessageStyle, marginTop: '0', marginBottom: '1.5rem'}} aria-live="assertive">{error}</p>} {(!error || error !== t.acceptTermsError) && <div style={{...errorMessageStyle, visibility: 'hidden', marginTop: '0', marginBottom: '1.5rem'}}>Placeholder</div>}
      <button style={currentNextButtonStyle} onClick={handleNextClick} disabled={isNextDisabled} aria-label={t.nextButtonAriaLabel} onMouseEnter={() => setIsNextButtonHovered(true)} onMouseLeave={() => setIsNextButtonHovered(false)} onMouseDown={(e) => { if(!isNextDisabled) e.currentTarget.style.transform = nextButtonActiveStyle.transform!; }} onMouseUp={(e) => { if(!isNextDisabled) e.currentTarget.style.transform = 'scale(1)'; }}><RightArrowIcon style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }}/></button>
    </div>
  );
};
