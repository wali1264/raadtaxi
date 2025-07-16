
import { supabase } from './supabase';
import { getDebugMessage } from '../utils/helpers';
import { Database } from '../types/supabase';

// This VAPID key must be provided as an environment variable during the build process.
// It is the public key corresponding to the private key used by your push notification server.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;

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
        if (!VAPID_PUBLIC_KEY) {
            const errorMessage = "VAPID Public Key is not defined. Please set the VAPID_PUBLIC_KEY environment variable in your build settings.";
            console.error(errorMessage);
            throw new Error(errorMessage);
        }

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging is not supported in this browser.');
            throw new Error('Push messaging is not supported in this browser.');
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();
            
            if (subscription === null) {
                console.log('User not subscribed, requesting permission...');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.warn('Permission for notifications was not granted.');
                    throw new Error('Permission for notifications was not granted by the user.');
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
            // Re-throw the error so the calling function can handle it.
            throw error;
        }
    }
};