import React, { useEffect, useState, CSSProperties } from 'react';
import { CloseIcon } from './icons/CloseIcon';

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mount animation
    const mountTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-close timer
    const closeTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
        clearTimeout(mountTimer);
        clearTimeout(closeTimer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    // Allow time for fade-out animation before calling the actual close handler
    setTimeout(onClose, 300); 
  };

  const toastStyle: CSSProperties = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: `translateX(-50%) ${isVisible ? 'translateY(0)' : 'translateY(-120%)'}`,
    minWidth: '280px',
    maxWidth: '90%',
    backgroundColor: 'white',
    color: '#fff',
    padding: '1rem 1.5rem',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'transform 0.3s ease-in-out',
    borderLeft: '5px solid',
  };

  const messageStyle: CSSProperties = {
    margin: '0 1rem 0 0',
    flexGrow: 1,
  };

  const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
    opacity: 0.8
  };

  switch (type) {
    case 'error':
      toastStyle.backgroundColor = '#FFF5F5';
      toastStyle.color = '#C53030';
      toastStyle.borderLeftColor = '#E53E3E';
      break;
    case 'success':
      toastStyle.backgroundColor = '#F0FFF4';
      toastStyle.color = '#2F855A';
      toastStyle.borderLeftColor = '#38A169';
      break;
    case 'info':
    default:
      toastStyle.backgroundColor = '#EBF8FF';
      toastStyle.color = '#2B6CB0';
      toastStyle.borderLeftColor = '#3182CE';
      break;
  }

  return (
    <div style={toastStyle} role="alert">
      <p style={messageStyle}>{message}</p>
      <button onClick={handleClose} style={closeButtonStyle} aria-label="Close">
        <CloseIcon style={{ width: '1rem', height: '1rem' }} />
      </button>
    </div>
  );
};
