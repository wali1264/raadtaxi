
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Import the new types

const supabaseUrl = 'https://lpxomioaloqfrueikjcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweG9taW9hbG9xZnJ1ZWlramNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NjY2MTQsImV4cCI6MjA2NjE0MjYxNH0.VLo7EVAHrrnk2GkLcvrZV6p7mVOCwkMrGEyW_UxnSAc';

/**
 * Custom fetch implementation to address "TypeError: Failed to fetch" in sandboxed
 * environments that may block requests with non-standard headers like 'x-client-info'.
 * This wrapper removes the problematic header while preserving essential ones
 * (e.g., 'Authorization') needed for authenticated requests with RLS.
 */
const customFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    // Remove the header that may be causing network failures in restricted environments.
    headers.delete('x-client-info');
    const newInit = { ...init, headers };
    return fetch(input, newInit);
};


let supabaseExport: SupabaseClient<Database>; // Use the Database type

try {
  // Initialize the Supabase client with a custom fetch implementation to fix
  // network errors, and apply the Database generic type for full type safety.
  const client = createClient<Database>(supabaseUrl, supabaseKey, {
    global: {
        fetch: customFetch
    }
  });

  if (!client || typeof client.from !== 'function') {
    console.error("Supabase client initialization failed: 'from' method is missing or client is invalid.");
    throw new Error("Supabase client initialization failed. Check network connectivity to esm.sh or Supabase script loading.");
  }
  supabaseExport = client;
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  console.error("Critical error during Supabase client initialization:", errorMessage, e);
  // Re-throw to make it clear that initialization failed and the app likely won't function.
  throw new Error(`Supabase client could not be initialized: ${errorMessage}`);
}

export const supabase = supabaseExport;