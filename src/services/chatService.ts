// DEVELOPER NOTE: The application is failing because the 'chat_messages' table is missing.
// To fix this, run one of the SQL scripts below in your Supabase SQL Editor.

// --- SCRIPT 1: SAFER, NON-DESTRUCTIVE (Recommended for first-time setup) ---
// This script avoids using DROP commands and should not trigger Supabase's "destructive query" warning.
// IMPORTANT: This script can only be run successfully ONCE. If you need to re-run it,
// you must manually delete the 'chat_messages' table and its policies from the Supabase UI first,
// or use Script 2 below.
/*
-- 1. Create the chat_messages table
CREATE TABLE public.chat_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    ride_request_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    message_text text NOT NULL CHECK (char_length(message_text) > 0),
    is_read boolean NOT NULL DEFAULT false,
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT chat_messages_ride_request_id_fkey FOREIGN KEY (ride_request_id) REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Add comments for clarity
COMMENT ON TABLE public.chat_messages IS 'Stores chat messages between passengers and drivers for a specific ride.';
COMMENT ON COLUMN public.chat_messages.sender_id IS 'The user who sent the message.';
COMMENT ON COLUMN public.chat_messages.receiver_id IS 'The user who should receive the message.';
COMMENT ON COLUMN public.chat_messages.is_read IS 'True if the receiver has read the message.';

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for secure access
CREATE POLICY "Allow read for sender or receiver" ON public.chat_messages
FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

CREATE POLICY "Allow insert for sender" ON public.chat_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);

CREATE POLICY "Allow update for receiver" ON public.chat_messages
FOR UPDATE USING (
  auth.uid() = receiver_id
);
*/


// --- SCRIPT 2: ROBUST, RE-RUNNABLE (May trigger a "destructive" warning) ---
// This script includes DROP commands, which makes it easy to re-run without errors.
// Supabase flags this as "destructive" as a safety measure. You can safely
// confirm and run it if you understand it's just refreshing the policies.
/*
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    ride_request_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    message_text text NOT NULL CHECK (char_length(message_text) > 0),
    is_read boolean NOT NULL DEFAULT false,
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT chat_messages_ride_request_id_fkey FOREIGN KEY (ride_request_id) REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.chat_messages IS 'Stores chat messages between passengers and drivers for a specific ride.';
COMMENT ON COLUMN public.chat_messages.sender_id IS 'The user who sent the message.';
COMMENT ON COLUMN public.chat_messages.receiver_id IS 'The user who should receive the message.';
COMMENT ON COLUMN public.chat_messages.is_read IS 'True if the receiver has read the message.';
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for sender or receiver" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow insert for sender" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow update for receiver" ON public.chat_messages;
CREATE POLICY "Allow read for sender or receiver" ON public.chat_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Allow insert for sender" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Allow update for receiver" ON public.chat_messages FOR UPDATE USING (auth.uid() = receiver_id);
*/


import { supabase } from './supabase';
import { ChatMessage } from '../types';
import { getDebugMessage } from '../utils/helpers';
import { Database } from '../types/supabase';

export const chatService = {
  async getMessagesForRide(rideRequestId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('ride_request_id', rideRequestId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("ChatService: Error fetching messages -", getDebugMessage(error), error);
      throw error;
    }

    return data as ChatMessage[];
  },

  async sendMessage(message: Omit<ChatMessage, 'id' | 'created_at' | 'is_read'>): Promise<ChatMessage> {
    const payload: Database['public']['Tables']['chat_messages']['Insert'] = message;
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([payload])
      .select()
      .single();

    if (error || !data) {
      console.error("ChatService: Error sending message -", getDebugMessage(error), error);
      throw error || new Error("Failed to send message: No data returned.");
    }

    return data as ChatMessage;
  },
  
  async markMessagesAsRead(rideRequestId: string, readerId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('ride_request_id', rideRequestId)
      .eq('receiver_id', readerId)
      .eq('is_read', false);
      
    if (error) {
        console.warn("ChatService: Could not mark messages as read -", getDebugMessage(error), error);
    }
  }
};