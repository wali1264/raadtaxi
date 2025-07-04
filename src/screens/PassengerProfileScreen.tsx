import React, { useState, useEffect, CSSProperties, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { PassengerProfileData } from '../types';
import { userService } from '../services/userService';
import { BackArrowIcon, UserCircleIcon, EditIcon, CloseIcon } from '../components/icons';
import { getDebugMessage } from '../utils/helpers';


interface PassengerProfileScreenProps {
  onBackToMap: () => void;
  onLogout: () => void;
}

export const PassengerProfileScreen: React.FC<PassengerProfileScreenProps> = ({ onBackToMap, onLogout }) => {
  const { currentLang, loggedInUserId, loggedInUserFullName, t } = useAppContext();
  const isRTL = currentLang !== 'en';

  const [profileData, setProfileData] = useState<Partial<PassengerProfileData>>({
    fullName: loggedInUserFullName || '',
    phoneNumber: '',
    profilePicUrl: '',
  });
  const [initialProfileData, setInitialProfileData] = useState<Partial<PassengerProfileData>>({});
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showChangePhotoOptions, setShowChangePhotoOptions] = useState(false);
  const [isLogoutHovered, setIsLogoutHovered] = React.useState(false);


  useEffect(() => {
    if (loggedInUserId) {
      const fetchProfile = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        setSelectedImageFile(null);
        setImagePreviewUrl(null);
        try {
          const fetchedData = await userService.fetchUserDetailsById(loggedInUserId);
          if (fetchedData) {
            const data = {
                userId: fetchedData.id,
                fullName: fetchedData.fullName || '',
                phoneNumber: fetchedData.phoneNumber || '',
                profilePicUrl: fetchedData.profilePicUrl || '',
            };
            setProfileData(data);
            setInitialProfileData(data);
            if (data.profilePicUrl) {
              setImagePreviewUrl(data.profilePicUrl);
            }
          } else {
            setError(t.errorLoadingProfileData);
          }
        } catch (err: any) {
          console.error("PassengerProfileScreen: Error fetching profile data -", getDebugMessage(err), err);
          setError(t.errorLoadingProfileData);
        } finally {
          setIsLoading(false);
        }
      };
      fetchProfile();
    }
  }, [loggedInUserId, t.errorLoadingProfileData]);

  useEffect(() => {
    const currentFullName = profileData.fullName?.trim() || "";
    const initialFullName = initialProfileData.fullName?.trim() || "";
    const photoRemoved = initialProfileData.profilePicUrl && !profileData.profilePicUrl;

    if (currentFullName !== initialFullName || selectedImageFile !== null || photoRemoved) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [profileData, selectedImageFile, initialProfileData]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
      setProfileData(prev => ({ ...prev, profilePicUrl: previewUrl }));
      setSuccessMessage(null);
      setError(null);
      setShowChangePhotoOptions(false);
    }
    if(event.target) event.target.value = '';
  };

  const handleRemovePhoto = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setProfileData(prev => ({ ...prev, profilePicUrl: '' })); // Mark for removal
    setSuccessMessage(null);
    setError(null);
    setShowChangePhotoOptions(false);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInUserId || !hasChanges) {
        if (!hasChanges) setSuccessMessage(t.profileUpdatedSuccessfully);
        return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
        const dataToUpdate: { full_name?: string; profile_pic_url?: string } = {};
        let newUrl: string | undefined = undefined;

        if (selectedImageFile) {
            if (initialProfileData.profilePicUrl) {
                await userService.deleteProfilePicture(initialProfileData.profilePicUrl);
            }
            newUrl = await userService.uploadProfilePicture(loggedInUserId, selectedImageFile);
        } else if (initialProfileData.profilePicUrl && !profileData.profilePicUrl) {
            await userService.deleteProfilePicture(initialProfileData.profilePicUrl);
            newUrl = '';
        }

        if ((profileData.fullName || '') !== (initialProfileData.fullName || '')) {
            dataToUpdate.full_name = profileData.fullName?.trim();
        }

        if (newUrl !== undefined) {
            dataToUpdate.profile_pic_url = newUrl;
        }

        if (Object.keys(dataToUpdate).length > 0) {
            const updatedUser = await userService.updateUser(loggedInUserId, dataToUpdate);
            
            const newProfileState = {
                userId: loggedInUserId,
                fullName: updatedUser.full_name || '',
                phoneNumber: profileData.phoneNumber,
                profilePicUrl: updatedUser.profile_pic_url || '',
            };

            setInitialProfileData(newProfileState);
            setProfileData(newProfileState);
            setImagePreviewUrl(newProfileState.profilePicUrl || null);
        }
        
        setSuccessMessage(t.profileUpdatedSuccessfully);
        setSelectedImageFile(null);
        setHasChanges(false);

    } catch (err: any) {
        console.error("PassengerProfileScreen: Error saving profile data -", getDebugMessage(err), err);
        setError(t.errorUpdatingProfile + (err.message ? `: ${getDebugMessage(err)}` : ''));
    } finally {
        setIsLoading(false);
    }
  };

  const pageContainerStyle: CSSProperties = {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
    direction: isRTL ? 'rtl' : 'ltr',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  };

  const backButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#333',
    fontSize: '1.2rem',
    padding: '0.5rem',
    [isRTL ? 'marginLeft' : 'marginRight']: '1rem',
  };

  const titleStyle: CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#333',
    margin: 0,
  };

  const contentStyle: CSSProperties = {
    flexGrow: 1,
    overflowY: 'auto',
    padding: '1.5rem',
  };

  const formSectionStyle: CSSProperties = {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    marginBottom: '1.5rem',
  };
  
  const inputGroupStyle: CSSProperties = { marginBottom: '1.25rem' };
  const labelStyle: CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: '#2D3748' };
  const inputStyle: CSSProperties = { width: '100%', padding: '0.875rem', border: '1px solid #CBD5E0', borderRadius: '0.375rem', fontSize: '1rem', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s' };
  const readOnlyInputStyle: CSSProperties = { ...inputStyle, backgroundColor: '#F7FAFC', color: '#718096', cursor: 'not-allowed' };

  const profilePicSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem', };
  const imagePreviewContainerStyle: CSSProperties = { width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '1rem', border: '3px solid white', boxShadow: '0 0 10px rgba(0,0,0,0.1)' };
  const profileImagePreviewStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
  const changePhotoButtonStyling: CSSProperties = {
    backgroundColor: '#EDF2F7', color: '#4A5568', border: 'none', borderRadius: '0.375rem',
    padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
  };
  const photoOptionsPopupStyle: CSSProperties = {
    position: 'absolute', backgroundColor: 'white', borderRadius: '0.375rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 20, marginTop: '0.5rem',
    border: '1px solid #E2E8F0', width: '180px'
  };
  const photoOptionButtonStyle: CSSProperties = {
    display: 'block', width: '100%', padding: '0.75rem 1rem', textAlign: isRTL ? 'right' : 'left',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem',
  };
   const photoOptionButtonHoverStyle: CSSProperties = { backgroundColor: '#F7FAFC' };


  const placeholderSectionStyle: CSSProperties = { ...formSectionStyle, opacity: 0.6 };
  const placeholderItemStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.95rem', color: '#555', };
  const placeholderLinkStyle: CSSProperties = { color: '#007bff', textDecoration: 'none', fontSize: '0.9rem', };

  const saveButtonContainerStyle: CSSProperties = { padding: '1rem 0 0 0', backgroundColor: 'transparent', marginTop: '1rem' };
  const saveButtonStyle: CSSProperties = { width: '100%', padding: '0.875rem', backgroundColor: '#3182CE', color: 'white', border: 'none', borderRadius: '0.375rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s, opacity 0.2s' };
  const saveButtonDisabledStyle: CSSProperties = { backgroundColor: '#A0AEC0', opacity:0.7, cursor: 'not-allowed' };

  const messageStyle: CSSProperties = { textAlign: 'center', padding: '0.75rem', borderRadius: '0.375rem', margin: '0 0 1rem 0', fontSize: '0.9rem'};
  const successMessageStyle: CSSProperties = {...messageStyle, backgroundColor: '#C6F6D5', color: '#2F855A'};
  const errorMessageStyle: CSSProperties = {...messageStyle, backgroundColor: '#FED7D7', color: '#C53030'};
  
  const logoutSectionStyle: CSSProperties = {
    marginTop: '2rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #e5e7eb',
  };

  const logoutButtonStyle: CSSProperties = {
    width: '100%',
    padding: '0.875rem',
    backgroundColor: '#EF4444', // Red color for logout
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };
  
  const logoutButtonHoverStyle: CSSProperties = {
    backgroundColor: '#DC2626',
  };

  const renderImage = () => {
    if (imagePreviewUrl) {
        return <img src={imagePreviewUrl} alt={t.profilePictureLabel} style={profileImagePreviewStyle} onError={() => setImagePreviewUrl(null)} />;
    }
    return <UserCircleIcon style={{ width: '80px', height: '80px', color: '#A0AEC0' }} />;
  };


  if (isLoading && !profileData.phoneNumber && !initialProfileData.phoneNumber) {
    return <div style={pageContainerStyle}><div style={{textAlign: 'center', margin: 'auto'}}>{t.loadingProfileData}</div></div>;
  }

  return (
    <div style={pageContainerStyle}>
      <header style={headerStyle}>
        <button style={backButtonStyle} onClick={onBackToMap} aria-label={t.backButtonAriaLabel}>
          <BackArrowIcon style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
        </button>
        <h1 style={titleStyle}>{t.passengerProfileScreenTitle}</h1>
      </header>

      <div style={contentStyle}>
        {error && <p style={errorMessageStyle}>{error}</p>}
        {successMessage && <p style={successMessageStyle}>{successMessage}</p>}
        
        <form onSubmit={handleSaveChanges}>
            <div style={formSectionStyle}>
                <div style={profilePicSectionStyle}>
                    <div style={imagePreviewContainerStyle}>
                        {renderImage()}
                    </div>
                    <div style={{position: 'relative'}}>
                        <button type="button" style={changePhotoButtonStyling} onClick={() => setShowChangePhotoOptions(prev => !prev)}>
                            <EditIcon style={{width: '0.9rem', height: '0.9rem'}}/> {t.editButton} {t.profilePictureLabel}
                        </button>
                        {showChangePhotoOptions && (
                            <div style={photoOptionsPopupStyle}>
                                <button type="button" style={photoOptionButtonStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = photoOptionButtonHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} onClick={() => galleryInputRef.current?.click()}>{t.uploadPhotoButton}</button>
                                <button type="button" style={photoOptionButtonStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = photoOptionButtonHoverStyle.backgroundColor!} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''} onClick={() => cameraInputRef.current?.click()}>{t.camera}</button>
                                {imagePreviewUrl &&
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
                    <input type="tel" id="phoneNumber" name="phoneNumber" style={readOnlyInputStyle} value={profileData.phoneNumber || ''} readOnly />
                </div>
            </div>
            
            <div style={placeholderSectionStyle}>
                <h2 style={{...labelStyle, borderBottom: '1px solid #E2E8F0', paddingBottom:'0.5rem', marginBottom: '1rem'}}>{t.activitySectionTitle}</h2>
                <div style={placeholderItemStyle}>
                    <span>{t.rideHistoryLabel}</span>
                    <span style={placeholderLinkStyle} aria-disabled="true">{t.viewLinkPlaceholder}</span>
                </div>
                <div style={{...placeholderItemStyle, borderBottom: 'none'}}>
                    <span>{t.favoriteLocationsLabel}</span>
                    <span style={placeholderLinkStyle} aria-disabled="true">{t.manageLinkPlaceholder}</span>
                </div>
            </div>
             <div style={placeholderSectionStyle}>
                <h2 style={{...labelStyle, borderBottom: '1px solid #E2E8F0', paddingBottom:'0.5rem', marginBottom: '1rem'}}>{t.feedbackSettingsSectionTitle}</h2>
                 <div style={placeholderItemStyle}>
                    <span>{t.ratingsFeedbackLabel}</span>
                    <span style={placeholderLinkStyle} aria-disabled="true">{t.viewLinkPlaceholder}</span>
                </div>
                <div style={{...placeholderItemStyle, borderBottom: 'none'}}>
                    <span>{t.notificationSettingsLabel}</span>
                    <span style={placeholderLinkStyle} aria-disabled="true">{t.manageLinkPlaceholder}</span>
                </div>
            </div>

            <div style={saveButtonContainerStyle}>
                 <button type="submit" style={{...saveButtonStyle, ...(!hasChanges || isLoading ? saveButtonDisabledStyle : {})}} disabled={!hasChanges || isLoading}>
                    {isLoading ? t.servicesLoading : t.saveChangesButton}
                 </button>
            </div>
        </form>
        <div style={logoutSectionStyle}>
           <button 
             style={isLogoutHovered ? { ...logoutButtonStyle, ...logoutButtonHoverStyle } : logoutButtonStyle} 
             onClick={onLogout}
             onMouseEnter={() => setIsLogoutHovered(true)}
             onMouseLeave={() => setIsLogoutHovered(false)}
           >
             {t.logoutButton}
           </button>
        </div>
      </div>
    </div>
  );
};
