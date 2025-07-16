
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Import the new types

const supabaseUrl = 'https://lpxomioaloqfrueikjcc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxweG9taW9hbG9xZnJ1ZWlramNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NjY2MTQsImV4cCI6MjA2NjE0MjYxNH0.VLo7EVAHrrnk2GkLcvrZV6p7mVOCwkMrGEyW_UxnSAc';

// Initialize the Supabase client.
// We separate the creation and the type assertion to work around potential
// complex type inference issues that can arise with large, generated database types.
const client = createClient(supabaseUrl, supabaseKey);
export const supabase = client as SupabaseClient<Database>;
