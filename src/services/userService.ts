
import { supabase } from './supabase';
import { UserRole, Language, DriverProfileData, PassengerDetails, RideRequest, UserSessionData } from '../types';
import { getDebugMessage } from '../utils/helpers'; 

const DEFAULT_SOUND_URL = 'https://actions.google.com/sounds/v1/notifications/card_dismiss.ogg';
const BUCKET_NAME = 'profile-pictures';

export const userService = {
  async fetchUserByPhoneNumber(phoneNumber: string): Promise<{ role: UserRole } | null> {
    const { data, error } = await supabase.rpc('get_user_role_by_phone', {
        p_phone_number: phoneNumber
    });

    if (error) {
        console.error("UserService: Error calling get_user_role_by_phone RPC -", getDebugMessage(error), error);
        return null;
    }

    if (data) {
        return { role: data as UserRole };
    }
    
    return null;
  },

  async createUserInPublicTable(details: { userId: string, phoneNumber: string, role: UserRole, fullName: string, currentLang: Language }) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: details.userId,
        phone_number: details.phoneNumber,
        role: details.role,
        full_name: details.fullName,
        current_language: details.currentLang,
        profile_pic_url: '', 
        is_verified: true, 
      })
      .select('id, full_name, role, profile_pic_url, is_verified, phone_number') 
      .single();

    if (error) {
      console.error("UserService: Error creating user in public table -", getDebugMessage(error), error);
      throw error;
    }
    
    return {
        userId: data.id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        role: data.role as UserRole,
        isVerified: data.is_verified,
    };
  },

  async updateUser(userId: string, updates: { role?: UserRole, full_name?: string, profile_pic_url?: string | null }) {
    const updatePayload: any = { ...updates, updated_at: new Date().toISOString() };
    
    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('id, full_name, role, profile_pic_url, is_verified') 
      .single();
    if (error) {
      console.error("UserService: Error updating user -", getDebugMessage(error), error);
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
      console.error("UserService: Error uploading profile picture -", getDebugMessage(uploadError), uploadError);
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
          console.warn("UserService: Could not delete old profile picture -", getDebugMessage(deleteError), deleteError);
        }
      }
    } catch (e) {
      console.error("UserService: Invalid URL provided for deletion -", getDebugMessage(e), e);
    }
  },

  async createDriverProfileEntry(userId: string) {
    const { error } = await supabase
      .from('drivers_profile')
      .insert({ user_id: userId, current_status: 'offline', alert_sound_preference: DEFAULT_SOUND_URL }); 
    if (error) {
      console.error("UserService: Error creating driver profile entry -", getDebugMessage(error), error);
      throw error;
    }
    return true;
  },

  async fetchDriverProfile(userId: string): Promise<Partial<DriverProfileData>> {
    let userDataResult: { data: any, error: any };
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser && authUser.id === userId) {
        userDataResult = await supabase
            .from('users')
            .select('full_name, phone_number, profile_pic_url')
            .eq('id', userId)
            .single();
    } else {
        userDataResult = await supabase.rpc('get_trip_counterpart_details', {
            user_id_to_fetch: userId
        }).single();
    }
    
    const { data: userData, error: userError } = userDataResult;

    if (userError) {
        console.error("UserService: Error fetching user data for driver profile -", getDebugMessage(userError), userError);
        throw userError;
    }
    if (!userData) {
        throw new Error("Access denied or user not found for driver profile.");
    }
    
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
        profilePicUrl: userData?.profile_pic_url || '',
        vehicleModel: driverProfileData?.vehicle_model || '',
        vehicleColor: driverProfileData?.vehicle_color || '',
        plateRegion: driverProfileData?.plate_region || '',
        plateNumbers: driverProfileData?.plate_numbers || '',
        plateTypeChar: driverProfileData?.plate_type_char || '',
        alertSoundPreference: driverProfileData?.alert_sound_preference || DEFAULT_SOUND_URL,
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
          userUpdates.profile_pic_url = profileData.profilePicUrl;
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
      
      const driverProfileDbUpdates: { [key: string]: any } = { user_id: userId };
      
      if (profileData.vehicleModel !== undefined) driverProfileDbUpdates.vehicle_model = profileData.vehicleModel;
      if (profileData.vehicleColor !== undefined) driverProfileDbUpdates.vehicle_color = profileData.vehicleColor;
      if (profileData.plateRegion !== undefined) driverProfileDbUpdates.plate_region = profileData.plateRegion;
      if (profileData.plateNumbers !== undefined) driverProfileDbUpdates.plate_numbers = profileData.plateNumbers;
      if (profileData.plateTypeChar !== undefined) driverProfileDbUpdates.plate_type_char = profileData.plateTypeChar;
      if (profileData.alertSoundPreference !== undefined) driverProfileDbUpdates.alert_sound_preference = profileData.alertSoundPreference;

      const driverProfileFieldsToUpdate = Object.keys(driverProfileDbUpdates);
      
      if (driverProfileFieldsToUpdate.length > 1) {
        driverProfileDbUpdates.updated_at = new Date().toISOString();
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
    const status = isOnline ? 'online' : 'offline';
    const { error } = await supabase
      .from('drivers_profile')
      .upsert(
        { 
          user_id: userId, 
          current_status: status, 
          updated_at: new Date().toISOString() 
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error("UserService: Error upserting driver online status -", getDebugMessage(error), error);
      throw error;
    }
    
    return true;
  },

  async fetchUserDetailsById(userId: string): Promise<PassengerDetails | null> {
    let userDetailsResult: { data: any, error: any };
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser && authUser.id === userId) {
        userDetailsResult = await supabase
            .from('users')
            .select('id, full_name, phone_number, profile_pic_url')
            .eq('id', userId)
            .single();
    } else {
        userDetailsResult = await supabase.rpc('get_trip_counterpart_details', {
            user_id_to_fetch: userId
        }).single();
    }
    
    const { data, error } = userDetailsResult;

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
        console.error("UserService: Error fetching user session data -", getDebugMessage(error), error);
        throw error;
    }
    if (!data) return null;

    return {
        userId: data.id,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        role: data.role as UserRole,
        isVerified: data.is_verified,
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
        if (error.code === 'PGRST116') { 
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
  },

  async submitCancellationReport(details: { rideId: string, userId: string, role: UserRole, reasonKey: string, customReason: string | null }) {
    const { rideId, userId, role, reasonKey, customReason } = details;
    const { error } = await supabase
      .from('ride_cancellations')
      .insert({
        ride_request_id: rideId,
        cancelled_by_user_id: userId,
        canceller_role: role,
        reason_key: reasonKey,
        custom_reason: customReason,
      });

    if (error) {
      console.error("UserService: Error submitting cancellation report -", getDebugMessage(error), error);
    }
    return !error;
  },

  async fetchActivePassengerTrip(passengerId: string): Promise<RideRequest | null> {
    const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('passenger_id', passengerId)
        .in('status', ['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') { 
        console.error("UserService: Error fetching active passenger trip -", getDebugMessage(error), error);
        throw error;
    }
    return data;
  },

  async fetchActiveDriverTrip(driverId: string): Promise<RideRequest | null> {
    const { data, error } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'])
      .order('accepted_at', { ascending: false }) 
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
        console.error("UserService: Error fetching active driver trip -", getDebugMessage(error), error);
        throw error;
    }
    return data;
  },
};
