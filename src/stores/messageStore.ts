/**
 * Message Store - Manages messages locally (matches Kotlin approach)
 * 
 * Key insight from Kotlin app: Badge updates work because:
 * 1. Messages are stored in LOCAL state (mutableStateMapOf)
 * 2. When marking as read, LOCAL state is updated with read_at timestamp
 * 3. Unread count is calculated from LOCAL state, not server fetch
 * 4. Socket events update LOCAL state directly
 */

import { create } from 'zustand';
import { socketService } from '../services/SocketService';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  sent_at?: string;
  created_at?: string;
  delivered_at?: string;
  read_at?: string | null;
}

interface MessageState {
  // Messages grouped by conversation partner ID (like Kotlin's mutableStateMapOf)
  messages: Record<string, Message[]>;
  
  // Current user ID (needed to calculate unread counts)
  currentUserId: string | null;
  
  // Current chat user ID (to suppress badge updates for active chat)
  currentChatUserId: string | null;
  
  // Actions
  setCurrentUserId: (userId: string | null) => void;
  
  // Set which chat is currently open (to prevent badge increment for that chat)
  setCurrentChatUserId: (userId: string | null) => void;
  
  // Set messages for a conversation (from API)
  setMessages: (conversationPartnerId: string, messages: Message[]) => void;
  
  // Add a new message to a conversation
  addMessage: (conversationPartnerId: string, message: Message) => void;
  
  // Mark all messages FROM a user as read (LOCAL UPDATE - instant!)
  markMessagesAsRead: (senderId: string) => void;
  
  // Mark specific message IDs as read (from socket event)
  markMessageIdsAsRead: (messageIds: string[], readAt: string) => void;
  
  // Get messages for a conversation
  getMessages: (conversationPartnerId: string) => Message[];
  
  // Check if we have messages loaded for a conversation (to know if local count is valid)
  hasMessages: (conversationPartnerId: string) => boolean;
  
  // Calculate unread count for a specific conversation (FROM local state!)
  // Returns -1 if no messages loaded (use API count instead)
  getUnreadCount: (conversationPartnerId: string) => number;
  
  // Calculate TOTAL unread count across all conversations (for badge)
  getTotalUnreadCount: () => number;
  
  // Clear all messages (on logout)
  clearAll: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  currentUserId: null,
  currentChatUserId: null,
  
  setCurrentUserId: (userId) => {
    set({ currentUserId: userId });
  },
  
  setCurrentChatUserId: (userId) => {
    set({ currentChatUserId: userId });
  },
  
