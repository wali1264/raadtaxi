
import { supabase } from './supabase';
import { UserRole } from '../types';
import { getDebugMessage } from '../utils/helpers';

export const authService = {
  async fetchUserByPhoneNumber(phoneNumber: string): Promise<{ role: UserRole } | null> {
    const { data, error } = await supabase.rpc('get_user_role_by_phone', {
        p_phone_number: phoneNumber
    });

    if (error) {
        console.error("AuthService: Error calling get_user_role_by_phone RPC -", getDebugMessage(error), error);
        return null;
    }

    // data will now be null or an object like { "role": "driver" }
    if (data && (data as any).role) {
        return { role: (data as any).role as UserRole };
    }
    
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