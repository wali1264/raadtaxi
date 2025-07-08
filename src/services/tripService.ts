import { supabase } from './supabase';
import { UserRole, RideRequest, RideStatus } from '../types';
import { getDebugMessage } from '../utils/helpers'; 

const RIDE_REQUEST_COLUMNS = 'id, created_at, passenger_id, passenger_name, passenger_phone, is_third_party, driver_id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, service_id, estimated_fare, status, updated_at, accepted_at, driver_arrived_at_origin_at, trip_started_at, driver_arrived_at_destination_at, route_to_origin_polyline, route_to_destination_polyline, actual_fare';

export const tripService = {
  async createRideRequest(requestDetails: Omit<RideRequest, 'id' | 'created_at' | 'updated_at'>): Promise<RideRequest> {
    const { data, error } = await supabase
        .from('ride_requests')
        .insert([requestDetails])
        .select(RIDE_REQUEST_COLUMNS)
        .single();
    if (error || !data) {
        console.error("TripService: Error creating ride request -", getDebugMessage(error), error);
        throw error || new Error("Failed to create ride request: No data returned.");
    }
    return data as RideRequest;
  },

  async fetchRideRequestById(rideId: string): Promise<RideRequest | null> {
    const { data, error } = await supabase
        .from('ride_requests')
        .select(RIDE_REQUEST_COLUMNS)
        .eq('id', rideId)
        .single();
    if (error) {
        if (error.code === 'PGRST116') { 
            return null;
        }
        console.error("TripService: Error fetching ride request by ID -", getDebugMessage(error), error);
        throw error;
    }
    return data as RideRequest | null;
  },

  async updateRide(rideId: string, updates: Partial<Omit<RideRequest, 'id' | 'created_at' | 'updated_at'>>): Promise<RideRequest> {
    const updatePayload = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
        .from('ride_requests')
        .update(updatePayload)
        .eq('id', rideId)
        .select(RIDE_REQUEST_COLUMNS)
        .single();
    if (error) {
        console.error("TripService: Error updating ride -", getDebugMessage(error), error);
        throw error;
    }
    return data as RideRequest;
  },

  async submitCancellationReport(details: { rideId: string, userId: string, role: UserRole, reasonKey: string, customReason: string | null }) {
    const { rideId, userId, role, reasonKey, customReason } = details;
    const { error } = await supabase
      .from('ride_cancellations')
      .insert([{
        ride_request_id: rideId,
        cancelled_by_user_id: userId,
        canceller_role: role,
        reason_key: reasonKey,
        custom_reason: customReason,
      }]);

    if (error) {
      console.error("TripService: Error submitting cancellation report -", getDebugMessage(error), error);
    }
    return !error;
  },

  async fetchActivePassengerTrip(passengerId: string): Promise<RideRequest | null> {
    const activeStatuses: RideStatus[] = ['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'];
    const { data, error } = await supabase
        .from('ride_requests')
        .select(RIDE_REQUEST_COLUMNS)
        .eq('passenger_id', passengerId)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') { 
        console.error("TripService: Error fetching active passenger trip -", getDebugMessage(error), error);
        throw error;
    }
    return data;
  },

  async fetchActiveDriverTrip(driverId: string): Promise<RideRequest | null> {
    const activeStatuses: RideStatus[] = ['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'];
    const { data, error } = await supabase
      .from('ride_requests')
      .select(RIDE_REQUEST_COLUMNS)
      .eq('driver_id', driverId)
      .in('status', activeStatuses)
      .order('accepted_at', { ascending: false }) 
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
        console.error("TripService: Error fetching active driver trip -", getDebugMessage(error), error);
        throw error;
    }
    return data;
  },

  async fetchAllPendingRequestsForDriver(): Promise<RideRequest[]> {
    const { data, error } = await supabase.from('ride_requests').select(RIDE_REQUEST_COLUMNS).eq('status', 'pending').is('driver_id', null); 
    if (error) { 
        console.error('[TripService] Error fetching all pending requests:', getDebugMessage(error), error); 
        throw error;
    }
    return data || [];
  }
};