import { useState, useCallback } from 'react';
// supabase client removed, will use userService
import { translations, Language } from '../translations';
import { Screen, UserRole } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { userService } from '../services/userService'; // Import userService

export const useAuth = (currentLang: Language, setCurrentScreen: (screen: Screen) => void) => {
  const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('passenger');
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [loggedInUserFullName, setLoggedInUserFullName] = useState<string | null>(null);
  const t = translations[currentLang];

  const handlePhoneSubmitted = useCallback((phoneNumber: string, role: UserRole) => {
    setUserPhoneNumber(phoneNumber);
    setUserRole(role);
    setCurrentScreen('otp');
    console.log(`Phone: ${phoneNumber}, Role: ${role}, OTP would be sent (e.g., 123456)`);
  }, [setCurrentScreen]);

  const handleOtpConfirmed = useCallback(async (otp: string) => {
    console.log(`OTP ${otp} confirmed for ${userPhoneNumber}`);
    if (otp.length === 6) { // Basic OTP check, real check would be against a backend
      try {
        let existingUser = await userService.fetchUserByPhoneNumber(userPhoneNumber);

        if (existingUser) {
          if (existingUser.role !== userRole) {
            const updatedUser = await userService.updateUser(existingUser.id, { role: userRole });
            existingUser = { ...existingUser, ...updatedUser }; // Ensure existingUser has the latest info
          }
          setLoggedInUserId(existingUser.id);
          setLoggedInUserFullName(existingUser.full_name);
          setUserRole(existingUser.role as UserRole);
          console.log("Existing user found/updated:", existingUser);
        } else {
          const defaultFullName = userRole === 'passenger' ?
            t.defaultPassengerName :
            (currentLang === 'fa' ? 'راننده' : currentLang === 'ps' ? 'چلوونکی' : 'Driver');

          const newUser = await userService.createUser({
            phoneNumber: userPhoneNumber,
            role: userRole,
            fullName: defaultFullName,
            currentLang: currentLang,
          });

          if (newUser) {
            setLoggedInUserId(newUser.id);
            setLoggedInUserFullName(newUser.full_name);
            setUserRole(newUser.role as UserRole);
            console.log("New user created:", newUser);

            if (userRole === 'driver') {
              await userService.createDriverProfileEntry(newUser.id);
            }
          } else {
            // This case should ideally be handled by createUser throwing an error if it fails
            throw new Error("New user creation did not return data.");
          }
        }

        if (userRole === 'driver') {
          setCurrentScreen('driverDashboard');
        } else {
          setCurrentScreen('map');
        }

      } catch (error) {
        console.error("useAuth: OTP confirmation / User handling error -", getDebugMessage(error), error);
        alert(t.userCreationError);
      }
    } else {
      alert(t.invalidOtpError);
    }
  }, [userPhoneNumber, userRole, currentLang, setCurrentScreen, t]);

  const handleResendOtp = useCallback(() => {
    // Placeholder: In a real app, this would trigger an API call to resend OTP
    console.log(`Resending OTP to ${userPhoneNumber} (e.g., 123456)`);
    // Optionally, you might want to show a success message to the user.
  }, [userPhoneNumber]);

  const handleBackToPhoneInput = useCallback(() => {
    setCurrentScreen('phoneInput');
    setUserPhoneNumber('');
    // Optionally reset role if it shouldn't persist across phone input attempts
    // setUserRole('passenger'); 
    setLoggedInUserId(null);
    setLoggedInUserFullName(null);
  }, [setCurrentScreen]);

  const handleLogoutFromDashboard = useCallback(() => {
    setCurrentScreen('phoneInput');
    setUserPhoneNumber('');
    setUserRole('passenger'); // Reset role to passenger on logout
    setLoggedInUserId(null);
    setLoggedInUserFullName(null);
    // In a real app, you would also clear any session tokens or local storage here.
  }, [setCurrentScreen]);

  return {
    userPhoneNumber,
    userRole,
    loggedInUserId,
    loggedInUserFullName,
    handlePhoneSubmitted,
    handleOtpConfirmed,
    handleResendOtp,
    handleBackToPhoneInput,
    handleLogoutFromDashboard,
  };
};
