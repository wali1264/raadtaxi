
import React, { CSSProperties } from 'react';
import { translations, Language } from '../translations';
import { CloseIcon } from './icons';

interface DrawerPanelProps {
    currentLang: Language;
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    side?: 'left' | 'right';
}

export const DrawerPanel: React.FC<DrawerPanelProps> = ({ currentLang, isOpen, onClose, title, children, side }) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';
    const actualSide = side || (isRTL ? 'right' : 'left');

    const drawerStyle: CSSProperties = {
        position: 'fixed',
        top: 0,
        [actualSide]: isOpen ? '0' : '-350px',
        width: '320px',
        maxWidth: '85vw',
        height: '100%',
        backgroundColor: 'white',
        boxShadow: isOpen ? (actualSide === 'left' ? '5px 0 15px rgba(0,0,0,0.2)' : '-5px 0 15px rgba(0,0,0,0.2)') : 'none',
        zIndex: 1500,
        transition: `${actualSide} 0.3s ease-out`,
        display: 'flex',
        flexDirection: 'column',
        direction: isRTL ? 'rtl' : 'ltr',
    };
    const headerStyle: CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f8f9fa'
    };
    const titleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: '600', color: '#333', margin: 0 };
    const closeButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' };
    const contentStyle: CSSProperties = { padding: '1rem', overflowY: 'auto', flexGrow: 1 };

    return (
        <>
            {isOpen && <div onClick={onClose} style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1499}} />}
            <div style={drawerStyle} role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden={!isOpen}>
                <div style={headerStyle}>
                    <h2 id="drawer-title" style={titleStyle}>{title}</h2>
                    <button style={closeButtonStyle} onClick={onClose} aria-label={t.closeDrawerButton}>
                        <CloseIcon style={{color: '#555'}}/>
                    </button>
                </div>
                <div style={contentStyle}>
                    {children}
                </div>
            </div>
        </>
    );
};
