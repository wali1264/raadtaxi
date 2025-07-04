
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { translations, Language } from '../translations';
import { Screen, UserRole } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { userService } from '../services/userService';

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const sessionData = await userService.fetchUserSessionData(session.user.id);
          if (sessionData) {
            setLoggedInUserId(sessionData.userId);
            setLoggedInUserFullName(sessionData.fullName);
            setUserRole(sessionData.role);
            setUserPhoneNumber(sessionData.phoneNumber || '');
            setIsUserVerified(sessionData.isVerified);

            // Per user request, even unverified users should be sent to pending screen
            // and not blocked here, so this check is correct.
            if (!sessionData.isVerified) {
                setCurrentScreen('pendingApproval');
            } else {
                setCurrentScreen(sessionData.role === 'driver' ? 'driverDashboard' : 'map');
            }
          }
        } catch (error) {
          console.error("Failed to restore session:", getDebugMessage(error));
          await supabase.auth.signOut(); // Clear invalid session
        }
      }
      setIsInitializing(false);
    };

    checkUserSession();
    // Intentionally run only once on mount. `setCurrentScreen` is stable.
  }, []);


  const handlePhoneSubmitted = useCallback(async (phoneNumber: string, role: UserRole) => {
    setUserPhoneNumber(phoneNumber);
    setUserRole(role);
    
    try {
        const existingUser = await userService.fetchUserByPhoneNumber(phoneNumber);

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
    const fakeEmail = `${userPhoneNumber}@example.com`;

    try {
      let authUserId: string;
      let userPublicData;

      if (passwordMode === 'create') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: fakeEmail,
          password: password,
        });

        if (signUpError) {
            // Re-check for existing user to handle race conditions or outdated checks
            if (signUpError.message.includes("User already registered")) {
                showToast(signUpError.message, 'error');
                setPasswordMode('enter'); // Switch to enter mode
                setCurrentScreen('pin'); // Re-render pin screen in enter mode
                return;
            }
            throw signUpError;
        }
        if (!signUpData.user) throw new Error("Supabase signup did not return a user.");
        authUserId = signUpData.user.id;

        const defaultFullName = userRole === 'passenger' ?
          t.defaultPassengerName :
          (currentLang === 'fa' ? 'راننده' : currentLang === 'ps' ? 'چلوونکی' : 'Driver');
        
        userPublicData = await userService.createUserInPublicTable({
          userId: authUserId,
          phoneNumber: userPhoneNumber,
          role: userRole,
          fullName: defaultFullName,
          currentLang: currentLang,
        });

        if (userRole === 'driver') {
            await userService.createDriverProfileEntry(authUserId);
        }

      } else { // passwordMode === 'enter'
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: password,
        });
        if (signInError) {
             if (signInError.message.includes("Invalid login credentials")) {
                showToast(t.incorrectPinError, 'error');
             } else {
                throw signInError;
             }
             return;
        }
        if (!signInData.user) throw new Error("Supabase signin did not return a user.");
        authUserId = signInData.user.id;

        // Fetch fresh user data now that we are authenticated
        userPublicData = await userService.fetchUserSessionData(authUserId);
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
      showToast(t.userCreationError, 'error');
    }
  }, [userPhoneNumber, userRole, passwordMode, currentLang, setCurrentScreen, t, showToast]);

  const handleLogoutFromDashboard = useCallback(async () => {
    await supabase.auth.signOut();
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
    pinMode: passwordMode, // Keep prop name as 'pinMode' for App.tsx compatibility
    handlePhoneSubmitted,
    handlePinConfirmed: handlePasswordConfirmed,
    handleBackToPhoneInput,
    handleLogoutFromDashboard,
  };
};