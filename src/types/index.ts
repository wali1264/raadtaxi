
import React, { CSSProperties } from 'react';
import { translations } from '../translations';

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
    nameKey: keyof typeof translations.fa;
    descKey: keyof typeof translations.fa;
    price?: number;
    pricePerKm?: number;
    imageComponent: React.FC<{ style?: CSSProperties }>;
    category: string;
}

export interface AppServiceCategory {
    id: string;
    nameKey: keyof typeof translations.fa;
    services: AppService[];
}

export interface RideRequest {
  id: string;
  created_at: string;
  passenger_id: string;
  passenger_name?: string | null; // This might be from the ride_request itself if denormalized
  driver_id?: string | null;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  service_id: string;
  estimated_fare?: number | null;
  status: string; // e.g., 'pending', 'accepted', 'driver_en_route_to_origin', 'trip_started', 'completed', 'cancelled'
}

export interface DriverDetails {
  name: string;
  serviceId: string;
  vehicleColor: string;
  plateParts: { region: string; numbers: string; type: string };
  profilePicUrl?: string;
  driverId?: string;
}

// For passenger details specifically in driver dashboard
export interface PassengerDetails {
  id: string;
  fullName: string | null;
  phoneNumber: string | null;
  profilePicUrl?: string | null;
}

export type TripPhase = 'enRouteToOrigin' | 'enRouteToDestination' | 'arrivedAtDestination' | null;
export type TripSheetDisplayLevel = 'peek' | 'default' | 'full';

export type Screen = 'phoneInput' | 'otp' | 'map' | 'driverDashboard';

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
}

// Specific phases for driver's journey management
export enum DriverTripPhase {
  NONE = 'NONE', // No active trip or phase
  EN_ROUTE_TO_PICKUP = 'EN_ROUTE_TO_PICKUP',
  AT_PICKUP = 'AT_PICKUP', // Phase for when driver has arrived at pickup
  EN_ROUTE_TO_DESTINATION = 'EN_ROUTE_TO_DESTINATION',
  // TRIP_ENDED = 'TRIP_ENDED' // Handled by setting currentTrip to null
}
