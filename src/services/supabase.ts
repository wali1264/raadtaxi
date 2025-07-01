import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpxomioaloqfrueikjcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweG9taW9hbG9xZnJ1ZWlramNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NjY2MTQsImV4cCI6MjA2NjE0MjYxNH0.VLo7EVAHrrnk2GkLcvrZV6p7mVOCwkMrGEyW_UxnSAc';

let supabaseExport: SupabaseClient;

// The customFetch wrapper and custom User-Agent header were previously removed
// as they can cause "TypeError: Failed to fetch" in certain sandboxed browser environments.
// To further guard against this, we are explicitly configuring the client to ensure
// no unexpected environmental defaults are picked up.

try {
  // Initialize the Supabase client with an explicit, empty headers object.
  // This helps ensure that no problematic default headers are being added by the
  // environment, which can resolve "Failed to fetch" errors. The supabase-js
  // library will still correctly add its own necessary 'apikey' and 'Authorization' headers.
  const client = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {}
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