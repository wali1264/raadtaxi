// File: supabase/functions/notify-nearby-drivers/index.ts

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

// --- Type Definitions ---
interface RideRequestPayload {
  id: string;
  passenger_name?: string | null;
  estimated_fare?: number | null;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// --- CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Main Function ---
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Environment Variable Validation ---
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables/secrets in Supabase.');
      throw new Error("Server configuration error: Missing VAPID keys or Supabase credentials.");
    }
    
    // --- Initialize Services ---
    webpush.setVapidDetails('mailto:raadtaxi5@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Process Request ---
    const { record: ride }: { record: RideRequestPayload } = await req.json();
    console.log(`Processing notification for ride request: ${ride.id}`);

    // --- Fetch Online Drivers ---
    // In a real-world scenario, this would be a PostGIS geospatial query.
    // e.g., using st_dwithin to find drivers in a radius around the ride's origin.
    const { data: onlineDrivers, error: driverError } = await supabaseAdmin
      .from('drivers_profile')
      .select('user_id')
      .eq('current_status', 'online');

    if (driverError) throw driverError;

    if (!onlineDrivers || onlineDrivers.length === 0) {
      console.log("No online drivers found. No notifications sent.");
      return new Response(JSON.stringify({ message: "No online drivers available to notify." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const driverIds = onlineDrivers.map(d => d.user_id);
    console.log(`Found ${driverIds.length} online drivers to potentially notify.`);

    // --- Fetch Push Subscriptions for Online Drivers ---
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', driverIds);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for any online drivers.");
      return new Response(JSON.stringify({ message: "Online drivers found, but none have active push subscriptions." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- Prepare and Send Notifications ---
    const notificationPayload = JSON.stringify({
      title: 'درخواست سفر جدید!',
      body: `کرایه: ${ride.estimated_fare ? Math.round(ride.estimated_fare) : 'نامشخص'} افغانی`,
      icon: '/assets/ra-ad-logo.png',
      badge: '/assets/ra-ad-logo.png',
      data: {
        url: Deno.env.get('SITE_URL') || SUPABASE_URL, // Fallback to supabase url
      },
    });

    const sendPromises = subscriptions.map(({ subscription }) => {
      if (subscription && typeof subscription === 'object' && 'endpoint' in subscription) {
        return webpush.sendNotification(subscription as PushSubscription, notificationPayload)
          .catch(err => {
            // Log specific errors, e.g., "410 Gone" means subscription is expired and should be deleted.
            console.error(`Failed to send notification to ${ (subscription as PushSubscription).endpoint.substring(0, 50) }... Error: ${err.message}`);
            // In a production app, you would add logic here to delete expired subscriptions.
          });
      }
      return Promise.resolve(); // Skip invalid subscription entries
    });

    await Promise.all(sendPromises);
    console.log(`Attempted to send notifications to ${subscriptions.length} subscriptions.`);

    return new Response(JSON.stringify({ message: "Notifications sent successfully." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Critical error in Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});