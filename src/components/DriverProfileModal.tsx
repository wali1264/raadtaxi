import React, { useState, useEffect, CSSProperties } from 'react';
// supabase client removed, will use userService
import { translations, Language } from '../translations';
import { DriverProfileData } from '../types';
import { CloseIcon, ProfileIcon as DefaultProfileIcon } from './icons';
import { userService } from '../services/userService'; // Import userService
import { getDebugMessage } from '../utils/helpers'; // For robust error logging

interface DriverProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLang: Language;
    loggedInUserId: string | null;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({ isOpen, onClose, currentLang, loggedInUserId }) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';

    const [profileData, setProfileData] = useState<Partial<DriverProfileData>>({
        fullName: '',
        phoneNumber: '', // Will be read-only from userService
        profilePicUrl: '',
        vehicleModel: '',
        vehicleColor: '',
        plateRegion: '',
        plateNumbers: '',
        plateTypeChar: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && loggedInUserId) {
            const fetchProfile = async () => {
                setIsLoading(true);
                setError(null);
                setSuccessMessage(null);
                try {
                    const fetchedData = await userService.fetchDriverProfile(loggedInUserId);
                    setProfileData({
                        fullName: fetchedData.fullName || '',
                        phoneNumber: fetchedData.phoneNumber || '',
                        profilePicUrl: fetchedData.profilePicUrl || '',
                        vehicleModel: fetchedData.vehicleModel || '',
                        vehicleColor: fetchedData.vehicleColor || '',
                        plateRegion: fetchedData.plateRegion || '',
                        plateNumbers: fetchedData.plateNumbers || '',
                        plateTypeChar: fetchedData.plateTypeChar || '',
                    });
                } catch (err: any) {
                    console.error("DriverProfileModal: Error fetching profile data -", getDebugMessage(err), err);
                    setError(t.errorLoadingProfileData);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchProfile();
        }
    }, [isOpen, loggedInUserId, t.errorLoadingProfileData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
        setSuccessMessage(null); 
        setError(null);
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loggedInUserId) {
            setError("User not logged in."); // Should not happen if modal is open
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Prepare only the fields that userService.updateDriverProfile expects
            const dataToUpdate: Partial<DriverProfileData> = {
                fullName: profileData.fullName, // Will update users.full_name
                // phoneNumber is not updated here
                profilePicUrl: profileData.profilePicUrl,
                vehicleModel: profileData.vehicleModel,
                vehicleColor: profileData.vehicleColor,
                plateRegion: profileData.plateRegion,
                plateNumbers: profileData.plateNumbers,
                plateTypeChar: profileData.plateTypeChar,
            };

            await userService.updateDriverProfile(loggedInUserId, dataToUpdate);
            setSuccessMessage(t.profileUpdatedSuccessfully);
        } catch (err: any) {
            console.error("DriverProfileModal: Error saving profile data -", getDebugMessage(err), err);
            setError(t.errorUpdatingProfile + (err.message ? `: ${getDebugMessage(err)}` : ''));
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    const modalOverlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, direction: isRTL ? 'rtl' : 'ltr' };
    const modalContentStyle: CSSProperties = { backgroundColor: 'white', padding: '1.5rem 2rem', borderRadius: '0.75rem', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', width: '90%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' };
    const modalHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0e0e0'};
    const modalTitleStyle: CSSProperties = { fontSize: '1.5rem', fontWeight: 'bold', color: '#333', margin: 0 };
    const modalCloseButtonStyle: CSSProperties = { background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#555', padding: '0.25rem' };
    
    const formSectionStyle: CSSProperties = { marginBottom: '1.5rem' };
    const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600, color: '#4A5568', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E2E8F0' };
    
    const inputGroupStyle: CSSProperties = { marginBottom: '1rem' };
    const labelStyle: CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: '#2D3748' };
    const inputStyle: CSSProperties = { width: '100%', padding: '0.75rem', border: '1px solid #CBD5E0', borderRadius: '0.375rem', fontSize: '1rem', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' };
    // const inputFocusStyle: CSSProperties = { borderColor: '#4299E1', boxShadow: '0 0 0 1px #4299E1' }; // Example focus
    
    const plateInputsContainerStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' };
    const plateInputStyle: CSSProperties = { ...inputStyle, flex: 1 };

    const profilePicContainerStyle: CSSProperties = { textAlign: 'center', marginBottom: '1rem' };
    const profileImagePreviewStyle: CSSProperties = { width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', margin: '0.5rem auto', display: 'block', border: '2px solid #E2E8F0', backgroundColor: '#F7FAFC' };
    
    const actionsContainerStyle: CSSProperties = { marginTop: '1.5rem', display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0'};
    const buttonBaseStyle: CSSProperties = { padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.375rem', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' };
    const saveButtonStyle: CSSProperties = { ...buttonBaseStyle, backgroundColor: '#3182CE', color: 'white' };
    const saveButtonHoverStyle: CSSProperties = { backgroundColor: '#2B6CB0' };
    const cancelButtonModalStyle: CSSProperties = { ...buttonBaseStyle, backgroundColor: '#E2E8F0', color: '#2D3748' };
    const cancelButtonModalHoverStyle: CSSProperties = { backgroundColor: '#CBD5E0'};
    
    const messageStyle: CSSProperties = { textAlign: 'center', padding: '0.5rem', borderRadius: '0.25rem', margin: '1rem 0', fontSize: '0.9rem'};
    const successMessageStyle: CSSProperties = {...messageStyle, backgroundColor: '#C6F6D5', color: '#2F855A'};
    const errorMessageStyle: CSSProperties = {...messageStyle, backgroundColor: '#FED7D7', color: '#C53030'};

    return (
        <div style={modalOverlayStyle} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="driver-profile-title">
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h2 id="driver-profile-title" style={modalTitleStyle}>{t.driverProfileScreenTitle}</h2>
                    <button style={modalCloseButtonStyle} onClick={onClose} aria-label={t.closeButton}>
                        <CloseIcon />
                    </button>
                </div>

                {isLoading && <p style={{textAlign: 'center', margin: '2rem 0'}}>{t.loadingProfileData}</p>}
                {error && <p style={errorMessageStyle}>{error}</p>}
                {successMessage && <p style={successMessageStyle}>{successMessage}</p>}

                {!isLoading && !error && ( // Only show form if not loading and no initial load error
                    <form onSubmit={handleSaveChanges}>
                        <div style={formSectionStyle}>
                            <h3 style={sectionTitleStyle}>{t.personalInfoSectionTitle}</h3>
                            <div style={profilePicContainerStyle}>
                                {profileData.profilePicUrl ? (
                                    <img src={profileData.profilePicUrl} alt={t.profilePictureLabel} style={profileImagePreviewStyle} />
                                ) : (
                                    <DefaultProfileIcon style={{...profileImagePreviewStyle, padding: '20px', color: '#A0AEC0'}}/>
                                )}
                            </div>
                            <div style={inputGroupStyle}>
                                <label htmlFor="profilePicUrl" style={labelStyle}>{t.profilePicUrlLabel}</label>
                                <input type="text" id="profilePicUrl" name="profilePicUrl" style={inputStyle} value={profileData.profilePicUrl || ''} onChange={handleInputChange} placeholder="https://example.com/image.png" />
                            </div>
                            <div style={inputGroupStyle}>
                                <label htmlFor="fullName" style={labelStyle}>{t.fullNameLabel}</label>
                                <input type="text" id="fullName" name="fullName" style={inputStyle} value={profileData.fullName || ''} onChange={handleInputChange} required />
                            </div>
                            <div style={inputGroupStyle}>
                                <label htmlFor="phoneNumber" style={labelStyle}>{t.mobileNumberLabel}</label>
                                <input type="tel" id="phoneNumber" name="phoneNumber" style={{...inputStyle, backgroundColor: '#F7FAFC', color: '#718096'}} value={profileData.phoneNumber || ''} readOnly disabled />
                            </div>
                        </div>

                        <div style={formSectionStyle}>
                            <h3 style={sectionTitleStyle}>{t.vehicleInfoSectionTitle}</h3>
                            <div style={inputGroupStyle}>
                                <label htmlFor="vehicleModel" style={labelStyle}>{t.vehicleModelLabel}</label>
                                <input type="text" id="vehicleModel" name="vehicleModel" style={inputStyle} value={profileData.vehicleModel || ''} onChange={handleInputChange} />
                            </div>
                            <div style={inputGroupStyle}>
                                <label htmlFor="vehicleColor" style={labelStyle}>{t.vehicleColorLabel}</label>
                                <input type="text" id="vehicleColor" name="vehicleColor" style={inputStyle} value={profileData.vehicleColor || ''} onChange={handleInputChange} />
                            </div>
                            <div style={inputGroupStyle}>
                                <label style={labelStyle}>{t.plateNumberLabel}</label>
                                <div style={plateInputsContainerStyle}>
                                    <input type="text" name="plateRegion" style={plateInputStyle} value={profileData.plateRegion || ''} onChange={handleInputChange} placeholder={t.plateRegionLabel} />
                                    <input type="text" name="plateNumbers" style={plateInputStyle} value={profileData.plateNumbers || ''} onChange={handleInputChange} placeholder={t.plateNumbersLabel} />
                                    <input type="text" name="plateTypeChar" style={{...plateInputStyle, flexBasis: '80px', flexGrow: 0}} value={profileData.plateTypeChar || ''} onChange={handleInputChange} placeholder={t.plateTypeCharLabel} maxLength={1} />
                                </div>
                            </div>
                        </div>

                        <div style={actionsContainerStyle}>
                            <button type="button" style={cancelButtonModalStyle} onClick={onClose}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = cancelButtonModalHoverStyle.backgroundColor!}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = cancelButtonModalStyle.backgroundColor!}
                            >
                                {t.closeButton}
                            </button>
                            <button type="submit" style={saveButtonStyle} disabled={isLoading}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = saveButtonHoverStyle.backgroundColor!}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = saveButtonStyle.backgroundColor!}
                            >
                                {isLoading ? t.servicesLoading : t.saveChangesButton}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
