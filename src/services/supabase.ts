
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Import the new types

const supabaseUrl = 'https://lpxomioaloqfrueikjcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweG9taW9hbG9xZnJ1ZWlramNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NjY2MTQsImV4cCI6MjA2NjE0MjYxNH0.VLo7EVAHrrnk2GkLcvrZV6p7mVOCwkMrGEyW_UxnSAc';

let supabaseExport: SupabaseClient<Database>; // Use the Database type

// The `global` configuration block was removed from `createClient`.
// The previous configuration, `global: { headers: {} }`, was likely intended
// to prevent "TypeError: Failed to fetch" in sandboxed environments by removing
// potentially problematic default headers. However, this had the unintended
// side effect of also removing the 'Authorization' header managed by the Supabase
// client, causing authenticated requests to fail Row-Level Security policies.
// By removing this override, we restore the default client behavior, which correctly
// handles auth tokens. This change is necessary to fix the critical RLS issue.
try {
  // Initialize the Supabase client without the `global` headers override,
  // and apply the Database generic type for full type safety.
  const client = createClient<Database>(supabaseUrl, supabaseKey);

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
