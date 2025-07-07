
import React, { useState, useEffect, CSSProperties } from 'react';
import { translations, Language } from '../translations';
import { CloseIcon } from './icons';

interface AddPlaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (placeName: string) => void;
    isSubmitting: boolean;
    currentLang: Language;
}

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({ isOpen, onClose, onSubmit, isSubmitting, currentLang }) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';
    const [placeName, setPlaceName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPlaceName('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = () => {
        if (placeName.trim().length < 3) {
            setError(isRTL ? 'نام مکان باید حداقل ۳ حرف داشته باشد.' : 'Place name must be at least 3 characters.');
            return;
        }
        setError('');
        onSubmit(placeName);
    };

    if (!isOpen) return null;

    const overlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, direction: isRTL ? 'rtl' : 'ltr' };
    const modalStyle: CSSProperties = { backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', width: '90%', maxWidth: '400px', maxHeight: '90vh' };
    const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem' };
    const titleStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937', margin: 0 };
    const closeButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' };
    const labelStyle: CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: '#2D3748' };
    const inputStyle: CSSProperties = { width: '100%', padding: '0.75rem', border: '1px solid #CBD5E0', borderRadius: '0.375rem', fontSize: '1rem', boxSizing: 'border-box' };
    const errorStyle: CSSProperties = { color: '#C53030', fontSize: '0.8rem', marginTop: '0.25rem', minHeight: '1.2em' };
    const footerStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0' };
    const submitButtonStyle: CSSProperties = { padding: '0.75rem 1.5rem', backgroundColor: '#3182CE', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', opacity: isSubmitting ? 0.6 : 1 };
    const cancelModalButtonStyle: CSSProperties = { padding: '0.75rem 1.5rem', backgroundColor: '#E5E7EB', color: '#4B5563', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h2 style={titleStyle}>{t.addText}</h2>
                    <button style={closeButtonStyle} onClick={onClose}><CloseIcon /></button>
                </div>
                <div>
                    <label htmlFor="placeName" style={labelStyle}>{isRTL ? 'نام مکان' : 'Place Name'}</label>
                    <input
                        type="text"
                        id="placeName"
                        value={placeName}
                        onChange={(e) => setPlaceName(e.target.value)}
                        style={inputStyle}
                        placeholder={isRTL ? 'مثال: چهارراه فرهنگ' : 'e.g., Farhang Square'}
                        autoFocus
                    />
                    <p style={errorStyle}>{error || ' '}</p>
                </div>
                <div style={footerStyle}>
                    <button style={cancelModalButtonStyle} onClick={onClose} disabled={isSubmitting}>{t.cancelButton}</button>
                    <button style={submitButtonStyle} onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? t.servicesLoading : (isRTL ? 'ذخیره' : 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
