
declare const Deno: any;

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

// --- Type Definitions ---
interface RideRequestPayload {
  id: string;
  passenger_name?: string | null;
  estimated_fare?: number | null;
  // These fields are read from the database, not the initial payload
  status?: string;
  origin_lat?: number;
  origin_lng?: number;
  broadcast_tier?: number;
  notified_driver_ids?: string[];
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

// ====================================================================================
// --- New Tiered Dispatch Logic Explanation ---
//
// This function now operates as a "Tier Processor" for ride requests.
// It's designed to be called in two scenarios:
//
// 1.  **On New Ride Request (Tier 0):** A database trigger on the `ride_requests` table
//     should call this function immediately after a new ride is inserted. The function
//     will process "Tier 0" – notifying the closest drivers.
//
// 2.  **For Pending Rides (Tier 1+):** A scheduler (like a Cron Job) should call this
//     function periodically (e.g., every 20-30 seconds). The function will find any
//     rides that are still 'pending' and escalate them to the next notification tier,
//     notifying drivers in a wider radius.
//
// ====================================================================================


// --- Tier Configuration (in meters) ---
const TIER_CONFIG = [
  { radius: 2000 },  // Tier 0: 2km radius
  { radius: 5000 },  // Tier 1: 5km radius
  { radius: 10000 }, // Tier 2: 10km radius
];


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
    const { record: ridePayload }: { record: RideRequestPayload } = await req.json();
    console.log(`Processing notification for ride request: ${ridePayload.id}`);

    // 1. Fetch the full, current state of the ride from the database
    const { data: rideFromDb, error: fetchError } = await supabaseAdmin
      .from('ride_requests')
      .select('*')
      .eq('id', ridePayload.id)
      .single();
    
    if (fetchError || !rideFromDb) {
      console.error(`Ride request ${ridePayload.id} not found or error fetching it.`, fetchError);
      return new Response(JSON.stringify({ error: `Ride request not found.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404,
      });
    }
    
    // 2. Check if the ride is still pending
    if (rideFromDb.status !== 'pending') {
      console.log(`Ride ${rideFromDb.id} is no longer pending (status: ${rideFromDb.status}). Halting notifications.`);
      return new Response(JSON.stringify({ message: "Ride no longer pending." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // 3. Determine the current tier and check if all tiers are exhausted
    const currentTierIndex = rideFromDb.broadcast_tier || 0;
    if (currentTierIndex >= TIER_CONFIG.length) {
      console.log(`All notification tiers exhausted for ride ${rideFromDb.id}.`);
      // Optional: Add logic here to automatically cancel the ride.
      // await supabaseAdmin.from('ride_requests').update({ status: 'no_drivers_available' }).eq('id', rideFromDb.id);
      return new Response(JSON.stringify({ message: "All tiers exhausted." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    
    const currentTier = TIER_CONFIG[currentTierIndex];
    const previouslyNotified = rideFromDb.notified_driver_ids || [];

    // 4. Find nearby drivers for the current tier using the new database function
    console.log(`Finding drivers for Tier ${currentTierIndex} (radius: ${currentTier.radius}m)`);
    const { data: nearbyDrivers, error: rpcError } = await supabaseAdmin
      .rpc('find_nearby_online_drivers', {
        origin_lat: rideFromDb.origin_lat,
        origin_lng: rideFromDb.origin_lng,
        radius_meters: currentTier.radius,
        excluded_driver_ids: previouslyNotified,
      });

    if (rpcError) throw rpcError;

    // 5. Process the found drivers
    if (!nearbyDrivers || nearbyDrivers.length === 0) {
      console.log(`No new drivers found in Tier ${currentTierIndex} for ride ${rideFromDb.id}.`);
      // Even if no new drivers are found, we increment the tier to ensure the cron job
      // doesn't get stuck processing the same empty tier repeatedly.
      await supabaseAdmin.from('ride_requests').update({
        broadcast_tier: rideFromDb.broadcast_tier + 1,
        last_broadcast_at: new Date().toISOString(),
      }).eq('id', rideFromDb.id);

      return new Response(JSON.stringify({ message: "No new drivers found in this tier." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const newDriverIds = nearbyDrivers.map(d => d.user_id);
    console.log(`Found ${newDriverIds.length} new drivers to notify.`);
    
    // 6. Fetch push subscriptions for the new drivers
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', newDriverIds);

    if (subError) throw subError;

    // 7. Send Notifications
    if (subscriptions && subscriptions.length > 0) {
      const notificationPayload = JSON.stringify({
        title: 'درخواست سفر جدید!',
        body: `کرایه: ${rideFromDb.estimated_fare ? Math.round(rideFromDb.estimated_fare) : 'نامشخص'} افغانی`,
        icon: '/assets/ra-ad-logo.png',
        badge: '/assets/ra-ad-logo.png',
        data: { url: Deno.env.get('SITE_URL') || SUPABASE_URL },
      });

      const sendPromises = subscriptions.map(({ subscription }) => {
        if (subscription && typeof subscription === 'object' && 'endpoint' in subscription) {
          return webpush.sendNotification(subscription as PushSubscription, notificationPayload)
            .catch(err => console.error(`Failed to send notification. Error: ${err.message}`));
        }
        return Promise.resolve();
      });
      await Promise.all(sendPromises);
      console.log(`Attempted to send notifications to ${subscriptions.length} subscriptions.`);
    }

    // 8. Update the ride request with the new state
    const allNotifiedIds = [...new Set([...previouslyNotified, ...newDriverIds])];
    await supabaseAdmin.from('ride_requests').update({
        notified_driver_ids: allNotifiedIds,
        broadcast_tier: rideFromDb.broadcast_tier + 1,
        last_broadcast_at: new Date().toISOString(),
    }).eq('id', rideFromDb.id);


    return new Response(JSON.stringify({ message: `Successfully notified ${newDriverIds.length} new drivers.` }), {
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
