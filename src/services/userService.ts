import { supabase } from './supabase';
import { UserRole, Language, DriverProfileData, PassengerDetails, RideRequest } from '../types';
import { getDebugMessage } from '../utils/helpers'; 

export const userService = {
  async fetchUserByPhoneNumber(phoneNumber: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, profile_pic_url') 
      .eq('phone_number', phoneNumber)
      .single();
    if (error && error.code !== 'PGRST116') { 
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
      .select('id, full_name, role, profile_pic_url') 
      .single();
    if (error) {
      console.error("UserService: Error creating user -", getDebugMessage(error), error);
      throw error;
    }
    return data;
  },

  async updateUser(userId: string, updates: { role?: UserRole, full_name?: string, profile_pic_url?: string | null }) {
    const updatePayload: any = { ...updates, updated_at: new Date().toISOString() };
    
    if (updates.profile_pic_url === '') { // Handle empty string to mean null for DB
        updatePayload.profile_pic_url = null;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, full_name, role, profile_pic_url') 
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
      .insert({ user_id: userId, current_status: 'offline', alert_sound_preference: 'default_notification.mp3' }); // Set default sound
    if (error) {
      console.error("UserService: Error creating driver profile entry -", getDebugMessage(error), error);
      throw error;
    }
    return true;
  },

  async fetchDriverProfile(userId: string): Promise<Partial<DriverProfileData>> {
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('full_name, phone_number, profile_pic_url') // Fetch profile_pic_url from users table
        .eq('id', userId)
        .single();

    if (userError) {
        console.error("UserService: Error fetching user data for driver profile -", getDebugMessage(userError), userError);
        throw userError;
    }
    
    // Do not select profile_pic_url from drivers_profile
    const { data: driverProfileData, error: driverProfileError } = await supabase
        .from('drivers_profile')
        .select('vehicle_model, vehicle_color, plate_region, plate_numbers, plate_type_char, alert_sound_preference')
        .eq('user_id', userId)
        .single();

    if (driverProfileError && driverProfileError.code !== 'PGRST116') { 
        console.error("UserService: Error fetching driver_profile data -", getDebugMessage(driverProfileError), driverProfileError);
        throw driverProfileError;
    }

    return {
        userId: userId,
        fullName: userData?.full_name || '',
        phoneNumber: userData?.phone_number || '',
        profilePicUrl: userData?.profile_pic_url || '', // Use profile_pic_url from userData
        vehicleModel: driverProfileData?.vehicle_model || '',
        vehicleColor: driverProfileData?.vehicle_color || '',
        plateRegion: driverProfileData?.plate_region || '',
        plateNumbers: driverProfileData?.plate_numbers || '',
        plateTypeChar: driverProfileData?.plate_type_char || '',
        alertSoundPreference: driverProfileData?.alert_sound_preference || 'default_notification.mp3',
    };
  },

  async updateDriverProfile(userId: string, profileData: Partial<DriverProfileData>): Promise<boolean> {
      const userUpdates: any = { updated_at: new Date().toISOString() };
      let userNeedsUpdate = false;

      if (profileData.fullName !== undefined) {
          userUpdates.full_name = profileData.fullName;
          userNeedsUpdate = true;
      }
      
      if (profileData.profilePicUrl !== undefined) {
          userUpdates.profile_pic_url = profileData.profilePicUrl === '' ? null : profileData.profilePicUrl;
          userNeedsUpdate = true;
      }

      if (userNeedsUpdate) {
          const { error: userUpdateError } = await supabase
              .from('users')
              .update(userUpdates)
              .eq('id', userId);
          if (userUpdateError) {
              console.error("UserService: Error updating user's full_name/profile_pic_url (for driver) -", getDebugMessage(userUpdateError), userUpdateError);
              throw userUpdateError;
          }
      }

      // Prepare updates for drivers_profile table, excluding fullName and profilePicUrl
      const driverProfileDbUpdates: any = {
          user_id: userId, 
          updated_at: new Date().toISOString(),
      };
      // profile_pic_url is NOT updated in drivers_profile
      if (profileData.vehicleModel !== undefined) driverProfileDbUpdates.vehicle_model = profileData.vehicleModel;
      if (profileData.vehicleColor !== undefined) driverProfileDbUpdates.vehicle_color = profileData.vehicleColor;
      if (profileData.plateRegion !== undefined) driverProfileDbUpdates.plate_region = profileData.plateRegion;
      if (profileData.plateNumbers !== undefined) driverProfileDbUpdates.plate_numbers = profileData.plateNumbers;
      if (profileData.plateTypeChar !== undefined) driverProfileDbUpdates.plate_type_char = profileData.plateTypeChar;
      if (profileData.alertSoundPreference !== undefined) driverProfileDbUpdates.alert_sound_preference = profileData.alertSoundPreference;
      
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
      if (error.code === 'PGRST116') { 
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
  },

  async createRideRequest(requestDetails: Omit<RideRequest, 'id' | 'created_at' | 'updated_at'>): Promise<RideRequest> {
    const { data, error } = await supabase
        .from('ride_requests')
        .insert([requestDetails])
        .select()
        .single();
    if (error || !data) {
        console.error("UserService: Error creating ride request -", getDebugMessage(error), error);
        throw error || new Error("Failed to create ride request: No data returned.");
    }
    return data as RideRequest;
  },

  async fetchRideRequestById(rideId: string): Promise<RideRequest | null> {
    const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('id', rideId)
        .single();
    if (error) {
        if (error.code === 'PGRST116') { // Not found
            return null;
        }
        console.error("UserService: Error fetching ride request by ID -", getDebugMessage(error), error);
        throw error;
    }
    return data as RideRequest | null;
  },

  async updateRide(rideId: string, updates: Partial<RideRequest>): Promise<RideRequest> {
    const updatePayload = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
        .from('ride_requests')
        .update(updatePayload)
        .eq('id', rideId)
        .select()
        .single();
    if (error) {
        console.error("UserService: Error updating ride -", getDebugMessage(error), error);
        throw error;
    }
    return data as RideRequest;
  }
};