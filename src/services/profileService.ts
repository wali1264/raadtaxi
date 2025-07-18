
import { supabase } from './supabase';
import { UserRole, Language, DriverProfileData, PassengerDetails, UserSessionData, UserDefinedPlace } from '../types';
import { Database } from '../types/supabase';
import { getDebugMessage } from '../utils/helpers'; 

const DEFAULT_SOUND_KEY = 'default';
const DEFAULT_SOUND_VOLUME = 0.8;
const BUCKET_NAME = 'profile-pictures';

// These helpers are also in useUserDefinedPlaces.ts.
// In a larger refactor, they'd move to a shared file.
const parsePoint = (pointString: string): { lat: number; lng: number } | null => {
    if (!pointString || typeof pointString !== 'string') return null;
    const match = pointString.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    if (match && match[1] && match[2]) {
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        return { lat, lng };
    }
    return null;
};

interface RpcPlace {
  id: string;
  created_at: string;
  name: string;
  location_text: string;
  user_id: string;
}


export const profileService = {
  async createUserInPublicTable(details: { userId: string, phoneNumber: string, role: UserRole, fullName: string, currentLang: Language }) {
    const payload: Database['public']['Tables']['users']['Insert'] = {
        id: details.userId,
        phone_number: details.phoneNumber,
        role: details.role,
        full_name: details.fullName,
        current_language: details.currentLang,
        profile_pic_url: '', 
        is_verified: details.role === 'passenger', 
      };
    const { data, error } = await supabase
      .from('users')
      .insert([payload])
      .select('id, full_name, role, profile_pic_url, is_verified, phone_number') 
      .single();

    if (error) {
      console.error("ProfileService: Error creating user in public table -", getDebugMessage(error), error);
      throw error;
    }

    if (!data) {
        throw new Error("User creation did not return data.");
    }
    
    const typedData = data;
    return {
        userId: typedData.id,
        fullName: typedData.full_name,
        phoneNumber: typedData.phone_number,
        role: typedData.role as UserRole,
        isVerified: typedData.is_verified,
    };
  },

  async updateUser(userId: string, updates: { role?: UserRole, full_name?: string, profile_pic_url?: string | null }) {
    const updatePayload: Database['public']['Tables']['users']['Update'] = { ...updates, updated_at: new Date().toISOString() };
    
    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, full_name, role, profile_pic_url, is_verified') 
      .single();
    if (error) {
      console.error("ProfileService: Error updating user -", getDebugMessage(error), error);
      throw error;
    }
    return data;
  },
  
  async uploadProfilePicture(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (uploadError) {
      console.error("ProfileService: Error uploading profile picture -", getDebugMessage(uploadError), uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
      
    if (!data || !data.publicUrl) {
      throw new Error("Could not get public URL for uploaded file.");
    }

    return data.publicUrl;
  },

  async deleteProfilePicture(oldPicUrl: string): Promise<void> {
    if (!oldPicUrl || !oldPicUrl.includes(BUCKET_NAME)) {
      return; 
    }
    try {
      const url = new URL(oldPicUrl);
      const pathSegments = url.pathname.split('/');
      const bucketIndex = pathSegments.findIndex(segment => segment === BUCKET_NAME);
      if (bucketIndex > -1) {
        const filePath = pathSegments.slice(bucketIndex + 1).join('/');
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);
        if (deleteError) {
          console.warn("ProfileService: Could not delete old profile picture -", getDebugMessage(deleteError), deleteError);
        }
      }
    } catch (e) {
      console.error("ProfileService: Invalid URL provided for deletion -", getDebugMessage(e), e);
    }
  },

  async createDriverProfileEntry(userId: string) {
    const payload: Database['public']['Tables']['drivers_profile']['Insert'] = { user_id: userId, current_status: 'offline', alert_sound_preference: DEFAULT_SOUND_KEY, alert_sound_volume: DEFAULT_SOUND_VOLUME };
    const { error } = await supabase
      .from('drivers_profile')
      .insert([payload]); 
    if (error) {
      console.error("ProfileService: Error creating driver profile entry -", getDebugMessage(error), error);
      throw error;
    }
    return true;
  },

  async fetchDriverProfile(userId: string): Promise<Partial<DriverProfileData>> {
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, phone_number, profile_pic_url')
        .eq('id', userId)
        .single();
    
    if (userError) {
        console.error("ProfileService: Error fetching user data for driver profile -", getDebugMessage(userError), userError);
        throw userError;
    }
    if (!userData) {
        throw new Error("Access denied or user not found for driver profile.");
    }
    
    const { data: driverProfileData, error: driverProfileError } = await supabase
        .from('drivers_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (driverProfileError && driverProfileError.code !== 'PGRST116') { 
        console.error("ProfileService: Error fetching driver_profile data -", getDebugMessage(driverProfileError), driverProfileError);
        throw driverProfileError;
    }
    
    const typedUserData = userData;
    const typedDriverProfileData = driverProfileData;
    return {
        userId: userId,
        fullName: typedUserData.full_name || '',
        phoneNumber: typedUserData.phone_number || '',
        profilePicUrl: typedUserData.profile_pic_url || '',
        vehicleModel: typedDriverProfileData?.vehicle_model || '',
        vehicleColor: typedDriverProfileData?.vehicle_color || '',
        plateRegion: typedDriverProfileData?.plate_region || '',
        plateNumbers: typedDriverProfileData?.plate_numbers || '',
        plateTypeChar: typedDriverProfileData?.plate_type_char || '',
        alertSoundPreference: typedDriverProfileData?.alert_sound_preference || DEFAULT_SOUND_KEY,
        alertSoundVolume: typedDriverProfileData?.alert_sound_volume ?? DEFAULT_SOUND_VOLUME,
    };
  },

  async updateDriverProfile(userId: string, profileData: Partial<DriverProfileData>): Promise<boolean> {
      const userUpdates: Database['public']['Tables']['users']['Update'] = { updated_at: new Date().toISOString() };
      let userNeedsUpdate = false;

      if (profileData.fullName !== undefined) {
          userUpdates.full_name = profileData.fullName;
          userNeedsUpdate = true;
      }
      
      if (profileData.profilePicUrl !== undefined) {
          userUpdates.profile_pic_url = profileData.profilePicUrl;
          userNeedsUpdate = true;
      }

      if (userNeedsUpdate) {
          const { error: userUpdateError } = await supabase
              .from('users')
              .update(userUpdates)
              .eq('id', userId);
          if (userUpdateError) {
              console.error("ProfileService: Error updating user's full_name/profile_pic_url (for driver) -", getDebugMessage(userUpdateError), userUpdateError);
              throw userUpdateError;
          }
      }
      
      const driverProfileDbUpdates: Partial<Database['public']['Tables']['drivers_profile']['Update']> = { user_id: userId };
      
      if (profileData.vehicleModel !== undefined) driverProfileDbUpdates.vehicle_model = profileData.vehicleModel;
      if (profileData.vehicleColor !== undefined) driverProfileDbUpdates.vehicle_color = profileData.vehicleColor;
      if (profileData.plateRegion !== undefined) driverProfileDbUpdates.plate_region = profileData.plateRegion;
      if (profileData.plateNumbers !== undefined) driverProfileDbUpdates.plate_numbers = profileData.plateNumbers;
      if (profileData.plateTypeChar !== undefined) driverProfileDbUpdates.plate_type_char = profileData.plateTypeChar;
      if (profileData.alertSoundPreference !== undefined) driverProfileDbUpdates.alert_sound_preference = profileData.alertSoundPreference;

      if (Object.keys(driverProfileDbUpdates).length > 1) {
        driverProfileDbUpdates.updated_at = new Date().toISOString();
        const { error: driverProfileUpsertError } = await supabase
            .from('drivers_profile')
            .upsert(driverProfileDbUpdates, { onConflict: 'user_id' });

        if (driverProfileUpsertError) {
            console.error("ProfileService: Error upserting driver_profile -", getDebugMessage(driverProfileUpsertError), driverProfileUpsertError);
            throw driverProfileUpsertError;
        }
      }
      return true;
  },

  async updateDriverOnlineStatus(userId: string, isOnline: boolean) {
    const status = isOnline ? 'online' : 'offline';
    const payload: Database['public']['Tables']['drivers_profile']['Update'] = { 
        user_id: userId, 
        current_status: status, 
        updated_at: new Date().toISOString() 
      };
    const { error } = await supabase
      .from('drivers_profile')
      .upsert(payload,
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error("ProfileService: Error upserting driver online status -", getDebugMessage(error), error);
      throw error;
    }
    
    return true;
  },

  async fetchUserDetailsById(userId: string): Promise<PassengerDetails | null> {
    const { data, error } = await supabase.rpc('get_trip_counterpart_details', {
        user_id_to_fetch: userId
    }).single();
    
    if (error) {
      if (error.code === 'PGRST116') { 
        return null;
      }
      console.error("ProfileService: Error fetching user details by ID -", getDebugMessage(error), error);
      throw error;
    }
    if (!data) return null;
    
    const typedData = data;

    return {
        id: typedData.id,
        fullName: typedData.full_name,
        phoneNumber: typedData.phone_number,
        profilePicUrl: typedData.profile_pic_url,
    };
  },

  async fetchUserSessionData(userId: string): Promise<UserSessionData | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone_number, role, is_verified')
      .eq('id', userId)
      .single();

    if (error) {
        if (error.code === 'PGRST116') { 
            return null;
        }
        console.error("ProfileService: Error fetching user session data -", getDebugMessage(error), error);
        throw error;
    }
    if (!data) return null;
    
    const typedData = data;
    return {
        userId: typedData.id,
        fullName: typedData.full_name,
        phoneNumber: typedData.phone_number,
        role: typedData.role as UserRole,
        isVerified: typedData.is_verified,
    };
  },

  async addUserDefinedPlace(name: string, lat: number, lng: number, userId: string) {
    const payload: Database['public']['Tables']['user_defined_places']['Insert'] = {
        name: name,
        location: `POINT(${lng} ${lat})`,
        user_id: userId
    };
    const { error } = await supabase.from('user_defined_places').insert([payload]);

    if (error) {
        console.error("ProfileService: Error adding user-defined place -", getDebugMessage(error), error);
        throw error;
    }
    return true;
  },

  // NOTE: This new function requires a corresponding RPC function in Supabase.
  // Please add the SQL function below to your Supabase project's SQL Editor.
  /*
    -- SQL to create the search function in Supabase
    CREATE OR REPLACE FUNCTION search_user_places_by_name(search_query TEXT)
    RETURNS TABLE(
        id uuid,
        created_at timestamptz,
        name text,
        location_text text,
        user_id uuid
    ) 
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        RETURN QUERY 
        SELECT 
            udp.id,
            udp.created_at,
            udp.name,
            ST_AsText(udp.location) as location_text,
            udp.user_id
        FROM 
            public.user_defined_places AS udp
        WHERE 
            udp.name ILIKE '%' || search_query || '%';
    END;
    $$;
  */
  async searchUserDefinedPlaces(query: string): Promise<UserDefinedPlace[]> {
    if (!query.trim()) return [];

    try {
        const { data, error } = await supabase.rpc('search_user_places_by_name', {
            search_query: query
        });

        if (error) {
            console.error("ProfileService: Error calling search_user_places_by_name RPC", getDebugMessage(error), error);
            throw error;
        }

        if (data && Array.isArray(data)) {
            const parsedPlaces = (data as RpcPlace[]).map((item: RpcPlace) => {
                const location = parsePoint(item.location_text);
                if (!location) return null;
                
                return {
                    id: item.id,
                    created_at: item.created_at,
                    name: item.name,
                    location: location,
                    user_id: item.user_id,
                };
            }).filter((p): p is UserDefinedPlace => p !== null);
            
            return parsedPlaces;
        }
        return [];
    } catch (err: any) {
        console.error("ProfileService: Exception in searchUserDefinedPlaces", getDebugMessage(err), err);
        return []; // Return empty on exception
    }
  },
};