  setMessages: (conversationPartnerId, messages) => {
    const state = get();
    const existingMessages = state.messages[conversationPartnerId] || [];
    
    // CRITICAL: Don't overwrite existing messages with empty array!
    // This prevents race conditions where a failed API call clears local state
    if (messages.length === 0 && existingMessages.length > 0) {
      return;
    }
    
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationPartnerId]: messages,
      },
    }));
  },
  
  addMessage: (conversationPartnerId, message) => {
    set((state) => {
      const existingMessages = state.messages[conversationPartnerId] || [];
      
      // Check if message already exists (prevent duplicates)
      if (existingMessages.some(m => m.id === message.id)) {
        return state;
      }
      
      return {
        messages: {
          ...state.messages,
          [conversationPartnerId]: [...existingMessages, message].sort(
            (a, b) => new Date(a.sent_at || a.created_at || 0).getTime() - 
                      new Date(b.sent_at || b.created_at || 0).getTime()
          ),
        },
      };
    });
  },
  
  // KEY METHOD: Mark messages as read LOCALLY (instant update!)
  // This matches Kotlin's: messages = messages.mapValues { ... msg.copy(readAt = readInstant) }
  markMessagesAsRead: (senderId) => {
    const state = get();
    const currentUserId = state.currentUserId;
    if (!currentUserId) {
      return;
    }
    
    const conversationMessages = state.messages[senderId] || [];
    
    if (conversationMessages.length === 0) {
      return;
    }
    
    const readAt = new Date().toISOString();
    let updatedCount = 0;
    
    const updatedMessages = conversationMessages.map((msg) => {
      // Mark messages FROM sender (to me) as read
      if (msg.sender_id === senderId && !msg.read_at) {
        updatedCount++;
        return { ...msg, read_at: readAt };
      }
      return msg;
    });
    
    if (updatedCount > 0) {
      set((state) => ({
        messages: {
          ...state.messages,
          [senderId]: updatedMessages,
        },
      }));
    }
  },
  
  // Handle messagesRead socket event (from server)
  markMessageIdsAsRead: (messageIds, readAt) => {
    set((state) => {
      const newMessages = { ...state.messages };
      let totalUpdated = 0;
      
      // Update all conversations
      Object.keys(newMessages).forEach((conversationId) => {
        newMessages[conversationId] = newMessages[conversationId].map((msg) => {
          if (messageIds.includes(msg.id) && !msg.read_at) {
            totalUpdated++;
            return { ...msg, read_at: readAt };
          }
          return msg;
        });
      });
      
      return { messages: newMessages };
    });
  },
  
  getMessages: (conversationPartnerId) => {
    return get().messages[conversationPartnerId] || [];
  },
  
  // Check if we have messages loaded for this conversation
  hasMessages: (conversationPartnerId) => {
    const state = get();
    return conversationPartnerId in state.messages;
  },
  
  // Calculate unread count from LOCAL state (like Kotlin does!)
  // Returns -1 if no messages loaded for this conversation (use API count instead)
  getUnreadCount: (conversationPartnerId) => {
    const state = get();
    const currentUserId = state.currentUserId;
    if (!currentUserId) return -1; // Not initialized
    
    // If we don't have messages for this conversation, return -1 to signal "use API count"
    if (!(conversationPartnerId in state.messages)) {
      return -1;
    }
    
    const conversationMessages = state.messages[conversationPartnerId];
    
    // Count messages FROM the partner that are unread
    // Kotlin: messages[thread.user2Id]?.count { message -> message.senderId == thread.user2Id && message.readAt == null }
    return conversationMessages.filter(
      (msg) => msg.sender_id === conversationPartnerId && !msg.read_at
    ).length;
  },
  
  // Calculate TOTAL unread count for badge (from LOCAL state!)
  getTotalUnreadCount: () => {
    const state = get();
    const currentUserId = state.currentUserId;
    if (!currentUserId) return 0;
    
    let total = 0;
    Object.entries(state.messages).forEach(([conversationPartnerId, messages]) => {
      // Count messages FROM each partner that are unread
      const unread = messages.filter(
        (msg) => msg.sender_id === conversationPartnerId && !msg.read_at
      ).length;
      total += unread;
    });
    
    return total;
  },
  
  clearAll: () => {
    set({ messages: {}, currentUserId: null });
  },
}));

// Initialize socket listeners for real-time updates
let socketListenersInitialized = false;

export const initMessageStoreSocketListeners = () => {
  if (socketListenersInitialized) return;
  socketListenersInitialized = true;
  
  // Listen for new messages
  socketService.on('new_message', (data: any) => {
    const senderId = data?.sender_id || data?.senderId;
    if (!senderId) return;
    
    const message: Message = {
      id: data.id || data.messageId || `msg-${Date.now()}`,
      sender_id: senderId,
      receiver_id: data.receiver_id || data.receiverId || '',
      content: data.content || data.message || '',
      sent_at: data.sent_at || data.timestamp || new Date().toISOString(),
      read_at: null,
    };
    
    useMessageStore.getState().addMessage(senderId, message);
  });
  
  // Listen for messages being read (from other device or sync)
  socketService.on('messagesRead', (data: any) => {
    const messageIds = data?.messageIds || data?.message_ids || [];
    const readAt = data?.readAt || data?.read_at || new Date().toISOString();
    
    if (messageIds.length > 0) {
      useMessageStore.getState().markMessageIdsAsRead(messageIds, readAt);
    }
  });
};
