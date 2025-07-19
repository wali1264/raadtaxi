
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; // Import the new types

const supabaseUrl = 'https://cxqqpydtmdzecwdawrnj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4cXFweWR0bWR6ZWN3ZGF3cm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI5MDMyNzEsImV4cCI6MjA2ODQ3OTI3MX0.822ub5m5jxolfrD4PGjhp9Y2Bu0gzMqlbIxrgBcEzcY';

// Initialize the Supabase client.
// The default configuration correctly handles authentication tokens, which is
// essential for Row-Level Security (RLS) policies. Custom header configurations
// can sometimes strip the required 'Authorization' header, leading to RLS errors
// like the one observed. This simplified initialization ensures proper auth handling.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);