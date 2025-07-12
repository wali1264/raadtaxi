import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Import the new types

const supabaseUrl = 'https://lpxomioaloqfrueikjcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweG9taW9hbG9xZnJ1ZWlramNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NjY2MTQsImV4cCI6MjA2NjE0MjYxNH0.VLo7EVAHrrnk2GkLcvrZV6p7mVOCwkMrGEyW_UxnSAc';

// Initialize the Supabase client.
// The default configuration correctly handles authentication tokens, which is
// essential for Row-Level Security (RLS) policies. Custom header configurations
// can sometimes strip the required 'Authorization' header, leading to RLS errors
// like the one observed. This simplified initialization ensures proper auth handling.
export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);
