import React, { useState, useEffect, useCallback, CSSProperties } from 'react';
import { supabase } from '../services/supabase';
import { translations, Language, TranslationSet } from '../translations';
import { AppService, AppServiceCategory, DbService } from '../types';
import { DefaultServiceIcon, RickshawIcon, TaxiIcon, MotorcycleRickshawIcon } from '../components/icons';
import { getDebugMessage } from '../utils/helpers'; // Import from helpers
import { Database } from '../types/supabase';

// Moved serviceImageMap here
const serviceImageMap: Record<string, React.FC<{ style?: CSSProperties }>> = {
  'rickshaw': RickshawIcon,
  'car': TaxiIcon,
  'cargoRickshaw': MotorcycleRickshawIcon,
  // Add other mappings as needed
};

export const useAppServices = (currentLang: Language) => {
  const [appServiceCategories, setAppServiceCategories] = useState<AppServiceCategory[]>([]);
  const [allAppServices, setAllAppServices] = useState<AppService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(true);
  const [serviceFetchError, setServiceFetchError] = useState<string | null>(null);
  const t = translations[currentLang];

  const fetchAndProcessServices = useCallback(async () => {
    setIsLoadingServices(true);
    setServiceFetchError(null);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_key, description_key, image_identifier, price_per_km, category, min_fare, is_active')
        .eq('is_active', true);

      if (error) {
        console.error("useAppServices: Error fetching services -", getDebugMessage(error), error);
        setServiceFetchError(t.fetchingServicesError);
        return;
      }
      
      const dbServices: DbService[] = data || [];

      const categoryDetails: { [key: string]: { nameKey: keyof TranslationSet } } = {
        'passenger': { nameKey: 'serviceCategoryPassenger' },
        'cargo': { nameKey: 'serviceCategoryCargo' },
        'courier': { nameKey: 'serviceCategoryCourier' },
      };
      
      const tempAllServices: AppService[] = [];
      const categoriesMap: { [key: string]: AppService[] } = {};

      dbServices.forEach((dbService: DbService) => {
        const imageComponent = serviceImageMap[dbService.image_identifier] || DefaultServiceIcon;
        
        const nameKeyCandidate = dbService.name_key;
        const descKeyCandidate = dbService.description_key;

        let nameKey: keyof TranslationSet = 'defaultServiceName';
        if (Object.prototype.hasOwnProperty.call(t, nameKeyCandidate)) {
            nameKey = nameKeyCandidate as keyof TranslationSet;
        }

        let descKey: keyof TranslationSet = 'defaultServiceDesc';
        if (Object.prototype.hasOwnProperty.call(t, descKeyCandidate)) {
            descKey = descKeyCandidate as keyof TranslationSet;
        }
        
        let pricePerKm: number | undefined;
        // Business logic for fares is enforced here, ignoring DB values for price_per_km.
        switch (dbService.name_key) {
            case 'serviceNameRickshaw':
                pricePerKm = 15;
                break;
            case 'serviceNameCar':
                pricePerKm = 20;
                break;
            case 'serviceNameCargoRickshaw':
                pricePerKm = 20;
                break;
            default:
                // This service type is not recognized for pricing. It will be filtered out.
                break;
        }
        
        // Enforce the minimum fare of 30 for all services, overriding any DB value.
        const MIN_FARE_OVERRIDE = 30;

        // Only process services that have a defined price from our business logic
        if (pricePerKm !== undefined) {
            const appService: AppService = {
              id: dbService.id,
              nameKey: nameKey,
              descKey: descKey,
              pricePerKm: pricePerKm,
              minFare: MIN_FARE_OVERRIDE,
              imageComponent: imageComponent,
              category: dbService.category,
            };
            
            tempAllServices.push(appService);

            if (!categoriesMap[dbService.category]) {
              categoriesMap[dbService.category] = [];
            }
            categoriesMap[dbService.category].push(appService);
        }
      });
      
      setAllAppServices(tempAllServices);

      const processedCategories = Object.keys(categoriesMap).map(categoryId => ({
        id: categoryId,
        nameKey: categoryDetails[categoryId]?.nameKey || (categoryId as keyof TranslationSet),
        services: categoriesMap[categoryId],
      })).filter(cat => cat.services.length > 0); 

      setAppServiceCategories(processedCategories);

    } catch (err) {
      console.error("useAppServices: Error processing services -", getDebugMessage(err), err);
      setServiceFetchError(t.fetchingServicesError);
    } finally {
      setIsLoadingServices(false);
    }
  }, [currentLang, t]);

  useEffect(() => {
    fetchAndProcessServices();
  }, [fetchAndProcessServices]);

  return {
    allAppServices,
    appServiceCategories,
    isLoadingServices,
    serviceFetchError,
    refetchServices: fetchAndProcessServices 
  };
};
