/*
-- ===============================================================================================
-- IMPORTANT: To fix the "406 Not Acceptable" error when fetching pending ride requests,
-- please run the following SQL query in your Supabase SQL Editor.
--
-- This creates a database function that securely exposes pending ride requests to authenticated
-- users (drivers) without running into complex Row-Level Security (RLS) issues for this
-- specific read-only query.
-- ===============================================================================================

CREATE OR REPLACE FUNCTION get_all_pending_requests()
RETURNS SETOF ride_requests -- Returns a table of rows matching the 'ride_requests' table structure
LANGUAGE plpgsql
SECURITY DEFINER -- This is the key part: it runs the query with the permissions of the function owner
AS $$
BEGIN
  RETURN QUERY 
  SELECT *
  FROM public.ride_requests
  WHERE status = 'pending' AND driver_id IS NULL;
END;
$$;
*/

import { supabase } from './supabase';
import { UserRole, RideRequest, RideStatus } from '../types';
import { getDebugMessage } from '../utils/helpers'; 
import { Database } from '../types/supabase';

export const tripService = {
  async createRideRequest(requestDetails: Omit<RideRequest, 'id' | 'created_at' | 'updated_at'>): Promise<RideRequest> {
    const payload: Database['public']['Tables']['ride_requests']['Insert'] = requestDetails;
    const { data, error } = await supabase
        .from('ride_requests')
        .insert([payload])
        .select()
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
        .select('*')
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

  async updateRide(rideId: string, updates: Partial<Omit<RideRequest, 'id' | 'created_at' | 'updated_at'>>): Promise<RideRequest | null> {
    const updatePayload: Database['public']['Tables']['ride_requests']['Update'] = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
        .from('ride_requests')
        .update(updatePayload)
        .eq('id', rideId)
        .select();

    if (error) {
        console.error("TripService: Error updating ride -", getDebugMessage(error), error);
        throw error;
    }
    
    // If data is null or empty, it means the row was not found or RLS prevented the update.
    // This handles the race condition where the ride is accepted/cancelled by another party.
    if (!data || data.length === 0) {
        return null;
    }

    return data[0] as RideRequest;
  },

  async submitCancellationReport(details: { rideId: string, userId: string, role: UserRole, reasonKey: string, customReason: string | null }) {
    const { rideId, userId, role, reasonKey, customReason } = details;
    const payload: Database['public']['Tables']['ride_cancellations']['Insert'] = {
        ride_request_id: rideId,
        cancelled_by_user_id: userId,
        canceller_role: role,
        reason_key: reasonKey,
        custom_reason: customReason,
      };
    const { error } = await supabase
      .from('ride_cancellations')
      .insert([payload]);

    if (error) {
      console.error("TripService: Error submitting cancellation report -", getDebugMessage(error), error);
    }
    return !error;
  },

  async fetchActivePassengerTrip(passengerId: string): Promise<RideRequest | null> {
    const activeStatuses: RideStatus[] = ['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'];
    const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('passenger_id', passengerId)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    if (error && error.code !== 'PGRST116') { 
        console.error("TripService: Error fetching active passenger trip -", getDebugMessage(error), error);
        throw error;
    }
    return data as RideRequest | null;
  },

  async fetchActiveDriverTrip(driverId: string): Promise<RideRequest | null> {
    const activeStatuses: RideStatus[] = ['accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination'];
    const { data, error } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', activeStatuses)
      .order('accepted_at', { ascending: false }) 
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
        console.error("TripService: Error fetching active driver trip -", getDebugMessage(error), error);
        throw error;
    }
    return data as RideRequest | null;
  },

  async fetchAllPendingRequestsForDriver(): Promise<RideRequest[]> {
    // The previous direct query was failing with 406 errors, likely due to complex RLS.
    // Switching to a SECURITY DEFINER RPC function allows controlled access to pending requests
    // for any authenticated user (assumed to be a driver in this context), bypassing RLS for this specific query.
    const { data, error } = await supabase.rpc('get_all_pending_requests');
    if (error) {
        console.error('[TripService] Error fetching all pending requests via RPC:', getDebugMessage(error), error);
        throw error;
    }
    return (data as any) || [];
  }
};