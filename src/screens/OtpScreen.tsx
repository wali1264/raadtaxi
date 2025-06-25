
import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { translations, Language } from '../translations';

interface OtpScreenProps {
  currentLang: Language;
  phoneNumber: string;
  onConfirm: (otp: string) => void;
  onResendOtp: () => void;
  onBack: () => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({ currentLang, phoneNumber, onConfirm, onResendOtp, onBack }) => {
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(new Array(6).fill(null));
  const t = translations[currentLang];
  const isRTL = currentLang !== 'en';

  useEffect(() => {
    inputRefs.current[0]?.focus();
    setFocusedInput(0);
  }, []);

  const handleChange = (element: HTMLInputElement, index: number) => {
    const value = element.value.replace(/[^0-9]/g, '');
    const newOtp = [...otp];
    if (value) {
      newOtp[index] = value.slice(-1);
      setOtp(newOtp);
      if (index < 5 && value) inputRefs.current[index + 1]?.focus();
    } else {
      newOtp[index] = '';
      setOtp(newOtp);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    setError('');
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newOtp = [...otp];
      if (newOtp[index]) {
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isRTL) {
        if (index < 5) inputRefs.current[index + 1]?.focus();
      } else {
        if (index > 0) inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (isRTL) {
        if (index > 0) inputRefs.current[index - 1]?.focus();
      } else {
        if (index < 5) inputRefs.current[index + 1]?.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (!/[0-9]/.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== 'Tab') {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
    if (pasteData.length > 0) {
      const newOtp = new Array(6).fill('');
      for (let i = 0; i < pasteData.length && i < 6; i++) {
        newOtp[i] = pasteData[i];
      }
      setOtp(newOtp);
      const lastFilledIndex = Math.min(pasteData.length, 6) -1;
      if (lastFilledIndex >=0 && lastFilledIndex < 5) {
        inputRefs.current[lastFilledIndex + 1]?.focus();
      } else if (lastFilledIndex === 5) {
        inputRefs.current[5]?.focus();
      } else if (pasteData.length > 0 && pasteData.length <=6) {
        inputRefs.current[pasteData.length]?.focus();
      } else {
        inputRefs.current[0]?.focus();
      }
    }
  };

  const handleSubmit = () => {
    const otpCode = otp.join('');
    if (otpCode.length === 6 && otp.every(digit => digit !== '')) {
      setError('');
      onConfirm(otpCode);
    } else {
      setError(t.invalidOtpError);
      const firstEmptyOrInvalid = otp.findIndex(digit => !/^[0-9]$/.test(digit));
      if (firstEmptyOrInvalid !== -1) {
        inputRefs.current[firstEmptyOrInvalid]?.focus();
      } else {
        inputRefs.current[0]?.focus();
      }
    }
  };

  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let interval: number | undefined;
    if (timer > 0 && !canResend) {
      interval = window.setInterval(() => {
        setTimer(prevTimer => prevTimer - 1);
      }, 1000);
    } else if (timer === 0 && !canResend) {
      setCanResend(true);
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [timer, canResend]);

  const handleResendClick = () => {
    onResendOtp();
    setOtp(new Array(6).fill(''));
    setError('');
    setTimer(60);
    setCanResend(false);
    inputRefs.current[0]?.focus();
  };
  
  const containerStyle: CSSProperties = { backgroundColor: 'white', padding: '2rem 2.5rem', borderRadius: '0.75rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', width: '100%', maxWidth: '32rem', margin: '2rem auto', position: 'relative', boxSizing: 'border-box', textAlign: 'center' };
  const titleStyle: CSSProperties = { fontSize: '1.875rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '0.5rem' };
  const subtitleStyle: CSSProperties = { fontSize: '1rem', color: '#4B5563', marginBottom: '0.75rem', lineHeight: 1.6 };
  const changeNumberContainerStyle: CSSProperties = { marginBottom: '1.5rem' };
  const changeNumberButtonStyle: CSSProperties = { color: '#059669', fontSize: '0.875rem', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', padding: '0.25rem' };
  const changeNumberButtonHoverStyle: CSSProperties = { textDecoration: 'underline' };
  const otpInputsContainerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', direction: 'ltr' };
  const otpInputBaseStyle: CSSProperties = { width: '3.25rem', height: '3.75rem', textAlign: 'center', fontSize: '1.25rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', color: '#374151', caretColor: '#10B981', appearance: 'none' };
  const otpInputFocusStyle: CSSProperties = { borderColor: '#10B981', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.5)' };
  const errorMessageStyle: CSSProperties = { color: '#DC2626', fontSize: '0.875rem', marginBottom: '1rem', minHeight: '1.5em' };
  const resendContainerStyle: CSSProperties = { marginBottom: '1.25rem', fontSize: '0.875rem', color: '#4B5563', height: '1.25rem' };
  const resendButtonStyle: CSSProperties = { color: '#059669', fontWeight: 500, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' };
  const resendButtonHoverStyle: CSSProperties = { color: '#047857' };
  const confirmButtonStyle: CSSProperties = { width: '100%', background: 'linear-gradient(to right, #10B981, #059669)', color: 'white', padding: '0.875rem 1rem', borderRadius: '0.5rem', fontSize: '1.125rem', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'background 0.3s ease-in-out' };
  const confirmButtonHoverStyle: CSSProperties = { background: 'linear-gradient(to right, #059669, #047857)' };
  const [isConfirmHovered, setIsConfirmHovered] = useState(false); const [isResendHovered, setIsResendHovered] = useState(false); const [isChangeNumHovered, setIsChangeNumHovered] = useState(false);

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>{t.otpScreenTitle}</h1> <p style={subtitleStyle}>{t.otpScreenSubtitle.replace('{phoneNumber}', phoneNumber)}</p>
      <div style={changeNumberContainerStyle}><button onClick={onBack} style={isChangeNumHovered ? {...changeNumberButtonStyle, ...changeNumberButtonHoverStyle} : changeNumberButtonStyle} onMouseEnter={() => setIsChangeNumHovered(true)} onMouseLeave={() => setIsChangeNumHovered(false)}>({t.changeNumber})</button></div>
      <div style={otpInputsContainerStyle} onPaste={handlePaste}>{otp.map((data, index) => (<input key={index} type="tel" name={`otp-${index}`} style={focusedInput === index ? {...otpInputBaseStyle, ...otpInputFocusStyle} : otpInputBaseStyle} value={data} onChange={(e) => handleChange(e.target, index)} onKeyDown={(e) => handleKeyDown(e, index)} onFocus={() => setFocusedInput(index)} maxLength={1} ref={(el) => { inputRefs.current[index] = el; }} aria-label={`OTP digit ${index + 1}`} autoComplete="off" />))}</div>
      {error && <p style={errorMessageStyle} aria-live="assertive">{error}</p>} {!error && <div style={{...errorMessageStyle, visibility: 'hidden'}}>Placeholder</div>}
      <div style={resendContainerStyle}>{canResend ? (<button onClick={handleResendClick} style={isResendHovered ? {...resendButtonStyle, ...resendButtonHoverStyle} : resendButtonStyle} onMouseEnter={() => setIsResendHovered(true)} onMouseLeave={() => setIsResendHovered(false)} aria-live="polite">{t.resendOtp}</button>) : (<span aria-live="polite">{t.resendOtpCountdown.replace('{timer}', String(timer))}</span>)}</div>
      <button id="confirm-otp-button" style={isConfirmHovered ? {...confirmButtonStyle, ...confirmButtonHoverStyle} : confirmButtonStyle} onMouseEnter={() => setIsConfirmHovered(true)} onMouseLeave={() => setIsConfirmHovered(false)} onClick={handleSubmit}>{t.confirmOtpButton}</button>
    </div>
  );
};
