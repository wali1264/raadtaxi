import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { supabase } from '../services/supabase';
import { ChatMessage } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { chatService } from '../services/chatService';
import { CloseIcon } from './icons/CloseIcon';
import { getDebugMessage } from '../utils/helpers';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    rideRequestId: string;
    otherPartyName: string;
    otherPartyId: string;
}

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, rideRequestId, otherPartyName, otherPartyId }) => {
    const { t, currentLang, loggedInUserId, showToast } = useAppContext();
    const isRTL = currentLang !== 'en';
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && rideRequestId && loggedInUserId) {
            const setupChat = async () => {
                setIsLoading(true);
                setError(null);

                try {
                    const initialMessages = await chatService.getMessagesForRide(rideRequestId);
                    setMessages(initialMessages);
                    await chatService.markMessagesAsRead(rideRequestId, loggedInUserId);
                } catch (e: any) {
                    const errorMessage = getDebugMessage(e);
                    if (errorMessage.includes('relation "public.chat_messages" does not exist')) {
                        setError(t.errorChatTableMissing);
                    } else {
                        setError(t.errorLoadingChat);
                    }
                    console.error("Failed to fetch initial messages:", errorMessage, e);
                } finally {
                    setIsLoading(false);
                }

                if (realtimeChannelRef.current) {
                    supabase.removeChannel(realtimeChannelRef.current);
                }
                
                realtimeChannelRef.current = supabase
                    .channel(`chat_${rideRequestId}`)
                    .on<ChatMessage>(
                        'postgres_changes',
                        {
                            event: 'INSERT',
                            schema: 'public',
                            table: 'chat_messages',
                            filter: `ride_request_id=eq.${rideRequestId}`,
                        },
                        async (payload) => {
                            const receivedMessage = payload.new as ChatMessage;

                            setMessages(currentMessages => {
                                // If the message is from the current user, it's the confirmation of our optimistic update.
                                if (receivedMessage.sender_id === loggedInUserId) {
                                    let tempMessageFound = false;
                                    // Replace the temporary message with the real one from the DB.
                                    const updatedMessages = currentMessages.map(msg => {
                                        if (msg.id.startsWith('temp_') && !tempMessageFound) {
                                            tempMessageFound = true;
                                            return receivedMessage;
                                        }
                                        return msg;
                                    });

                                    // If no temp message was replaced (e.g., message sent from another device),
                                    // and the message isn't already in the list, add it.
                                    if (!tempMessageFound && !updatedMessages.some(m => m.id === receivedMessage.id)) {
                                        return [...updatedMessages, receivedMessage];
                                    }
                                    
                                    return updatedMessages;

                                } else { // This is a message from the other party.
                                    // Just add it if it doesn't already exist.
                                    if (currentMessages.some(m => m.id === receivedMessage.id)) {
                                        return currentMessages;
                                    }
                                    return [...currentMessages, receivedMessage];
                                }
                            });
    
                            // Mark as read if it's an incoming message for us.
                            if (receivedMessage.receiver_id === loggedInUserId) {
                                await chatService.markMessagesAsRead(rideRequestId, loggedInUserId);
                            }
                        }
                    )
                    .subscribe((status, err) => {
                        if (status === 'CHANNEL_ERROR') {
                            console.error("Realtime subscription failed:", getDebugMessage(err), err);
                            setError(t.errorChatConnection);
                        }
                    });
            };

            setupChat();
        }

        return () => {
            if (realtimeChannelRef.current) {
                supabase.removeChannel(realtimeChannelRef.current);
                realtimeChannelRef.current = null;
            }
        };
    }, [isOpen, rideRequestId, loggedInUserId, t.errorChatTableMissing, t.errorLoadingChat, t.errorChatConnection]);

    useEffect(scrollToBottom, [messages]);
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !loggedInUserId || !rideRequestId || !otherPartyId) {
             if(!otherPartyId) setError("Cannot determine message recipient.");
             return;
        }

        const messagePayload = {
            ride_request_id: rideRequestId,
            sender_id: loggedInUserId,
            receiver_id: otherPartyId,
            message_text: newMessage.trim(),
        };

        const optimisticMessage: ChatMessage = {
            ...messagePayload,
            id: `temp_${Date.now()}`,
            created_at: new Date().toISOString(),
            is_read: false,
        };
        
        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');
        
        try {
            await chatService.sendMessage(messagePayload);
        } catch (e) {
            setError(t.errorSendingMessage);
            setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
            setNewMessage(messagePayload.message_text);
            console.error("Failed to send message:", getDebugMessage(e), e);
        }
    };


    if (!isOpen) return null;

    const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1400, padding: '1rem' };
    const modalStyle: CSSProperties = { backgroundColor: 'white', borderRadius: '1rem 1rem 0 0', width: '100%', maxWidth: '450px', height: '80vh', maxHeight: '600px', display: 'flex', flexDirection: 'column', boxShadow: '0 -5px 15px rgba(0,0,0,0.1)', transform: isOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 0.3s ease-out' };
    const headerStyle: CSSProperties = { padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 };
    const titleStyle: CSSProperties = { margin: 0, fontSize: '1.1rem', fontWeight: 600 };
    const closeButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer' };
    const messagesContainerStyle: CSSProperties = { flexGrow: 1, overflowY: 'auto', padding: '1rem', backgroundColor: '#f7fafc' };
    const messageBubbleStyle = (isSender: boolean): CSSProperties => ({
        maxWidth: '75%',
        padding: '0.5rem 0.75rem',
        borderRadius: '1rem',
        marginBottom: '0.5rem',
        wordWrap: 'break-word',
        backgroundColor: isSender ? '#3182ce' : '#e2e8f0',
        color: isSender ? 'white' : 'black',
        alignSelf: isSender ? 'flex-end' : 'flex-start',
        [isSender ? (isRTL ? 'borderBottomLeftRadius' : 'borderBottomRightRadius') : (isRTL ? 'borderBottomRightRadius' : 'borderBottomLeftRadius')]: '0.25rem',
    });
    const messagesListStyle: CSSProperties = { display: 'flex', flexDirection: 'column' };
    const inputFormStyle: CSSProperties = { display: 'flex', padding: '1rem', borderTop: '1px solid #e2e8f0', flexShrink: 0, gap: '0.5rem' };
    const inputStyle: CSSProperties = { flexGrow: 1, padding: '0.75rem', border: '1px solid #cbd5e0', borderRadius: '1.5rem', outline: 'none' };
    const sendButtonStyle: CSSProperties = { padding: '0.75rem 1.25rem', border: 'none', backgroundColor: '#3182ce', color: 'white', borderRadius: '1.5rem', cursor: 'pointer' };
    const infoTextStyle: CSSProperties = { textAlign: 'center', color: '#718096', padding: '2rem 1rem' };


    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <header style={headerStyle}>
                    <h2 style={titleStyle}>{t.chatModalTitle.replace('{name}', otherPartyName)}</h2>
                    <button style={closeButtonStyle} onClick={onClose} aria-label={t.closeButton}><CloseIcon /></button>
                </header>
                <div style={messagesContainerStyle}>
                    {isLoading && <p style={infoTextStyle}>{t.loadingMessages}</p>}
                    {error && <p style={{...infoTextStyle, color: 'red'}}>{error}</p>}
                    {!isLoading && !error && messages.length === 0 && <p style={infoTextStyle}>{t.noMessagesYet}</p>}
                    <div style={messagesListStyle}>
                        {messages.map(msg => (
                            <div key={msg.id} style={messageBubbleStyle(msg.sender_id === loggedInUserId)}>
                                {msg.message_text}
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>
                </div>
                <form style={inputFormStyle} onSubmit={handleSendMessage}>
                    <input type="text" style={inputStyle} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={t.chatInputPlaceholder} aria-label={t.chatInputPlaceholder}/>
                    <button type="submit" style={sendButtonStyle} disabled={!newMessage.trim()}>{t.sendButton}</button>
                </form>
            </div>
        </div>
    );
};