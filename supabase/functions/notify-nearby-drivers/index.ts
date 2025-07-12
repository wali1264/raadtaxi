// File: supabase/functions/notify-nearby-drivers/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

// Type Definitions for Clarity
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

// Initialize VAPID Details from Environment Secrets
const VAPID_PUBLIC_KEY = 'BL1_3Yq81F_yFm9Q4PLOUvA7U0m1dK2H8U91e1i_M3oA6KzXN1JqV2K2F-hZ7X3S4W1J8C6I0J1o8s';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

if (!VAPID_PRIVATE_KEY) {
  console.error("VAPID_PRIVATE_KEY is not set in environment variables. Function will fail.");
} else {
    webpush.setVapidDetails(
      'mailto:raadtaxi5@gmail.com', // ✅ ایمیل شما
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
}

// Main Serverless Function
Deno.serve(async (req) => {
  try {
    if (!VAPID_PRIVATE_KEY) {
      throw new Error("VAPID private key is not configured in Supabase secrets.");
    }
    
    const { record: ride }: { record: RideRequestPayload } = await req.json();

    // Create an admin Supabase client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // This is a simplified query. For production, you'd use PostGIS 
    // to find drivers within a radius of the ride's origin.
    const { data: onlineDrivers, error: driverError } = await supabaseAdmin
      .from('drivers_profile')
      .select('user_id')
      .eq('current_status', 'online');

    if (driverError) throw driverError;
    if (!onlineDrivers || onlineDrivers.length === 0) {
      console.log("No online drivers to notify.");
      return new Response(JSON.stringify({ message: "No online drivers." }), { status: 200 });
    }
    
    const driverIds = onlineDrivers.map(d => d.user_id);
    
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', driverIds);

    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
        return new Response(JSON.stringify({ message: "No push subscriptions for online drivers." }), { status: 200 });
    }
    
    const notificationPayload = JSON.stringify({
      title: 'درخواست سفر جدید!',
      body: `کرایه: ${ride.estimated_fare ? Math.round(ride.estimated_fare) : 'نامشخص'} افغانی`,
      icon: '/assets/ra-ad-logo.png'
    });

    // Send all notifications in parallel
    const sendPromises = subscriptions.map(({ subscription }) => 
      webpush.sendNotification(subscription as PushSubscription, notificationPayload)
        .catch(err => console.error(`Failed to send notification: ${err.message}`)) // Log errors without stopping others
    );

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ message: "Notifications sent successfully." }), {
         headers: { "Content-Type": "application/json" }, status: 200 
    });

  } catch (error) {
    console.error('Error in Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
        headers: { "Content-Type": "application/json" }, status: 500 
    });
  }
});


