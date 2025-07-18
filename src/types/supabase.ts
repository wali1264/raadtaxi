
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chat_messages: {
        Row: {
          id: string
          created_at: string
          ride_request_id: string
          sender_id: string
          receiver_id: string
          message_text: string
          is_read: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          ride_request_id: string
          sender_id: string
          receiver_id: string
          message_text: string
          is_read?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          ride_request_id?: string
          sender_id?: string
          receiver_id?: string
          message_text?: string
          is_read?: boolean
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          latitude: number
          longitude: number
          timestamp: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          latitude: number
          longitude: number
          timestamp?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          latitude?: number
          longitude?: number
          timestamp?: string
        }
        Relationships: []
      }
      drivers_profile: {
        Row: {
          alert_sound_preference: string | null
          alert_sound_volume: number | null
          created_at: string
          current_status: string | null
          plate_numbers: string | null
          plate_region: string | null
          plate_type_char: string | null
          updated_at: string
          user_id: string
          vehicle_color: string | null
          vehicle_model: string | null
        }
        Insert: {
          alert_sound_preference?: string | null
          alert_sound_volume?: number | null
          created_at?: string
          current_status?: string | null
          plate_numbers?: string | null
          plate_region?: string | null
          plate_type_char?: string | null
          updated_at?: string
          user_id: string
          vehicle_color?: string | null
          vehicle_model?: string | null
        }
        Update: {
          alert_sound_preference?: string | null
          alert_sound_volume?: number | null
          created_at?: string
          current_status?: string | null
          plate_numbers?: string | null
          plate_region?: string | null
          plate_type_char?: string | null
          updated_at?: string
          user_id?: string
          vehicle_color?: string | null
          vehicle_model?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          subscription: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription?: Json
          created_at?: string
        }
        Relationships: []
      }
      ride_cancellations: {
        Row: {
          cancelled_by_user_id: string
          canceller_role: string
          created_at: string
          custom_reason: string | null
          id: number
          reason_key: string
          ride_request_id: string
        }
        Insert: {
          cancelled_by_user_id: string
          canceller_role: string
          created_at?: string
          custom_reason?: string | null
          id?: number
          reason_key: string
          ride_request_id: string
        }
        Update: {
          cancelled_by_user_id?: string
          canceller_role?: string
          created_at?: string
          custom_reason?: string | null
          id?: number
          reason_key?: string
          ride_request_id?: string
        }
        Relationships: []
      }
      ride_requests: {
        Row: {
          accepted_at: string | null
          actual_fare: number | null
          created_at: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_arrived_at_destination_at: string | null
          driver_arrived_at_origin_at: string | null
          driver_id: string | null
          estimated_fare: number | null
          id: string
          is_third_party: boolean | null
          origin_address: string
          origin_lat: number
          origin_lng: number
          passenger_id: string
          passenger_name: string | null
          passenger_phone: string | null
          route_to_destination_polyline: string | null
          route_to_origin_polyline: string | null
          service_id: string
          status: string
          trip_started_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          actual_fare?: number | null
          created_at?: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_arrived_at_destination_at?: string | null
          driver_arrived_at_origin_at?: string | null
          driver_id?: string | null
          estimated_fare?: number | null
          id?: string
          is_third_party?: boolean | null
          origin_address: string
          origin_lat: number
          origin_lng: number
          passenger_id: string
          passenger_name?: string | null
          passenger_phone?: string | null
          route_to_destination_polyline?: string | null
          route_to_origin_polyline?: string | null
          service_id: string
          status: string
          trip_started_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          actual_fare?: number | null
          created_at?: string
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          driver_arrived_at_destination_at?: string | null
          driver_arrived_at_origin_at?: string | null
          driver_id?: string | null
          estimated_fare?: number | null
          id?: string
          is_third_party?: boolean | null
          origin_address?: string
          origin_lat?: number
          origin_lng?: number
          passenger_id?: string
          passenger_name?: string | null
          passenger_phone?: string | null
          route_to_destination_polyline?: string | null
          route_to_origin_polyline?: string | null
          service_id?: string
          status?: string
          trip_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_fare: number | null
          category: string
          created_at: string
          description_key: string
          id: string
          image_identifier: string
          is_active: boolean
          min_fare: number | null
          name_key: string
          price_per_km: number | null
          price_per_minute: number | null
        }
        Insert: {
          base_fare?: number | null
          category: string
          created_at?: string
          description_key: string
          id?: string
          image_identifier: string
          is_active?: boolean
          min_fare?: number | null
          name_key: string
          price_per_km?: number | null
          price_per_minute?: number | null
        }
        Update: {
          base_fare?: number | null
          category?: string
          created_at?: string
          description_key?: string
          id?: string
          image_identifier?: string
          is_active?: boolean
          min_fare?: number | null
          name_key?: string
          price_per_km?: number | null
          price_per_minute?: number | null
        }
        Relationships: []
      }
      user_defined_places: {
        Row: {
          created_at: string
          id: string
          location: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          current_language: string | null
          full_name: string | null
          id: string
          is_verified: boolean
          phone_number: string | null
          profile_pic_url: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          current_language?: string | null
          full_name?: string | null
          id: string
          is_verified?: boolean
          phone_number?: string | null
          profile_pic_url?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          current_language?: string | null
          full_name?: string | null
          id?: string
          is_verified?: boolean
          phone_number?: string | null
          profile_pic_url?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_user_places: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          created_at: string
          name: string
          location_text: string
          user_id: string
        }[]
      }
      get_trip_counterpart_details: {
        Args: {
          user_id_to_fetch: string
        }
        Returns: {
          id: string
          full_name: string
          phone_number: string
          profile_pic_url: string
        }
      }
      get_user_role_by_phone: {
        Args: {
          p_phone_number: string
        }
        Returns: Json
      }
      search_user_places_by_name: {
          Args: {
              search_query: string
          }
          Returns: {
              id: string
              created_at: string
              name: string
              location_text: string
              user_id: string
          }[]
      }
    }
    Enums: {
      user_role: "passenger" | "driver"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
