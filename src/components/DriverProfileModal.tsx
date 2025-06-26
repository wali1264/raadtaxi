import React, { useState, useEffect, CSSProperties, useRef } from 'react';
// supabase client removed, will use userService
import { translations, Language } from '../translations';
import { DriverProfileData, PredefinedSound } from '../types';
import { CloseIcon, UserCircleIcon as DefaultProfileIcon, EditIcon } from '../components/icons'; // Added UserCircleIcon & EditIcon
import { userService } from '../services/userService'; // Import userService
import { getDebugMessage } from '../utils/helpers'; // For robust error logging

interface DriverProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLang: Language;
    loggedInUserId: string | null;
}

const predefinedSounds: PredefinedSound[] = [
    { id: 'default', nameKey: 'predefinedSoundDefault', fileName: 'default_notification.mp3' },
    { id: 'chime', nameKey: 'predefinedSoundChime', fileName: 'chime.mp3' },
    { id: 'alert', nameKey: 'predefinedSoundAlert', fileName: 'alert_tone.mp3' },
];

const PLACEHOLDER_DRIVER_NEW_IMAGE = "::placeholder_driver_new_image::";


export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({ isOpen, onClose, currentLang, loggedInUserId }) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';

    const [profileData, setProfileData] = useState<Partial<DriverProfileData>>({
        fullName: '',
        phoneNumber: '', 
        profilePicUrl: '',
        vehicleModel: '',
        vehicleColor: '',
        plateRegion: '',
        plateNumbers: '',
        plateTypeChar: '',
        alertSoundPreference: 'default_notification.mp3',
    });
    const [initialProfileData, setInitialProfileData] = useState<Partial<DriverProfileData>>({});
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [selectedCustomSoundFile, setSelectedCustomSoundFile] = useState<File | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const customSoundInputRef = useRef<HTMLInputElement>(null);
    const [showChangePhotoOptions, setShowChangePhotoOptions] = useState(false);


    useEffect(() => {
        if (isOpen && loggedInUserId) {
            const fetchProfile = async () => {
                setIsLoading(true);
                setError(null);
                setSuccessMessage(null);
                setSelectedImageFile(null);
                setImagePreviewUrl(null);
                setSelectedCustomSoundFile(null);
                setShowChangePhotoOptions(false);
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
                        alertSoundPreference: fetchedData.alertSoundPreference || 'default_notification.mp3',
                    });
                    setInitialProfileData(fetchedData); // Store the entire fetched data as initial
                    if (fetchedData.profilePicUrl && !fetchedData.profilePicUrl.startsWith("::placeholder")) {
                       setImagePreviewUrl(fetchedData.profilePicUrl);
                    }
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

    useEffect(() => {
        const currentFullName = profileData.fullName?.trim() || "";
        const initialFullName = initialProfileData.fullName?.trim() || "";
        const currentVehicleModel = profileData.vehicleModel?.trim() || "";
        const initialVehicleModel = initialProfileData.vehicleModel?.trim() || "";
        const currentVehicleColor = profileData.vehicleColor?.trim() || "";
        const initialVehicleColor = initialProfileData.vehicleColor?.trim() || "";
        const currentPlateRegion = profileData.plateRegion?.trim() || "";
        const initialPlateRegion = initialProfileData.plateRegion?.trim() || "";
        const currentPlateNumbers = profileData.plateNumbers?.trim() || "";
        const initialPlateNumbers = initialProfileData.plateNumbers?.trim() || "";
        const currentPlateTypeChar = profileData.plateTypeChar?.trim() || "";
        const initialPlateTypeChar = initialProfileData.plateTypeChar?.trim() || "";
        const currentAlertSound = profileData.alertSoundPreference || 'default_notification.mp3';
        const initialAlertSound = initialProfileData.alertSoundPreference || 'default_notification.mp3';


        if (currentFullName !== initialFullName ||
            currentVehicleModel !== initialVehicleModel ||
            currentVehicleColor !== initialVehicleColor ||
            currentPlateRegion !== initialPlateRegion ||
            currentPlateNumbers !== initialPlateNumbers ||
            currentPlateTypeChar !== initialPlateTypeChar ||
            currentAlertSound !== initialAlertSound ||
            selectedImageFile !== null ||
            (selectedImageFile === null && profileData.profilePicUrl !== initialProfileData.profilePicUrl) ||
            selectedCustomSoundFile !== null // Check if a custom sound file was selected
        ) {
          setHasChanges(true);
        } else {
          setHasChanges(false);
        }
      }, [profileData, selectedImageFile, initialProfileData, selectedCustomSoundFile]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
        if (name === 'alertSoundPreference' && !value.startsWith('custom:')) {
            setSelectedCustomSoundFile(null);
        }
        setSuccessMessage(null); 
        setError(null);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          setSelectedImageFile(file);
          setImagePreviewUrl(URL.createObjectURL(file));
          setSuccessMessage(null);
          setError(null);
          setShowChangePhotoOptions(false);
        }
        if(event.target) event.target.value = ''; 
    };
    
    const handleRemovePhoto = () => {
        setSelectedImageFile(null);
        setImagePreviewUrl(null);
        setProfileData(prev => ({ ...prev, profilePicUrl: '' })); 
        setSuccessMessage(null);
        setError(null);
        setShowChangePhotoOptions(false);
    };


    const handleCustomSoundFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedCustomSoundFile(file);
            setProfileData(prev => ({ ...prev, alertSoundPreference: `custom:${file.name}`}));
        }
        setSuccessMessage(null);
        setError(null);
    };

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loggedInUserId || !hasChanges) {
            if (!hasChanges) setSuccessMessage(t.profileUpdatedSuccessfully); // No changes made but treat as "success"
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const dataToUpdate: Partial<DriverProfileData> = {
                // Ensure all fields that CAN be updated are included if they changed
                ...(profileData.fullName !== initialProfileData.fullName && { fullName: profileData.fullName?.trim() }),
                ...(profileData.vehicleModel !== initialProfileData.vehicleModel && { vehicleModel: profileData.vehicleModel?.trim() }),
                ...(profileData.vehicleColor !== initialProfileData.vehicleColor && { vehicleColor: profileData.vehicleColor?.trim() }),
                ...(profileData.plateRegion !== initialProfileData.plateRegion && { plateRegion: profileData.plateRegion?.trim() }),
                ...(profileData.plateNumbers !== initialProfileData.plateNumbers && { plateNumbers: profileData.plateNumbers?.trim() }),
                ...(profileData.plateTypeChar !== initialProfileData.plateTypeChar && { plateTypeChar: profileData.plateTypeChar?.trim() }),
                ...(profileData.alertSoundPreference !== initialProfileData.alertSoundPreference && { alertSoundPreference: profileData.alertSoundPreference }),
            };
            
            // Handle profile picture update
            let newProfilePicUrlForState = profileData.profilePicUrl;
            if (selectedImageFile) { 
              dataToUpdate.profilePicUrl = PLACEHOLDER_DRIVER_NEW_IMAGE; // Placeholder for new image
              newProfilePicUrlForState = PLACEHOLDER_DRIVER_NEW_IMAGE;
            } else if (profileData.profilePicUrl !== initialProfileData.profilePicUrl) { 
              // This handles if the URL was cleared (empty string) or manually changed (not typical for this UI)
              dataToUpdate.profilePicUrl = profileData.profilePicUrl || undefined;
              newProfilePicUrlForState = profileData.profilePicUrl || '';
            }
            
            // TODO: If selectedCustomSoundFile exists, upload it and update alertSoundPreference with its URL/identifier.
            // For now, we are just saving the `custom:filename` string.
            // If the backend handles custom file uploads, that logic would go here.

            if (Object.keys(dataToUpdate).length > 0) {
                 await userService.updateDriverProfile(loggedInUserId, dataToUpdate);
            }
            
            // Update initialProfileData to reflect the saved state
            const updatedInitialProfile = { ...initialProfileData, ...dataToUpdate };
            if (newProfilePicUrlForState !== undefined) { 
                 updatedInitialProfile.profilePicUrl = newProfilePicUrlForState;
            }
            setInitialProfileData(updatedInitialProfile);
            
            setProfileData(prev => ({ ...prev, ...updatedInitialProfile }));


            setSuccessMessage(t.profileUpdatedSuccessfully);
            setSelectedImageFile(null); 
            setSelectedCustomSoundFile(null); // Clear selected custom sound file after save
            
            if (newProfilePicUrlForState && newProfilePicUrlForState !== PLACEHOLDER_DRIVER_NEW_IMAGE && !newProfilePicUrlForState.startsWith('blob:')) {
              setImagePreviewUrl(newProfilePicUrlForState);
            } else if (!newProfilePicUrlForState || newProfilePicUrlForState === PLACEHOLDER_DRIVER_NEW_IMAGE) {
              setImagePreviewUrl(null); 
            }
            setHasChanges(false);

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
    const selectStyle: CSSProperties = { ...inputStyle, appearance: 'none' as 'none', backgroundRepeat: 'no-repeat', backgroundPosition: isRTL ? `calc(0% + 0.75rem) center` : `calc(100% - 0.75rem) center`, backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%234A5568" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>')`, paddingRight: isRTL ? '0.75rem' : '2.5rem', paddingLeft: isRTL ? '2.5rem' : '0.75rem' };

    const plateInputsContainerStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' };
    const plateInputStyle: CSSProperties = { ...inputStyle, flex: 1 };

    const profilePicContainerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', };
    const imagePreviewContainerStyle: CSSProperties = { width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '1rem', border: '3px solid white', boxShadow: '0 0 10px rgba(0,0,0,0.1)' };
    const profileImagePreviewStyleElement: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
    
    const changePhotoButtonStyling: CSSProperties = {
        backgroundColor: '#EDF2F7', color: '#4A5568', border: 'none', borderRadius: '0.375rem',
        padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
    };
    const photoOptionsPopupStyle: CSSProperties = {
        position: 'absolute', backgroundColor: 'white', borderRadius: '0.375rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 20, marginTop: '0.5rem',
        border: '1px solid #E2E8F0', width: '180px', transform: isRTL ? 'translateX(50%) right(50%)' : 'translateX(-50%) left(50%)'
    };
    const photoOptionButtonStyle: CSSProperties = {
        display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: isRTL ? 'right' : 'left',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
    };
    const photoOptionButtonHoverStyle: CSSProperties = { backgroundColor: '#F7FAFC' };

    
    const actionsContainerStyle: CSSProperties = { marginTop: '1.5rem', display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e0e0e0'};
    const buttonBaseStyle: CSSProperties = { padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.375rem', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' };
    const saveButtonStyle: CSSProperties = { ...buttonBaseStyle, backgroundColor: '#3182CE', color: 'white' };
    const saveButtonHoverStyle: CSSProperties = { backgroundColor: '#2B6CB0' };
    const cancelButtonModalStyle: CSSProperties = { ...buttonBaseStyle, backgroundColor: '#E2E8F0', color: '#2D3748' };
    const cancelButtonModalHoverStyle: CSSProperties = { backgroundColor: '#CBD5E0'};
    const saveButtonDisabledStyle: CSSProperties = { backgroundColor: '#A0AEC0', opacity: 0.7, cursor: 'not-allowed' };
    
    const messageStyle: CSSProperties = { textAlign: 'center', padding: '0.5rem', borderRadius: '0.25rem', margin: '1rem 0', fontSize: '0.9rem'};
    const successMessageStyle: CSSProperties = {...messageStyle, backgroundColor: '#C6F6D5', color: '#2F855A'};
    const errorMessageStyle: CSSProperties = {...messageStyle, backgroundColor: '#FED7D7', color: '#C53030'};

    const customSoundFilenameStyle: CSSProperties = {
        fontSize: '0.8rem',
        color: '#4A5568',
        marginTop: '0.25rem',
        textAlign: isRTL ? 'right': 'left',
    };
    
    const currentSelectedSoundValue = profileData.alertSoundPreference?.startsWith('custom:') 
                                  ? 'custom' 
                                  : profileData.alertSoundPreference || 'default_notification.mp3';

    const renderProfileImage = () => {
        if (imagePreviewUrl) {
          if (imagePreviewUrl.startsWith("blob:") || imagePreviewUrl.startsWith("http")) {
            return <img src={imagePreviewUrl} alt={t.profilePictureLabel} style={profileImagePreviewStyleElement} />;
          }
        }
        if (profileData.profilePicUrl === PLACEHOLDER_DRIVER_NEW_IMAGE || !profileData.profilePicUrl) {
          return <DefaultProfileIcon style={{ width: '80px', height: '80px', color: '#A0AEC0' }} />;
        }
        if (profileData.profilePicUrl && !profileData.profilePicUrl.startsWith("::placeholder")) {
            return <img src={profileData.profilePicUrl} alt={t.profilePictureLabel} style={profileImagePreviewStyleElement} 
                        onError={(e) => { 
                            // Try to replace with default icon if image fails to load
                            const parent = e.currentTarget.parentNode;
                            if (parent) {
                                e.currentTarget.style.display = 'none'; // Hide broken image
                                const defaultIconRendered = parent.querySelector('.default-profile-icon-placeholder');
                                if (!defaultIconRendered) { // Avoid adding multiple svgs
                                     const svgNS = "http://www.w3.org/2000/svg";
                                     const svg = document.createElementNS(svgNS, "svg");
                                     // Set attributes similar to DefaultProfileIcon
                                     svg.setAttribute("viewBox", "0 0 24 24");
                                     svg.setAttribute("fill", "currentColor");
                                     svg.setAttribute("stroke", "currentColor");
                                     svg.setAttribute("stroke-width", "1");
                                     svg.style.width = '80px';
                                     svg.style.height = '80px';
                                     svg.style.color = '#A0AEC0';
                                     svg.classList.add('default-profile-icon-placeholder');

                                     const path = document.createElementNS(svgNS, "path");
                                     path.setAttribute("stroke-linecap", "round");
                                     path.setAttribute("stroke-linejoin", "round");
                                     path.setAttribute("d", "M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z");
                                     svg.appendChild(path);
                                     parent.appendChild(svg);
                                }
                            }
                        }}
                    />;
        }
        return <DefaultProfileIcon style={{ width: '80px', height: '80px', color: '#A0AEC0' }} />;
    };


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

                {!isLoading && ( // Removed !error from condition to show form even if initial load fails
                    <form onSubmit={handleSaveChanges}>
                        <div style={formSectionStyle}>
                            <h3 style={sectionTitleStyle}>{t.personalInfoSectionTitle}</h3>
                            <div style={profilePicContainerStyle}>
                                <div style={imagePreviewContainerStyle}>
                                    {renderProfileImage()}
                                </div>
                                <div style={{position: 'relative'}}>
                                    <button type="button" style={changePhotoButtonStyling} onClick={() => setShowChangePhotoOptions(prev => !prev)}>
                                        <EditIcon style={{width: '0.9rem', height: '0.9rem'}}/> {t.editButton} {t.profilePictureLabel}
                                    </button>
                                    {showChangePhotoOptions && (
                                        <div style={photoOptionsPopupStyle}>
                                            <button type="button" style={photoOptionButtonStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = photoOptionButtonHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} onClick={() => galleryInputRef.current?.click()}>{t.uploadPhotoButton}</button>
                                            <button type="button" style={photoOptionButtonStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = photoOptionButtonHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} onClick={() => cameraInputRef.current?.click()}>{t.camera}</button>
                                            {(imagePreviewUrl || (profileData.profilePicUrl && profileData.profilePicUrl !== PLACEHOLDER_DRIVER_NEW_IMAGE)) &&
                                              <button type="button" style={{...photoOptionButtonStyle, color: '#E53E3E'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = photoOptionButtonHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} onClick={handleRemovePhoto}>{t.cancelButton}</button>
                                            }
                                        </div>
                                    )}
                                </div>
                                <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleFileSelect} style={{display: 'none'}} />
                                <input type="file" accept="image/*" capture="user" ref={cameraInputRef} onChange={handleFileSelect} style={{display: 'none'}} />
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

                        <div style={formSectionStyle}>
                            <h3 style={sectionTitleStyle}>{t.notificationSoundSettingsTitle}</h3>
                            <div style={inputGroupStyle}>
                                <label htmlFor="alertSoundPreferenceSelect" style={labelStyle}>{t.selectAlertSoundLabel}</label>
                                <select 
                                    id="alertSoundPreferenceSelect" 
                                    name="alertSoundPreference" 
                                    style={selectStyle} 
                                    value={currentSelectedSoundValue}
                                    onChange={(e) => {
                                        const selectedValue = e.target.value;
                                        if (selectedValue === 'custom') {
                                            customSoundInputRef.current?.click();
                                        } else {
                                            handleInputChange({ target: { name: 'alertSoundPreference', value: selectedValue } } as React.ChangeEvent<HTMLSelectElement>);
                                        }
                                    }}
                                >
                                    {predefinedSounds.map(sound => (
                                        <option key={sound.id} value={sound.fileName}>{t[sound.nameKey]}</option>
                                    ))}
                                    <option value="custom">{t.uploadCustomSoundLabel}</option>
                                </select>
                                <input 
                                    type="file" 
                                    id="customSoundFileInput" 
                                    name="customSoundFile" 
                                    accept="audio/*"
                                    style={{display: 'none'}}
                                    ref={customSoundInputRef}
                                    onChange={handleCustomSoundFileChange} 
                                />
                                {selectedCustomSoundFile && (
                                    <p style={customSoundFilenameStyle}>{t.customSoundFileLabel.replace('{filename}', selectedCustomSoundFile.name)}</p>
                                )}
                                {!selectedCustomSoundFile && profileData.alertSoundPreference?.startsWith('custom:') && (
                                    <p style={customSoundFilenameStyle}>{t.customSoundFileLabel.replace('{filename}', profileData.alertSoundPreference.substring(7))}</p>
                                )}
                            </div>
                        </div>

                        <div style={actionsContainerStyle}>
                            <button type="button" style={cancelButtonModalStyle} onClick={onClose}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = cancelButtonModalHoverStyle.backgroundColor!}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = cancelButtonModalStyle.backgroundColor!}
                            >
                                {t.closeButton}
                            </button>
                            <button type="submit" style={{...saveButtonStyle, ...(!hasChanges || isLoading ? saveButtonDisabledStyle : {})}} disabled={!hasChanges || isLoading}
                              onMouseEnter={(e) => { if (hasChanges && !isLoading) e.currentTarget.style.backgroundColor = saveButtonHoverStyle.backgroundColor!}}
                              onMouseLeave={(e) => { if (hasChanges && !isLoading) e.currentTarget.style.backgroundColor = saveButtonStyle.backgroundColor!}}
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
