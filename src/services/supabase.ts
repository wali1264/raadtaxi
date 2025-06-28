
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_USER_AGENT } from '../config';

const supabaseUrl = 'https://lpxomioaloqfrueikjcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweG9taW9hbG9xZnJ1ZWlramNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NjY2MTQsImV4cCI6MjA2NjE0MjYxNH0.VLo7EVAHrrnk2GkLcvrZV6p7mVOCwkMrGEyW_UxnSAc';

let supabaseExport: SupabaseClient;

// The customFetch wrapper was removed as it caused an infinite recursion error.
// The custom User-Agent header is also removed as it can cause "TypeError: Failed to fetch"
// in certain sandboxed browser environments.

try {
  // Initialize the Supabase client without custom headers to avoid potential fetch errors.
  const client = createClient(supabaseUrl, supabaseKey);

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