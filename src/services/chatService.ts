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