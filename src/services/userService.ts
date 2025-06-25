import { supabase } from './supabase';
import { UserRole, Language, DriverProfileData, PassengerDetails } from '../types';
import { getDebugMessage } from '../utils/helpers'; // Assuming getDebugMessage is available for robust logging

export const userService = {
  async fetchUserByPhoneNumber(phoneNumber: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role')
      .eq('phone_number', phoneNumber)
      .single();
    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found, not an error in this context
      console.error("UserService: Error fetching user by phone -", getDebugMessage(error), error);
      throw error;
    }
    return data;
  },

  async createUser(details: { phoneNumber: string, role: UserRole, fullName: string, currentLang: Language }) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        phone_number: details.phoneNumber,
        role: details.role,
        full_name: details.fullName,
        current_language: details.currentLang,
      })
      .select('id, full_name, role')
      .single();
    if (error) {
      console.error("UserService: Error creating user -", getDebugMessage(error), error);
      throw error;
    }
    return data;
  },

  async updateUser(userId: string, updates: { role?: UserRole, full_name?: string }) {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, full_name, role') // Select the fields that might be updated or needed
      .single();
    if (error) {
      console.error("UserService: Error updating user -", getDebugMessage(error), error);
      throw error;
    }
    return data;
  },

  async createDriverProfileEntry(userId: string) {
    const { error } = await supabase
      .from('drivers_profile')
      .insert({ user_id: userId, current_status: 'offline' });
    if (error) {
      console.error("UserService: Error creating driver profile entry -", getDebugMessage(error), error);
      // Potentially, don't throw an error if it's a conflict and already exists,
      // but a simple insert failing might be important.
      throw error;
    }
    return true;
  },

  async fetchDriverProfile(userId: string): Promise<Partial<DriverProfileData>> {
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, phone_number')
        .eq('id', userId)
        .single();

    if (userError) {
        console.error("UserService: Error fetching user data for profile -", getDebugMessage(userError), userError);
        throw userError;
    }
    
    const { data: driverProfileData, error: driverProfileError } = await supabase
        .from('drivers_profile')
        .select('profile_pic_url, vehicle_model, vehicle_color, plate_region, plate_numbers, plate_type_char')
        .eq('user_id', userId)
        .single();

    if (driverProfileError && driverProfileError.code !== 'PGRST116') { // PGRST116: No rows found, ok for profile
        console.error("UserService: Error fetching driver_profile data -", getDebugMessage(driverProfileError), driverProfileError);
        throw driverProfileError;
    }

    return {
        userId: userId,
        fullName: userData?.full_name || '',
        phoneNumber: userData?.phone_number || '',
        profilePicUrl: driverProfileData?.profile_pic_url || '',
        vehicleModel: driverProfileData?.vehicle_model || '',
        vehicleColor: driverProfileData?.vehicle_color || '',
        plateRegion: driverProfileData?.plate_region || '',
        plateNumbers: driverProfileData?.plate_numbers || '',
        plateTypeChar: driverProfileData?.plate_type_char || '',
    };
  },

  async updateDriverProfile(userId: string, profileData: Partial<DriverProfileData>): Promise<boolean> {
      if (profileData.fullName) {
          const { error: userUpdateError } = await supabase
              .from('users')
              .update({ full_name: profileData.fullName })
              .eq('id', userId);
          if (userUpdateError) {
              console.error("UserService: Error updating user's full_name -", getDebugMessage(userUpdateError), userUpdateError);
              throw userUpdateError;
          }
      }

      const driverProfileDbUpdates: any = {
          user_id: userId, // for upsert
          updated_at: new Date().toISOString(),
      };
      if (profileData.profilePicUrl !== undefined) driverProfileDbUpdates.profile_pic_url = profileData.profilePicUrl;
      if (profileData.vehicleModel !== undefined) driverProfileDbUpdates.vehicle_model = profileData.vehicleModel;
      if (profileData.vehicleColor !== undefined) driverProfileDbUpdates.vehicle_color = profileData.vehicleColor;
      if (profileData.plateRegion !== undefined) driverProfileDbUpdates.plate_region = profileData.plateRegion;
      if (profileData.plateNumbers !== undefined) driverProfileDbUpdates.plate_numbers = profileData.plateNumbers;
      if (profileData.plateTypeChar !== undefined) driverProfileDbUpdates.plate_type_char = profileData.plateTypeChar;
      
      // Only upsert if there are actual driver_profile fields to update
      const driverProfileFieldsToUpdate = Object.keys(driverProfileDbUpdates).filter(key => key !== 'user_id' && key !== 'updated_at');

      if (driverProfileFieldsToUpdate.length > 0) {
        const { error: driverProfileUpsertError } = await supabase
            .from('drivers_profile')
            .upsert(driverProfileDbUpdates, { onConflict: 'user_id' });

        if (driverProfileUpsertError) {
            console.error("UserService: Error upserting driver_profile -", getDebugMessage(driverProfileUpsertError), driverProfileUpsertError);
            throw driverProfileUpsertError;
        }
      }
      return true;
  },

  async updateDriverOnlineStatus(userId: string, isOnline: boolean) {
    const { error } = await supabase
      .from('drivers_profile')
      .update({ current_status: isOnline ? 'online' : 'offline', updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) {
      console.error("UserService: Error updating driver online status -", getDebugMessage(error), error);
      throw error;
    }
    return true;
  },

  async fetchUserDetailsById(userId: string): Promise<PassengerDetails | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone_number, profile_pic_url')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No user found
        return null;
      }
      console.error("UserService: Error fetching user details by ID -", getDebugMessage(error), error);
      throw error;
    }
    if (!data) return null;

    return {
        id: data.id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        profilePicUrl: data.profile_pic_url,
    };
  }
};
