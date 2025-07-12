import { supabase } from './supabase';
import { getDebugMessage } from '../utils/helpers';
import { Database } from '../types/supabase';

// This is a public key, safe to be exposed on the client.
const VAPID_PUBLIC_KEY = 'BL1_3Yq81F_yFm9Q4PLOUvA7U0m1dK2H8U91e1i_M3oA6KzXN1JqV2K2F-hZ7X3S4W1J8C6I0J1o8s';

/**
 * Converts a VAPID key from a URL-safe base64 string to a Uint8Array.
 * This is required by the Push API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const notificationService = {
    /**
     * Subscribes the user to push notifications if they aren't already subscribed.
     * It requests permission if needed and saves the subscription to the database.
     * @param userId The ID of the currently logged-in user.
     */
    async subscribeUser(userId: string): Promise<void> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported in this browser.');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            
            if (subscription === null) {
                console.log('User not subscribed, requesting permission...');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.warn('Permission for notifications was not granted.');
                    return; // Exit if permission is denied.
                }

                const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });
                console.log('User subscribed successfully.');
            } else {
                console.log('User is already subscribed.');
            }

            const subJSON = subscription.toJSON();
            
            // Check if this specific subscription endpoint already exists for this user to avoid duplicates
            const { data, error: selectError } = await supabase
                .from('push_subscriptions')
                .select('id')
                .eq('user_id', userId)
                .eq('subscription->>endpoint', subJSON.endpoint)
                .single();

            if (selectError && selectError.code !== 'PGRST116') { // PGRST116 means "No rows found", which is not an error here.
                console.error("Error checking for existing subscription:", getDebugMessage(selectError));
                return;
            }

            if (!data) { // No existing subscription found, so insert it.
                console.log('Saving new push subscription to DB.');
                const payload: Database['public']['Tables']['push_subscriptions']['Insert'] = {
                    user_id: userId,
                    subscription: subJSON as any,
                };
                const { error: insertError } = await supabase.from('push_subscriptions').insert([payload] as any);
                if (insertError) {
                    console.error("Error saving push subscription:", getDebugMessage(insertError));
                }
            } else {
                console.log('This push subscription is already saved in the DB.');
            }

        } catch (error) {
            console.error('Failed to subscribe the user: ', getDebugMessage(error));
        }
    }
};