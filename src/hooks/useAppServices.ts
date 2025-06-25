
import React, { useState, useEffect, useCallback, CSSProperties } from 'react';
import { supabase } from '../services/supabase';
import { translations, Language } from '../translations';
import { AppService, AppServiceCategory, DbService } from '../types';
import { DefaultServiceIcon, RickshawIcon, TaxiIcon, MotorcycleRickshawIcon } from '../components/icons';
import { getDebugMessage } from '../utils/helpers'; // Import from helpers

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
      const { data: dbServices, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error("useAppServices: Error fetching services -", getDebugMessage(error), error);
        setServiceFetchError(t.fetchingServicesError);
        return;
      }

      const categoryDetails: { [key: string]: { nameKey: keyof typeof t } } = {
        'passenger': { nameKey: 'serviceCategoryPassenger' },
        'cargo': { nameKey: 'serviceCategoryCargo' },
        'courier': { nameKey: 'serviceCategoryCourier' },
      };
      
      const tempAllServices: AppService[] = [];
      const categoriesMap: { [key: string]: AppService[] } = {};

      (dbServices as DbService[]).forEach(dbService => {
        const imageComponent = serviceImageMap[dbService.image_identifier] || DefaultServiceIcon;
        const nameKey = dbService.name_key as keyof typeof t;
        const descKey = dbService.description_key as keyof typeof t;

        const appService: AppService = {
          id: dbService.id,
          nameKey: t[nameKey] ? nameKey : 'defaultServiceName' as keyof typeof t,
          descKey: t[descKey] ? descKey : 'defaultServiceDesc' as keyof typeof t,
          price: dbService.base_fare ?? undefined,
          pricePerKm: dbService.price_per_km ?? undefined,
          imageComponent: imageComponent,
          category: dbService.category,
        };
        tempAllServices.push(appService);

        if (!categoriesMap[dbService.category]) {
          categoriesMap[dbService.category] = [];
        }
        categoriesMap[dbService.category].push(appService);
      });
      
      setAllAppServices(tempAllServices);

      const processedCategories = Object.keys(categoriesMap).map(categoryId => ({
        id: categoryId,
        nameKey: categoryDetails[categoryId]?.nameKey || (categoryId as keyof typeof t),
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
