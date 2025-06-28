import { useState, useCallback, useEffect } from 'react';
import { translations, Language } from '../translations';
import { Screen, UserRole } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { userService } from '../services/userService';

type ShowToastFunction = (message: string, type: 'error' | 'success' | 'info') => void;

export const useAuth = (currentLang: Language, setCurrentScreen: (screen: Screen) => void, showToast: ShowToastFunction) => {
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('passenger');
  const [pinMode, setPinMode] = useState<'create' | 'enter'>('create');
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
      const storedUserId = localStorage.getItem('loggedInUserId');
      if (storedUserId) {
        try {
          const sessionData = await userService.fetchUserSessionData(storedUserId);
          if (sessionData) {
            setLoggedInUserId(sessionData.userId);
            setLoggedInUserFullName(sessionData.fullName);
            setUserRole(sessionData.role);
            setUserPhoneNumber(sessionData.phoneNumber || ''); // Populate phone number
            setIsUserVerified(sessionData.isVerified);

            if (!sessionData.isVerified) {
                setCurrentScreen('pendingApproval');
            } else {
                setCurrentScreen(sessionData.role === 'driver' ? 'driverDashboard' : 'map');
            }
          } else {
            // User ID was in storage, but user doesn't exist in DB. Clean up.
            localStorage.removeItem('loggedInUserId');
          }
        } catch (error) {
          console.error("Failed to restore session:", getDebugMessage(error));
          localStorage.removeItem('loggedInUserId'); // Clear invalid session
        }
      }
      setIsInitializing(false);
    };

    checkUserSession();
    // Intentionally run only once on mount. `setCurrentScreen` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setPinMode('enter');
        } else {
          setPinMode('create');
        }
        setCurrentScreen('pin');
    } catch (error) {
        console.error("useAuth: Phone submission / User check error -", getDebugMessage(error), error);
        showToast(t.userCreationError, 'error');
    }
  }, [setCurrentScreen, t, showToast]);

  const handlePinConfirmed = useCallback(async (pin: string) => {
    console.log(`PIN confirmed for ${userPhoneNumber}`);
    
    try {
      let userData;

      if (pinMode === 'create') {
        const defaultFullName = userRole === 'passenger' ?
          t.defaultPassengerName :
          (currentLang === 'fa' ? 'راننده' : currentLang === 'ps' ? 'چلوونکی' : 'Driver');

        // FIX: The `userService.createUser` function returns the user object directly, not an object with {data, error}.
        // The previous destructuring `const { data, error } = ...` was incorrect and caused this bug.
        const createdUserData = await userService.createUser({
          phoneNumber: userPhoneNumber,
          role: userRole,
          fullName: defaultFullName,
          currentLang: currentLang,
          pin: pin,
        });

        if (createdUserData) {
          userData = createdUserData;
          console.log("New user created:", userData);
          if (userRole === 'driver') {
            await userService.createDriverProfileEntry(createdUserData.id);
          }
        } else {
          // This path indicates the service returned null, which could be an RLS issue.
          // For now, we'll treat it as a failure to prevent inconsistent states.
          throw new Error("New user creation did not return data.");
        }
      } else { // pinMode === 'enter'
        const existingUser = await userService.fetchUserByPhoneNumber(userPhoneNumber);
        
        let pinFromDb = '';
        if (existingUser && existingUser.profile_pic_url) {
            try {
                const parsed = JSON.parse(existingUser.profile_pic_url);
                if (parsed && parsed.pin) {
                    pinFromDb = parsed.pin;
                }
            } catch (e) {
                console.warn("Could not parse profile_pic_url as JSON for PIN check", e);
            }
        }

        if (existingUser && pinFromDb === pin) {
          userData = existingUser;
          console.log("Existing user logged in:", userData);
        } else {
          showToast(t.incorrectPinError, 'error');
          return;
        }
      }
      
      setLoggedInUserId(userData.id);
      setLoggedInUserFullName(userData.full_name);
      setUserRole(userData.role as UserRole);
      setIsUserVerified(userData.is_verified);
      localStorage.setItem('loggedInUserId', userData.id);

      if (!userData.is_verified) {
          setCurrentScreen('pendingApproval');
      } else if (userData.role === 'driver') {
          setCurrentScreen('driverDashboard');
      } else {
          setCurrentScreen('map');
      }

    } catch (error) {
      console.error("useAuth: PIN confirmation / User handling error -", getDebugMessage(error), error);
      showToast(t.userCreationError, 'error');
    }
  }, [userPhoneNumber, userRole, pinMode, currentLang, setCurrentScreen, t, showToast]);

  const handleLogoutFromDashboard = useCallback(() => {
    localStorage.removeItem('loggedInUserId'); // Clear from local storage
    setCurrentScreen('phoneInput');
    setUserPhoneNumber('');
    setUserRole('passenger'); // Reset role to passenger on logout
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
    pinMode, // Expose pinMode
    handlePhoneSubmitted,
    handlePinConfirmed, // Renamed function
    handleBackToPhoneInput,
    handleLogoutFromDashboard,
  };
};