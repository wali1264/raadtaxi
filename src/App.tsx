import React, { useState, useEffect } from 'react';
// supabase client and DbService are used by hooks, not directly here.
import { translations, Language } from './translations';
import { Screen, UserRole, AppService, AppServiceCategory } from './types'; // Removed DbService
import { PhoneInputScreen } from './screens/PhoneInputScreen';
import { PinScreen } from './screens/OtpScreen'; // Renamed to PinScreen but keeping file path for now
import { MapScreen } from './screens/MapScreen';
import { DriverDashboardScreen } from './screens/DriverDashboardScreen';
import { PassengerProfileScreen } from './screens/PassengerProfileScreen'; // Import PassengerProfileScreen
import { PendingApprovalScreen } from './screens/PendingApprovalScreen'; // Import new screen
import { Toast } from './components/Toast'; // Import the new Toast component
import { AppContext, AppContextType } from './contexts/AppContext';
import { useAppServices } from './hooks/useAppServices';
import { useAuth } from './hooks/useAuth'; // Import useAuth if App.tsx becomes the main App again

// This App component might become redundant if index.tsx's App is the primary one.
// For now, making it consistent with the hook-based approach.

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('phoneInput');
  const [currentLang, setCurrentLang] = useState<Language>('fa');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const t = translations[currentLang];
  
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast(null); // Clear previous toast if any
    setTimeout(() => { // Set new toast after a short delay
        setToast({ message, type });
    }, 50);
  };

  const {
    isInitializing, // from useAuth
    userPhoneNumber, // from useAuth
    userRole,        // from useAuth
    loggedInUserId,  // from useAuth
    loggedInUserFullName, // from useAuth
    isUserVerified, // from useAuth
    pinMode: passwordMode, // from useAuth, renamed for clarity
    handlePhoneSubmitted, // from useAuth
    handlePinConfirmed: handlePasswordConfirmed,   // from useAuth, renamed for clarity
    handleBackToPhoneInput, // from useAuth
    handleLogoutFromDashboard // from useAuth
  } = useAuth(currentLang, setCurrentScreen, showToast);

  const { 
    allAppServices, 
    appServiceCategories, 
    isLoadingServices: isLoadingServicesGlobal, 
    serviceFetchError: serviceFetchErrorGlobal 
  } = useAppServices(currentLang);

  useEffect(() => {
    const savedLang = localStorage.getItem('appLang') as Language | null;
    if (savedLang && translations[savedLang]) {
      setCurrentLang(savedLang);
    }
    const htmlEl = document.documentElement;
    htmlEl.lang = savedLang === 'en' ? 'en' : (savedLang || 'fa');
    htmlEl.dir = savedLang === 'en' ? 'ltr' : 'rtl';
  }, []);

  const handleLangChange = (lang: Language) => {
    setCurrentLang(lang);
    localStorage.setItem('appLang', lang);
    const htmlEl = document.documentElement;
    htmlEl.lang = lang === 'en' ? 'en' : lang;
    htmlEl.dir = lang === 'en' ? 'ltr' : 'rtl';
  };
  
  useEffect(() => {
    if (currentScreen === 'map' || currentScreen === 'driverDashboard' || currentScreen === 'passengerProfile') {
        document.body.classList.add('no-padding');
    } else {
        document.body.classList.remove('no-padding');
    }
  }, [currentScreen]);

  if (isInitializing) {
    const loadingContainerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f0f2f5',
      color: '#4A5568',
      fontFamily: 'system-ui, sans-serif'
    };
    const spinnerStyle: React.CSSProperties = {
      border: '4px solid #E2E8F0',
      borderTop: '4px solid #4299E1',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      animation: 'spin 1s linear infinite',
      marginBottom: '1rem'
    };
    const keyframes = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    return (
      <>
        <style>{keyframes}</style>
        <div style={loadingContainerStyle}>
          <div style={spinnerStyle}></div>
          <p>Initializing Session...</p>
        </div>
      </>
    );
  }

  const appContextValue: AppContextType = {
    loggedInUserId,
    loggedInUserFullName,
    userRole,
    isUserVerified,
    currentLang,
    setCurrentLang: handleLangChange,
    t,
    allAppServices,
    appServiceCategories,
    isLoadingServicesGlobal,
    serviceFetchErrorGlobal,
    showToast,
  };

  const navigateToPassengerProfile = () => setCurrentScreen('passengerProfile');
  const navigateToMap = () => setCurrentScreen('map');

  let screenComponent;
  switch (currentScreen) {
    case 'phoneInput':
      screenComponent = <PhoneInputScreen currentLang={currentLang} onLangChange={handleLangChange} onNext={handlePhoneSubmitted} />;
      break;
    case 'pin':
      screenComponent = <PinScreen currentLang={currentLang} phoneNumber={userPhoneNumber} mode={passwordMode} onConfirm={handlePasswordConfirmed} onBack={handleBackToPhoneInput} />;
      break;
    case 'map':
      screenComponent = <MapScreen onNavigateToProfile={navigateToPassengerProfile} />; 
      break;
    case 'driverDashboard':
      screenComponent = <DriverDashboardScreen onLogout={handleLogoutFromDashboard} />;
      break;
    case 'passengerProfile':
      screenComponent = <PassengerProfileScreen onBackToMap={navigateToMap} onLogout={handleLogoutFromDashboard} />;
      break;
    case 'pendingApproval':
      screenComponent = <PendingApprovalScreen onLogout={handleLogoutFromDashboard} />;
      break;
    default:
      screenComponent = <PhoneInputScreen currentLang={currentLang} onLangChange={handleLangChange} onNext={handlePhoneSubmitted} />;
      break;
  }

  return (
    <AppContext.Provider value={appContextValue}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {screenComponent}
    </AppContext.Provider>
  );
};

export default App;
