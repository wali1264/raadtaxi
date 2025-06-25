
import React, { createContext, useContext } from 'react';
import { Language, UserRole, AppService, AppServiceCategory } from '../types'; // Adjusted to use types from src/types
import { translations } from '../translations'; // Corrected import path for translations

export interface AppContextType {
  loggedInUserId: string | null;
  loggedInUserFullName: string | null;
  userRole: UserRole;
  currentLang: Language;
  setCurrentLang: (lang: Language) => void;
  t: typeof translations.fa; // Base translation type
  allAppServices: AppService[];
  appServiceCategories: AppServiceCategory[];
  isLoadingServicesGlobal: boolean;
  serviceFetchErrorGlobal: string | null;
}

// Create a context with a default value (can be undefined or a sensible default)
// The default value here is mostly for type inference and not practically used if Provider always supplies a value.
export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider. Make sure your component is a child of AppContext.Provider.');
  }
  return context;
};
