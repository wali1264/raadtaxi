
import React, { CSSProperties } from 'react';
import { translations, TranslationSet } from '../translations';

export type Language = 'fa' | 'ps' | 'en';

export type UserRole = 'passenger' | 'driver';

// DB-aligned Service type (what's fetched)
export interface DbService {
  id: string; // service_id from DB
  name_key: string;
  description_key: string;
  image_identifier: string;
  base_fare: number | null;
  price_per_km: number | null;
  price_per_minute: number | null;
  category: string;
  min_fare: number | null;
  is_active: boolean;
  // Supabase also adds created_at, etc.
}

// Frontend Service type (after mapping image_identifier)
export interface AppService {
    id: string;
    nameKey: keyof TranslationSet;
    descKey: keyof TranslationSet;
    price?: number;
    pricePerKm?: number;
    minFare?: number | null;
    imageComponent: React.FC<{ style?: CSSProperties }>;
    category: string;
}

export interface AppServiceCategory {
    id: string;
    nameKey: keyof TranslationSet;
    services: AppService[];
}

export type RideStatus =
  | 'pending'
  | 'accepted'
  | 'driver_en_route_to_origin'
  | 'trip_started'
  | 'driver_at_destination'
  | 'trip_completed'
  | 'cancelled'
  | 'cancelled_by_driver'
  | 'cancelled_by_passenger'
  | 'timed_out_passenger'
  | 'no_drivers_available';


export interface RideRequest {
  id: string;
  created_at: string;
  passenger_id: string;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  is_third_party?: boolean;
  driver_id?: string | null;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  service_id: string;
  estimated_fare?: number | null;
  status: RideStatus; // e.g., 'pending', 'accepted', 'driver_en_route_to_origin', 'trip_started', 'driver_at_destination', 'trip_completed', 'cancelled', 'cancelled_by_driver', 'cancelled_by_passenger', 'timed_out_passenger'
  accepted_at?: string | null;
  driver_arrived_at_origin_at?: string | null;
  trip_started_at?: string | null;
  driver_arrived_at_destination_at?: string | null;
  route_to_origin_polyline?: string | null;
  route_to_destination_polyline?: string | null;
  actual_fare?: number | null;
  updated_at?: string | null; // Added to match Supabase auto-updates and for general use
  actual_trip_polyline?: string | null;
}

export interface DriverDetails {
  name: string;
  serviceId: string;
  vehicleModel: string;
  vehicleColor: string;
  plateParts: { region: string; numbers: string; type: string };
  profilePicUrl?: string;
  driverId?: string;
  phoneNumber?: string;
}

// For passenger details specifically in driver dashboard
export interface PassengerDetails {
  id: string;
  fullName: string | null;
  phoneNumber: string | null;
  profilePicUrl?: string | null;
}

export type TripPhase = 'enRouteToOrigin' | 'enRouteToDestination' | 'arrivedAtDestination' | 'emergency' | null;
export type TripSheetDisplayLevel = 'peek' | 'default' | 'full';

export type Screen = 'phoneInput' | 'pin' | 'map' | 'driverDashboard' | 'passengerProfile' | 'pendingApproval';

export type DriverSearchState = 'idle' | 'searching' | 'noDriverFound' | 'driversNotified' | 'driverAssigned' | 'awaiting_driver_acceptance';

export interface DriverProfileData {
  userId: string;
  fullName: string;
  phoneNumber: string; // Read-only
  profilePicUrl: string;
  vehicleModel: string;
  vehicleColor: string;
  plateRegion: string;
  plateNumbers: string; // e.g., "34567"
  plateTypeChar: string; // e.g., "ش"
  alertSoundPreference?: string; // e.g., "default_notification.mp3", "chime.mp3", "custom:my_sound.mp3"
}

// PassengerProfileData can be a subset of User table fields + any specific passenger profile fields
// For now, it will largely map to User fields directly editable by the passenger.
export interface PassengerProfileData {
    userId: string; // Should match loggedInUserId
    fullName: string;
    phoneNumber: string; // Typically read-only, fetched from user record
    profilePicUrl?: string; // URL for the profile picture
}


// Specific phases for driver's journey management
export enum DriverTripPhase {
  NONE = 'NONE', // No active trip or phase
  EN_ROUTE_TO_PICKUP = 'EN_ROUTE_TO_PICKUP', // Driver accepted, going to pickup
  AT_PICKUP = 'AT_PICKUP', // Driver has arrived at pickup, waiting for passenger / to start trip
  EN_ROUTE_TO_DESTINATION = 'EN_ROUTE_TO_DESTINATION', // Trip started, going to destination
  AT_DESTINATION = 'AT_DESTINATION' // Driver has arrived at destination, waiting to end trip
}

export type PredefinedSound = {
  id: string;
  nameKey: string;
  fileName: string; // e.g., "default_notification.mp3"
};

// Data shape for restoring a user session from storage
export interface UserSessionData {
    userId: string;
    fullName: string | null;
    phoneNumber: string | null;
    role: UserRole;
    isVerified: boolean;
}

export interface DestinationSuggestion {
  name: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
}

// Represents a location defined by a user, fetched from the DB
export interface UserDefinedPlace {
  id: string;
  created_at: string;
  name: string;
  // Supabase returns a GeoJSON string for geography types, which needs parsing.
  // The 'location' field from DB is a string that looks like: 'POINT(62.196948 34.343118)'
  // We will parse it into this object structure in the hook.
  location: {
    lat: number;
    lng: number;
  };
  type?: string | null; // e.g., "Restaurant", "Square", "Shop"
  created_by_user_id: string;
}
