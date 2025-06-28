import React, { useState, useEffect, CSSProperties } from 'react';
import { translations, Language } from '../translations';
import { UserRole } from '../types';
import { CloseIcon } from './icons';

interface CancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reasonKey: string, customReason: string) => void;
    userRole: UserRole;
    currentLang: Language;
    isSubmitting: boolean;
}

export const CancellationModal: React.FC<CancellationModalProps> = ({ isOpen, onClose, onSubmit, userRole, currentLang, isSubmitting }) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';
    const [selectedReason, setSelectedReason] = useState('');
    const [customReason, setCustomReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedReason('');
            setCustomReason('');
        }
    }, [isOpen]);

    const passengerReasons = [
        { key: 'driver_took_too_long', text: t.cancellationReasonPassenger1 },
        { key: 'driver_not_moving', text: t.cancellationReasonPassenger2 },
        { key: 'wrong_vehicle', text: t.cancellationReasonPassenger3 },
        { key: 'plans_changed', text: t.cancellationReasonPassenger4 },
    ];

    const driverReasons = [
        { key: 'passenger_no_show', text: t.cancellationReasonDriver1 },
        { key: 'passenger_extra_luggage', text: t.cancellationReasonDriver2 },
        { key: 'vehicle_issue', text: t.cancellationReasonDriver3 },
        { key: 'passenger_request', text: t.cancellationReasonDriver4 },
    ];

    const reasons = userRole === 'passenger' ? passengerReasons : driverReasons;
    reasons.push({ key: 'other', text: t.cancellationReasonOther });

    const handleSubmit = () => {
        if (!isSubmitting) {
            onSubmit(selectedReason, customReason);
        }
    };
    
    const canSubmit = !isSubmitting && (selectedReason && (selectedReason !== 'other' || (selectedReason === 'other' && customReason.trim() !== '')));

    if (!isOpen) return null;
    
    // Styles
    const overlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, direction: isRTL ? 'rtl' : 'ltr' };
    const modalStyle: CSSProperties = { backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', width: '90%', maxWidth: '450px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' };
    const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' };
    const titleStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937', margin: 0 };
    const closeButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' };
    const subtitleStyle: CSSProperties = { fontSize: '1rem', color: '#4B5563', marginBottom: '1.5rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem'};
    const reasonsContainerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' };
    const reasonOptionStyle = (isSelected: boolean): CSSProperties => ({
        padding: '0.875rem',
        border: `1px solid ${isSelected ? '#10B981' : '#D1D5DB'}`,
        borderRadius: '0.5rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isSelected ? '#F0FDF4' : 'white',
        transition: 'all 0.2s ease-in-out',
    });
    const radioCircleStyle: CSSProperties = { width: '1.25rem', height: '1.25rem', borderRadius: '50%', border: '2px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', [isRTL ? 'marginLeft' : 'marginRight']: '0.75rem' };
    const radioInnerCircleStyle: CSSProperties = { width: '0.75rem', height: '0.75rem', borderRadius: '50%', backgroundColor: '#10B981' };
    const customReasonTextareaStyle: CSSProperties = {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #D1D5DB',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        boxSizing: 'border-box',
        resize: 'vertical',
        minHeight: '80px',
        marginTop: '0.5rem',
        display: selectedReason === 'other' ? 'block' : 'none',
        transition: 'display 0.3s',
    };
    const footerStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0'};
    const submitButtonStyle: CSSProperties = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#10B981',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
        opacity: canSubmit ? 1 : 0.5,
        transition: 'opacity 0.2s',
    };
    const cancelModalButtonStyle: CSSProperties = {
        padding: '0.75rem 1.5rem',
        backgroundColor: '#E5E7EB',
        color: '#4B5563',
        border: 'none',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h2 style={titleStyle}>{t.confirmCancellationTitle}</h2>
                    <button style={closeButtonStyle} onClick={onClose} aria-label={t.closeButton}><CloseIcon /></button>
                </div>
                <p style={subtitleStyle}>{t.cancellationReasonTitle}</p>
                <div style={reasonsContainerStyle}>
                    {reasons.map(reason => (
                        <div key={reason.key} style={reasonOptionStyle(selectedReason === reason.key)} onClick={() => setSelectedReason(reason.key)}>
                            <div style={radioCircleStyle}>
                                {selectedReason === reason.key && <div style={radioInnerCircleStyle} />}
                            </div>
                            <span>{reason.text}</span>
                        </div>
                    ))}
                </div>
                <textarea
                    style={customReasonTextareaStyle}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder={t.cancellationCommentPlaceholder}
                    rows={3}
                    aria-label={t.cancellationReasonOther}
                />
                <div style={footerStyle}>
                    <button style={cancelModalButtonStyle} onClick={onClose} disabled={isSubmitting}>{t.cancelButton}</button>
                    <button style={submitButtonStyle} onClick={handleSubmit} disabled={!canSubmit}>
                        {isSubmitting ? t.servicesLoading : t.submitCancellationButton}
                    </button>
                </div>
            </div>
        </div>
    );
};
