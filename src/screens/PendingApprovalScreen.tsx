import React, { CSSProperties } from 'react';
import { useAppContext } from '../contexts/AppContext';

interface PendingApprovalScreenProps {
  onLogout: () => void;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ onLogout }) => {
  const { t, currentLang } = useAppContext();
  const isRTL = currentLang !== 'en';

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '2rem',
    backgroundColor: '#fff',
    textAlign: 'center',
    boxSizing: 'border-box',
    direction: isRTL ? 'rtl' : 'ltr',
  };
  const cardStyle: CSSProperties = {
    backgroundColor: 'white',
    padding: '2rem 2.5rem',
    borderRadius: '0.75rem',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    width: '100%',
    maxWidth: '450px',
  };
  const iconStyle: CSSProperties = {
    fontSize: '4rem',
    color: '#FBBF24', // Amber color
    marginBottom: '1rem',
  };
  const titleStyle: CSSProperties = {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '0.75rem',
  };
  const messageStyle: CSSProperties = {
    fontSize: '1rem',
    color: '#4B5563',
    marginBottom: '2rem',
    lineHeight: 1.6,
  };
  const logoutButtonStyle: CSSProperties = {
    width: '100%',
    padding: '0.875rem 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#4B5563',
    backgroundColor: '#E5E7EB',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };
  const logoutButtonHoverStyle: CSSProperties = {
    backgroundColor: '#D1D5DB',
  };
  const [isLogoutHovered, setIsLogoutHovered] = React.useState(false);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={iconStyle} role="img" aria-label="Hourglass">⌛</div>
        <h1 style={titleStyle}>{t.pendingApprovalTitle}</h1>
        <p style={messageStyle}>{t.pendingApprovalMessage}</p>
        <button
          style={isLogoutHovered ? { ...logoutButtonStyle, ...logoutButtonHoverStyle } : logoutButtonStyle}
          onMouseEnter={() => setIsLogoutHovered(true)}
          onMouseLeave={() => setIsLogoutHovered(false)}
          onClick={onLogout}
        >
          {t.logoutButton}
        </button>
      </div>
    </div>
  );
};