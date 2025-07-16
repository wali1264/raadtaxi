// DEVELOPER NOTE: The application is failing because the 'chat_messages' table is missing in the database.
// To fix the "relation public.chat_messages does not exist" errors, please run the following SQL script
// in your Supabase project's SQL Editor. This will create the necessary table and security policies for the chat feature.
/*
-- 1. Create the chat_messages table
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

-- Add comments to the table and columns for clarity
COMMENT ON TABLE public.chat_messages IS 'Stores chat messages between passengers and drivers for a specific ride.';
COMMENT ON COLUMN public.chat_messages.sender_id IS 'The user who sent the message.';
COMMENT ON COLUMN public.chat_messages.receiver_id IS 'The user who should receive the message.';
COMMENT ON COLUMN public.chat_messages.is_read IS 'True if the receiver has read the message.';


-- 2. Enable Row Level Security (RLS) for the table
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
--    - Allow users to see messages they've sent or received.
--    - Allow users to send messages (insert new rows) only as themselves.
--    - Allow users to update messages only if they are the receiver (e.g., to mark as read).

-- Drop existing policies before creating new ones to avoid errors on re-runs
DROP POLICY IF EXISTS "Allow read for sender or receiver" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow insert for sender" ON public.chat_messages;
DROP POLICY IF EXISTS "Allow update for receiver" ON public.chat_messages;

-- Create SELECT policy
CREATE POLICY "Allow read for sender or receiver" ON public.chat_messages
FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Create INSERT policy
CREATE POLICY "Allow insert for sender" ON public.chat_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);

-- Create UPDATE policy
CREATE POLICY "Allow update for receiver" ON public.chat_messages
FOR UPDATE USING (
  auth.uid() = receiver_id
);

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
