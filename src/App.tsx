
import React, { useState, useEffect } from 'react';
// supabase client and DbService are used by hooks, not directly here.
import { translations, Language } from './translations';
import { Screen, UserRole, AppService, AppServiceCategory } from './types'; // Removed DbService
import { PhoneInputScreen } from './screens/PhoneInputScreen';
import { OtpScreen } from './screens/OtpScreen';
import { MapScreen } from './screens/MapScreen';
import { DriverDashboardScreen } from './screens/DriverDashboardScreen';
import { PassengerProfileScreen } from './screens/PassengerProfileScreen'; // Import PassengerProfileScreen
import { AppContext, AppContextType } from './contexts/AppContext';
import { useAppServices } from './hooks/useAppServices';
import { useAuth } from './hooks/useAuth'; // Import useAuth if App.tsx becomes the main App again

// This App component might become redundant if index.tsx's App is the primary one.
// For now, making it consistent with the hook-based approach.

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('phoneInput');
  const [currentLang, setCurrentLang] = useState<Language>('fa');
  const t = translations[currentLang];

  const {
    userPhoneNumber, // from useAuth
    userRole,        // from useAuth
    loggedInUserId,  // from useAuth
    loggedInUserFullName, // from useAuth
    handlePhoneSubmitted, // from useAuth
    handleOtpConfirmed,   // from useAuth
    handleResendOtp,      // from useAuth
    handleBackToPhoneInput, // from useAuth
    handleLogoutFromDashboard // from useAuth
  } = useAuth(currentLang, setCurrentScreen);

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

  const appContextValue: AppContextType = {
    loggedInUserId,
    loggedInUserFullName,
    userRole,
    currentLang,
    setCurrentLang: handleLangChange,
    t,
    allAppServices,
    appServiceCategories,
    isLoadingServicesGlobal,
    serviceFetchErrorGlobal,
  };

  const navigateToPassengerProfile = () => setCurrentScreen('passengerProfile');
  const navigateToMap = () => setCurrentScreen('map');

  let screenComponent;
  switch (currentScreen) {
    case 'phoneInput':
      screenComponent = <PhoneInputScreen currentLang={currentLang} onLangChange={handleLangChange} onNext={handlePhoneSubmitted} />;
      break;
    case 'otp':
      screenComponent = <OtpScreen currentLang={currentLang} phoneNumber={userPhoneNumber} onConfirm={handleOtpConfirmed} onResendOtp={handleResendOtp} onBack={handleBackToPhoneInput} />;
      break;
    case 'map':
      screenComponent = <MapScreen onNavigateToProfile={navigateToPassengerProfile} />; 
      break;
    case 'driverDashboard':
      screenComponent = <DriverDashboardScreen onLogout={handleLogoutFromDashboard} />;
      break;
    case 'passengerProfile':
      screenComponent = <PassengerProfileScreen onBackToMap={navigateToMap} />;
      break;
    default:
      screenComponent = <PhoneInputScreen currentLang={currentLang} onLangChange={handleLangChange} onNext={handlePhoneSubmitted} />;
      break;
  }

  return (
    <AppContext.Provider value={appContextValue}>
      {screenComponent}
    </AppContext.Provider>
  );
};

export default App;