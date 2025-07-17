
import { supabase } from './supabase';
import { UserRole } from '../types';
import { getDebugMessage } from '../utils/helpers';

export const authService = {
  async fetchUserByPhoneNumber(phoneNumber: string): Promise<{ role: UserRole } | null> {
    const { data, error } = await supabase.rpc('get_user_role_by_phone', {
        p_phone_number: phoneNumber
    });

    if (error) {
        // "PGRST116" means "Resource Not Found", which is the expected case for a new user.
        // We can safely return null without logging an error.
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error("AuthService: Error calling get_user_role_by_phone RPC -", getDebugMessage(error), error);
        return null;
    }

    // If RPC returns no data (e.g., SELECT found no rows and didn't error)
    if (data === null || data === undefined) {
      return null;
    }
    
    // Most likely cause of the bug: RPC returns the role as a direct string.
    if (typeof data === 'string' && (data === 'passenger' || data === 'driver')) {
        return { role: data as UserRole };
    }
    
    // Standard handling for RPCs that return a table (array of objects) or a single JSON object.
    const resultData = Array.isArray(data) ? data[0] : data;

    // Check if the result is an object and has a valid 'role' property.
    if (typeof resultData === 'object' && resultData !== null && ('role' in resultData)) {
        const userRole = (resultData as any).role;
        if (userRole === 'passenger' || userRole === 'driver') {
            return { role: userRole as UserRole };
        }
    }

    // If data format is unexpected or role is invalid/null, log it and return null.
    // This will trigger the "create" flow, which is a safe default.
    console.warn("AuthService: Unexpected data format or invalid role from get_user_role_by_phone RPC. Data:", data);
    return null;
  },

  async signUp(email: string, password: string):Promise<{user: any, session: any} | null> {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    if (error) { throw error; }
    if (!data.user) throw new Error("Supabase signup did not return a user.");
    return { user: data.user, session: data.session };
  },

  async signIn(email: string, password: string):Promise<{user: any, session: any} | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) { throw error; }
    if (!data.user) throw new Error("Supabase signin did not return a user.");
    return { user: data.user, session: data.session };
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async getSession() {
      return supabase.auth.getSession();
  },

  async getUser() {
    return supabase.auth.getUser();
  }
};
