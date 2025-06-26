import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpxomioaloqfrueikjcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweG9taW9hbG9xZnJ1ZWlramNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NjY2MTQsImV4cCI6MjA2NjE0MjYxNH0.VLo7EVAHrrnk2GkLcvrZV6p7mVOCwkMrGEyW_UxnSAc';

let supabaseExport: SupabaseClient;

try {
  const client = createClient(supabaseUrl, supabaseKey);
  // Check if the client and essential methods like 'from' are available.
  if (!client || typeof client.from !== 'function') {
    console.error("Supabase client initialization failed: 'from' method is missing or client is invalid.");
    throw new Error("Supabase client initialization failed. Check network connectivity to esm.sh or Supabase script loading.");
  }
  supabaseExport = client;
  console.log("Supabase client initialized and appears valid.");
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : String(e);
  console.error("Critical error during Supabase client initialization:", errorMessage, e);
  // Re-throw to make it clear that initialization failed and the app likely won't function.
  throw new Error(`Supabase client could not be initialized: ${errorMessage}`);
}

export const supabase = supabaseExport;