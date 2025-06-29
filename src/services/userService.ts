import { supabase } from './supabase';
import { UserRole, Language, DriverProfileData, PassengerDetails, RideRequest, UserSessionData } from '../types';
import { getDebugMessage } from '../utils/helpers'; 

const DEFAULT_SOUND_URL = 'https://actions.google.com/sounds/v1/notifications/card_dismiss.ogg';
const BUCKET_NAME = 'profile-pictures';

export const userService = {
  async fetchUserByPhoneNumber(phoneNumber: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, role, profile_pic_url, is_verified') 
      .eq('phone_number', phoneNumber)
      .single();
    if (error && error.code !== 'PGRST116') { 
      console.error("UserService: Error fetching user by phone -", getDebugMessage(error), error);
      throw error;
    }
    return data;
  },

  async createUser(details: { phoneNumber: string, role: UserRole, fullName: string, currentLang: Language, pin: string }) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        phone_number: details.phoneNumber,
        role: details.role,
        full_name: details.fullName,
        current_language: details.currentLang,
        profile_pic_url: JSON.stringify({ pin: details.pin, url: '' }),
      })
      .select('id, full_name, role, profile_pic_url, is_verified') 
      .single();
    if (error) {
      console.error("UserService: Error creating user -", getDebugMessage(error), error);
      throw error;
    }
    return data;
  },

  async updateUser(userId: string, updates: { role?: UserRole, full_name?: string, profile_pic_url?: string | null }) {
    const updatePayload: any = { ...updates, updated_at: new Date().toISOString() };
    
    // No longer need to handle empty string specifically as profile_pic_url is a JSON string now

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
      return; // Not a valid storage URL, nothing to delete
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
      .insert({ user_id: userId, current_status: 'offline', alert_sound_preference: DEFAULT_SOUND_URL }); // Set default sound
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
        profilePicUrl: userData?.profile_pic_url || '', // Pass the raw JSON string
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
          userUpdates.profile_pic_url = profileData.profilePicUrl; // This will now be a JSON string
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
      
      // Map all possible fields from profileData to their DB column names to ensure correctness
      if (profileData.vehicleModel !== undefined) driverProfileDbUpdates.vehicle_model = profileData.vehicleModel;
      if (profileData.vehicleColor !== undefined) driverProfileDbUpdates.vehicle_color = profileData.vehicleColor;
      if (profileData.plateRegion !== undefined) driverProfileDbUpdates.plate_region = profileData.plateRegion;
      if (profileData.plateNumbers !== undefined) driverProfileDbUpdates.plate_numbers = profileData.plateNumbers;
      if (profileData.plateTypeChar !== undefined) driverProfileDbUpdates.plate_type_char = profileData.plateTypeChar;
      if (profileData.alertSoundPreference !== undefined) driverProfileDbUpdates.alert_sound_preference = profileData.alertSoundPreference;

      const driverProfileFieldsToUpdate = Object.keys(driverProfileDbUpdates);
      
      // Only perform an update if there's more than just the user_id
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
    // Use upsert to prevent "Driver profile not found" error for new drivers.
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
        profilePicUrl: data.profile_pic_url, // Pass raw JSON string
    };
  },

  async fetchUserSessionData(userId: string): Promise<UserSessionData | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone_number, role, is_verified')
      .eq('id', userId)
      .single();

    if (error) {
        if (error.code === 'PGRST116') { // Not found
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
      // We don't throw here to not block the UI flow, as cancelling the ride is more critical.
    }
    return !error;
  },

  async fetchActivePassengerTrip(passengerId: string): Promise<RideRequest | null> {
    const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('passenger_id', passengerId)
        .in('status', ['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination', 'trip_completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
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
      .order('accepted_at', { ascending: false }) // Order by when it was accepted
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
        console.error("UserService: Error fetching active driver trip -", getDebugMessage(error), error);
        throw error;
    }
    return data;
  },
};