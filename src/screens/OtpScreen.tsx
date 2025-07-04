import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { translations, Language } from '../translations';

interface PinScreenProps {
  currentLang: Language;
  phoneNumber: string;
  mode: 'create' | 'enter';
  onConfirm: (password: string) => void;
  onBack: () => void;
}

export const PinScreen: React.FC<PinScreenProps> = ({ currentLang, phoneNumber, mode, onConfirm, onBack }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = translations[currentLang];
  const isRTL = currentLang !== 'en';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (password.length >= 6) {
      setError('');
      onConfirm(password);
    } else {
      setError(t.invalidPinError);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (error) setError('');
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const containerStyle: CSSProperties = { backgroundColor: 'white', padding: '2rem 2.5rem', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', width: '100%', maxWidth: '32rem', margin: '2rem auto', position: 'relative', boxSizing: 'border-box', textAlign: 'center' };
  const titleStyle: CSSProperties = { fontSize: '1.875rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '0.5rem' };
  const subtitleStyle: CSSProperties = { fontSize: '1rem', color: '#4B5563', marginBottom: '0.75rem', lineHeight: 1.6 };
  const changeNumberContainerStyle: CSSProperties = { marginBottom: '1.5rem' };
  const changeNumberButtonStyle: CSSProperties = { color: '#059669', fontSize: '0.875rem', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', padding: '0.25rem' };
  const changeNumberButtonHoverStyle: CSSProperties = { textDecoration: 'underline' };
  
  const passwordInputBaseStyle: CSSProperties = { width: '100%', padding: '1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', fontSize: '1.125rem', outline: 'none', backgroundColor: 'white', transition: 'border-color 0.2s, box-shadow 0.2s', textAlign: 'left', direction: 'ltr', boxSizing: 'border-box', marginBottom: '0.5rem' };
  const passwordInputFocusStyle: CSSProperties = { borderColor: '#10B981', boxShadow: '0 0 0 1px #10B981' };
  const passwordInputErrorStyle: CSSProperties = { borderColor: '#EF4444', boxShadow: '0 0 0 1px #EF4444' };
  const currentInputStyle = { ...passwordInputBaseStyle, ...(isFocused ? passwordInputFocusStyle : {}), ...(error ? passwordInputErrorStyle : {}) };
  
  const errorMessageStyle: CSSProperties = { color: '#DC2626', fontSize: '0.875rem', marginBottom: '1rem', minHeight: '1.5em' };
  const confirmButtonStyle: CSSProperties = { width: '100%', background: 'linear-gradient(to right, #10B981, #059669)', color: 'white', padding: '0.875rem 1rem', borderRadius: '0.5rem', fontSize: '1.125rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.3s ease-in-out', marginTop: '1.25rem' };
  const confirmButtonHoverStyle: CSSProperties = { background: 'linear-gradient(to right, #059669, #047857)' };
  const [isConfirmHovered, setIsConfirmHovered] = useState(false);
  const [isChangeNumHovered, setIsChangeNumHovered] = useState(false);

  const screenTitle = mode === 'create' ? t.pinScreenCreateTitle : t.pinScreenEnterTitle;
  const screenSubtitle = mode === 'create' ? t.pinScreenCreateSubtitle : t.pinScreenEnterSubtitle.replace('{phoneNumber}', phoneNumber);
  
  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>{screenTitle}</h1>
      <p style={subtitleStyle}>{screenSubtitle}</p>
      <div style={changeNumberContainerStyle}><button onClick={onBack} style={isChangeNumHovered ? {...changeNumberButtonStyle, ...changeNumberButtonHoverStyle} : changeNumberButtonStyle} onMouseEnter={() => setIsChangeNumHovered(true)} onMouseLeave={() => setIsChangeNumHovered(false)}>({t.changeNumber})</button></div>
      
      <input
        ref={inputRef}
        type="password"
        id="password-input"
        style={currentInputStyle}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-label="Password input"
        aria-invalid={!!error}
        aria-describedby="password-error"
        autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
      />

      {error && <p id="password-error" style={errorMessageStyle} aria-live="assertive">{error}</p>}
      {!error && <div style={{...errorMessageStyle, visibility: 'hidden'}}>Placeholder</div>}
      
      <button id="confirm-pin-button" style={isConfirmHovered ? {...confirmButtonStyle, ...confirmButtonHoverStyle} : confirmButtonStyle} onMouseEnter={() => setIsConfirmHovered(true)} onMouseLeave={() => setIsConfirmHovered(false)} onClick={handleSubmit}>{t.confirmPinButton}</button>
    </div>
  );
};
