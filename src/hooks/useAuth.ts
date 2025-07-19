
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { translations, Language } from '../translations';
import { Screen, UserRole, UserSessionData } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { authService, profileService } from '../services';

type ShowToastFunction = (message: string, type: 'error' | 'success' | 'info') => void;

export const useAuth = (currentLang: Language, setCurrentScreen: (screen: Screen) => void, showToast: ShowToastFunction) => {
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('passenger');
  const [passwordMode, setPasswordMode] = useState<'create' | 'enter'>('create');
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [loggedInUserFullName, setLoggedInUserFullName] = useState<string | null>(null);
  const [isUserVerified, setIsUserVerified] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true); // For session check
  const t = translations[currentLang];

  const handleBackToPhoneInput = useCallback(() => {
    setCurrentScreen('phoneInput');
    setUserPhoneNumber('');
    setLoggedInUserId(null);
    setLoggedInUserFullName(null);
    setIsUserVerified(false);
  }, [setCurrentScreen]);


  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { session } } = await authService.getSession();
      if (session) {
        try {
          const sessionData = await profileService.fetchUserSessionData(session.user.id);
          if (sessionData) {
            setLoggedInUserId(sessionData.userId);
            setLoggedInUserFullName(sessionData.fullName);
            setUserRole(sessionData.role);
            setUserPhoneNumber(sessionData.phoneNumber || '');
            setIsUserVerified(sessionData.isVerified);

            if (!sessionData.isVerified) {
                setCurrentScreen('pendingApproval');
            } else {
                setCurrentScreen(sessionData.role === 'driver' ? 'driverDashboard' : 'map');
            }
          }
        } catch (error) {
          console.error("Failed to restore session:", getDebugMessage(error));
          await authService.signOut(); // Clear invalid session
        }
      }
      setIsInitializing(false);
    };

    checkUserSession();
  }, []);


  const handlePhoneSubmitted = useCallback(async (phoneNumber: string, role: UserRole) => {
    setUserPhoneNumber(phoneNumber);
    setUserRole(role);
    
    try {
        const existingUser = await authService.fetchUserByPhoneNumber(phoneNumber);

        if (existingUser) {
          if (existingUser.role !== role) {
            const errorMessage = role === 'passenger' 
              ? t.phoneRegisteredAsDriverError 
              : t.phoneRegisteredAsPassengerError;
            showToast(errorMessage, 'error');
            return; 
          }
          setPasswordMode('enter');
        } else {
          setPasswordMode('create');
        }
        setCurrentScreen('pin');
    } catch (error) {
        console.error("useAuth: Phone submission / User check error -", getDebugMessage(error), error);
        showToast(t.userCreationError, 'error');
    }
  }, [setCurrentScreen, t, showToast]);

  const handlePasswordConfirmed = useCallback(async (password: string) => {
    const fakeEmail = `phone-${userPhoneNumber}@example.com`;

    try {
        let authResult: { user: any; session: any; } | null;
        let userPublicData: UserSessionData | null;

        if (passwordMode === 'create') {
            try {
                authResult = await authService.signUp(fakeEmail, password);
            } catch (signUpError: any) {
                if (signUpError.message && signUpError.message.includes("User already registered")) {
                    console.warn("User already existed in auth table during sign-up. Attempting sign-in instead.");
                    authResult = await authService.signIn(fakeEmail, password);
                } else {
                    throw signUpError; // Re-throw other errors
                }
            }

            if (!authResult || !authResult.user) throw new Error("Authentication failed: No user returned.");
            const authUserId = authResult.user.id;
            
            const existingPublicProfile = await profileService.fetchUserSessionData(authUserId);

            if (existingPublicProfile) {
                userPublicData = existingPublicProfile;
                if (userPublicData.role !== userRole) {
                    const recoveredRole = userPublicData.role as UserRole;
                    const message = `Signed in as existing ${recoveredRole}.`;
                    console.warn(`User role mismatch during recovery. Selected: ${userRole}, Existing: ${recoveredRole}. Using existing role.`);
                    showToast(message, 'info');
                    setUserRole(recoveredRole);
                }
            } else {
                const defaultFullName = userRole === 'passenger' ? t.defaultPassengerName : (currentLang === 'fa' ? 'راننده' : currentLang === 'ps' ? 'چلوونکی' : 'Driver');
                userPublicData = await profileService.createUserInPublicTable({ userId: authUserId, phoneNumber: userPhoneNumber, role: userRole, fullName: defaultFullName, currentLang: currentLang });
                if (userRole === 'driver') {
                    await profileService.createDriverProfileEntry(authUserId);
                }
            }

        } else { // passwordMode === 'enter'
            authResult = await authService.signIn(fakeEmail, password);
            if (!authResult || !authResult.user) throw new Error("Supabase signin did not return a user.");
            const authUserId = authResult.user.id;
            
            userPublicData = await profileService.fetchUserSessionData(authUserId);
            if (!userPublicData) {
                throw new Error("Could not fetch user data after sign-in.");
            }
        }
        
        if (!userPublicData) {
            throw new Error("Failed to retrieve or create user profile in public table.");
        }

        setLoggedInUserId(userPublicData.userId);
        setLoggedInUserFullName(userPublicData.fullName);
        setUserRole(userPublicData.role as UserRole);
        setIsUserVerified(userPublicData.isVerified);
        
        if (!userPublicData.isVerified) {
            setCurrentScreen('pendingApproval');
        } else if (userPublicData.role === 'driver') {
            setCurrentScreen('driverDashboard');
        } else {
            setCurrentScreen('map');
        }

    } catch (error: any) {
        console.error("useAuth: Password confirmation / User handling error -", getDebugMessage(error), error);
        if (error.message && error.message.includes("Invalid login credentials")) {
            showToast(t.incorrectPinError, 'error');
            return;
        }
        showToast(t.userCreationError, 'error');
    }
}, [userPhoneNumber, userRole, passwordMode, currentLang, setCurrentScreen, t, showToast]);


  const handleLogoutFromDashboard = useCallback(async () => {
    await authService.signOut();
    setCurrentScreen('phoneInput');
    setUserPhoneNumber('');
    setUserRole('passenger');
    setLoggedInUserId(null);
    setLoggedInUserFullName(null);
    setIsUserVerified(false);
  }, [setCurrentScreen]);

  return {
    isInitializing,
    userPhoneNumber,
    userRole,
    loggedInUserId,
    loggedInUserFullName,
    isUserVerified,
    pinMode: passwordMode,
    handlePhoneSubmitted,
    handlePinConfirmed: handlePasswordConfirmed,
    handleBackToPhoneInput,
    handleLogoutFromDashboard,
  };
};
