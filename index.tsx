
import React, { useState, useEffect, useRef, CSSProperties, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
// ReactDOMServer, L, Supabase imports not directly used in App component anymore
// but kept if other parts of this file (outside App) might use them.
// For a cleaner App component, these could be moved if only specific screens use them.
import { translations, Language } from './src/translations';
import { Screen, UserRole, AppService, AppServiceCategory } from './src/types'; // DbService removed, handled by useAppServices

// Supabase client is used by hooks now
// import { APP_USER_AGENT } from './src/config'; // Not used directly in App
import { getDebugMessage } from './src/utils/helpers'; // Import from helpers

// Icons are mostly used by specific screens/components, not directly in App's core logic
// For cleaner App, direct icon imports can be removed if not used by App's direct rendering.
// Keeping them for now as the file structure is monolithic.

import { PhoneInputScreen } from './src/screens/PhoneInputScreen';
import { OtpScreen } from './src/screens/OtpScreen';
import { MapScreen } from './src/screens/MapScreen';
import { DriverDashboardScreen } from './src/screens/DriverDashboardScreen';
import { PassengerProfileScreen } from './src/screens/PassengerProfileScreen'; // Import PassengerProfileScreen

import { AppContext, AppContextType } from './src/contexts/AppContext';
import { useAppServices } from './src/hooks/useAppServices'; // Import the service hook
import { useAuth } from './src/hooks/useAuth'; // Import the auth hook

// serviceImageMap moved to useAppServices.ts
// getDebugMessage moved to src/utils/helpers.ts

// --- Main App Component ---
const App = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('phoneInput');
  const [currentLang, setCurrentLang] = useState<Language>('fa');
  const t = translations[currentLang];

  // Auth state and handlers from useAuth hook
  const {
    userPhoneNumber,
    userRole,
    loggedInUserId,
    loggedInUserFullName,
    handlePhoneSubmitted,
    handleOtpConfirmed,
    handleResendOtp,
    handleBackToPhoneInput,
    handleLogoutFromDashboard,
  } = useAuth(currentLang, setCurrentScreen);

  // Service data from useAppServices hook
  const {
    allAppServices,
    appServiceCategories,
    isLoadingServices: isLoadingServicesGlobal,
    serviceFetchError: serviceFetchErrorGlobal,
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
  
  const globalStyles = `
    body { 
      margin: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; 
      -webkit-font-smoothing: antialiased; 
      -moz-osx-font-smoothing: grayscale; 
      background-color: #f0f2f5; 
      box-sizing: border-box;
    }
    #root { 
      width: 100%; 
      height: 100vh; 
      overflow: hidden; 
    }
    body.no-padding {
        padding: 0 !important;
    }
    body:not(.no-padding) {
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh;
        padding: 1rem; 
    }
    
    .terms-link { color: #10B981; text-decoration: none; } .terms-link:hover { text-decoration: underline; }
    @media (max-width: 600px) { 
      body:not(.no-padding) { padding: 0 !important; } 
      #root { max-width: 100vw; max-height: 100vh; }
    }
    .leaflet-control-zoom { display: none !important; }
  `;
  useEffect(() => { 
    const styleTag = document.getElementById('global-app-styles'); 
    if (styleTag) styleTag.innerHTML = globalStyles; 

    if (currentScreen === 'map' || currentScreen === 'driverDashboard' || currentScreen === 'passengerProfile') {
        document.body.classList.add('no-padding');
    } else {
        document.body.classList.remove('no-padding');
    }
  }, [globalStyles, currentScreen]);
  
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

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      {/* <style id="global-app-styles"></style> Style tag injected from index.html or App component */}
      <App />
    </React.StrictMode>
  );
}