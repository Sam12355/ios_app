import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { socketService } from '../../services/SocketService';
import { notificationService } from '../../services/NotificationService';
import { localNotificationService } from '../../services/LocalNotificationService';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';

// API config for online status (fallback)
const API_BASE_URL = 'https://stock-nexus-84-main-2-1.onrender.com/api';
const TOKEN_KEY = '@stocknexus_access_token';

const debugLog = (...args: any[]) => {
  if (__DEV__) console.log(...args);
};

const debugWarn = (...args: any[]) => {
  if (__DEV__) console.warn(...args);
};

// Cache keys for AsyncStorage
const CACHE_KEYS = {
  MESSAGES: (userId: string) => `@chat_messages_${userId}`,
  USER_PROFILE: (userId: string) => `@user_profile_${userId}`,
  ONLINE_STATUS: (userId: string) => `@online_status_${userId}`,
};

// Cache expiry times
const CACHE_EXPIRY = {
  MESSAGES: 5 * 60 * 1000, // 5 minutes
  USER_PROFILE: 30 * 60 * 1000, // 30 minutes
  ONLINE_STATUS: 60 * 1000, // 1 minute
};

// Message interface matching Kotlin
interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  sent_at?: string;
  created_at?: string;
  delivered_at?: string;
  read_at?: string;
}

type ChatRouteParams = {
  Chat: {
    userId: string;
    userName?: string;
    userPhoto?: string;
  };
};

// Typing indicator dots animation
const TypingDots: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    };
    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, []);

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
      <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
      <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
    </View>
  );
};

// Message bubble component matching Kotlin MessageBubble - memoized for performance
const MessageBubble: React.FC<{ message: ChatMessage; isFromCurrentUser: boolean }> = React.memo(({
  message,
  isFromCurrentUser,
}) => {
  // Current user messages: LEFT side, WHITE bubble, BLACK text
  // Other person's messages: RIGHT side, BLUE bubble, WHITE text
  const bubbleColor = isFromCurrentUser ? '#FFFFFF' : '#0084FF';
  const textColor = isFromCurrentUser ? '#000000' : '#FFFFFF';

  const formatTime = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Debug: Log read status for the message (only for current user's messages)
  // This helps verify if read_at is properly set
  if (isFromCurrentUser && message.read_at) {
    debugLog('[MessageBubble] ✓✓ Message has read_at:', message.id?.substring(0, 8), message.read_at);
  }

  return (
    <View style={[styles.messageRow, isFromCurrentUser ? styles.messageRowLeft : styles.messageRowRight]}>
      <View
        style={[
          styles.messageBubble,
          { backgroundColor: bubbleColor },
          isFromCurrentUser ? styles.bubbleLeft : styles.bubbleRight,
        ]}
      >
        <Text style={[styles.messageText, { color: textColor }]}>{message.content}</Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, { color: textColor, opacity: 0.7 }]}>
            {formatTime(message.sent_at || message.created_at)}
          </Text>
          {/* Read receipts for sent messages only */}
          {isFromCurrentUser && (
            <View style={styles.receiptContainer}>
              {message.read_at ? (
                <Text style={styles.receiptRead}>✓✓</Text>
              ) : message.delivered_at ? (
                <Text style={styles.receiptDelivered}>✓</Text>
              ) : (
                <Text style={styles.receiptSent}>✓</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to ensure re-render when read_at changes
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content &&
         prevProps.message.read_at === nextProps.message.read_at &&
         prevProps.message.delivered_at === nextProps.message.delivered_at &&
         prevProps.isFromCurrentUser === nextProps.isFromCurrentUser;
}); // End of React.memo(MessageBubble)

export const ChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { profile: currentUser } = useAuthStore();
  // Get message store actions and state
  const { setMessages: setStoreMessages, markMessagesAsRead, setCurrentUserId, setCurrentChatUserId } = useMessageStore();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ChatRouteParams, 'Chat'>>();
  const isFocused = useIsFocused(); // Check if this screen is currently focused
  const isFocusedRef = useRef(isFocused);
  // If a `messagesRead` socket event arrives before we receive/replace the server message ID
  // (e.g. we still have a `temp-...` optimistic message), buffer read-at by ID.
  const pendingReadAtByMessageIdRef = useRef<Map<string, string>>(new Map());
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { userId, userName, userPhoto } = route.params || {};

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]); // All messages from API
  const [displayCount, setDisplayCount] = useState(20); // Show 20 initially
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false); // Other user typing
  const [showProfileImage, setShowProfileImage] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  
  // Set current user ID in message store when it becomes available
  useEffect(() => {
    if (currentUser?.id) {
      setCurrentUserId(currentUser.id);
    }
  }, [currentUser?.id, setCurrentUserId]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);
  
  // CRITICAL: Stack navigators keep screens mounted; we must clear on BLUR, not just unmount.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      debugLog('[ChatScreen] 📍 Focused - setting current chat to:', userId);
      setCurrentChatUserId(userId);
      notificationService.setCurrentChatUserId(userId);
      localNotificationService.setCurrentChatUserId(userId);

      // OPTIMISTIC UPDATE: Clear unread cache immediately so badge updates instantly
      apiClient.clearUnreadCountCache();
      debugLog('[ChatScreen] 📬 Opened chat - optimistically clearing badge');

      return () => {
        debugLog('[ChatScreen] 📍 Blurred - clearing current chat');
        setCurrentChatUserId(null);
        notificationService.setCurrentChatUserId(null);
        localNotificationService.setCurrentChatUserId(null);
      };
    }, [userId, setCurrentChatUserId])
  );

  const fetchMessages = useCallback(async (skipCache = false) => {
    if (!userId) return;
    try {
      debugLog('🔵 [DEBUG] Fetching messages for user:', userId, skipCache ? '(forced)' : '(cached)');
      
      // Try to load from AsyncStorage cache first for INSTANT display
      if (!skipCache) {
        try {
          const cacheKey = CACHE_KEYS.MESSAGES(userId);
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const { data: cachedData, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            // Use cached data if less than 5 minutes old
            if (age < CACHE_EXPIRY.MESSAGES) {
              debugLog('💾 [CACHE HIT] Using cached messages, age:', Math.round(age / 1000), 's');
              
              // Display cached messages immediately
              const sortedMessages = cachedData.sort((a: any, b: any) => 
                new Date(a.sent_at || a.created_at || 0).getTime() - 
                new Date(b.sent_at || b.created_at || 0).getTime()
              );
              setAllMessages(sortedMessages);
              const messagesToDisplay = sortedMessages.slice(-displayCount).reverse();
              setMessages(messagesToDisplay);
              setLoading(false);
              
              // Still fetch in background to update
              debugLog('🔄 [CACHE] Fetching fresh data in background...');
            }
          }
        } catch (cacheError) {
          debugLog('⚠️ [CACHE] Error reading cache:', cacheError);
        }
      }
      
      // If forcing fresh, clear cache first
      if (skipCache) {
        apiClient.clearMessageCache(userId);
        await AsyncStorage.removeItem(CACHE_KEYS.MESSAGES(userId));
      }
      
      const data = await apiClient.getMessages(userId);
      
      // CRITICAL: Only process if we got valid data (not null/undefined/error)
      if (!data || !Array.isArray(data)) {
        debugLog('🔵 [DEBUG] No valid data received, skipping update');
        return;
      }
      
      // Count unread messages FROM the other user (these are the ones we need to mark as read)
      const unreadFromOther = data.filter((m: any) => {
        const senderId = m.sender_id || m.senderId;
        const readAt = m.read_at ?? m.readAt;
        return senderId === userId && !readAt;
      });
      debugLog('🔵 [DEBUG] Unread messages loaded:', unreadFromOther.length);
      
      // Debug: Log messages with read status
      const myMessages = data.filter((m: any) => m.sender_id === currentUser?.id);
      const readMessages = myMessages.filter((m: any) => m.read_at);
      debugLog('[ChatScreen] My messages:', myMessages.length, 'Read by other:', readMessages.length);
      
      // Store ALL messages (sorted oldest first)
      const sortedMessages = data.sort((a, b) => 
        new Date(a.sent_at || a.created_at || 0).getTime() - 
        new Date(b.sent_at || b.created_at || 0).getTime()
      );
      setAllMessages(sortedMessages);
      
      // Display only last 20 messages initially (reversed for inverted list)
      const messagesToDisplay = sortedMessages.slice(-displayCount).reverse();
      setMessages(messagesToDisplay);
      
      // CRITICAL: Also store in message store (for local unread calculation - Kotlin approach!)
      // Store in normal order (oldest first) - only if we have messages!
      if (data.length > 0) {
        setStoreMessages(userId, data);
      }
      
      // Cache messages in AsyncStorage for instant loading next time
      try {
        const cacheKey = CACHE_KEYS.MESSAGES(userId);
        const cacheData = JSON.stringify({
          data: sortedMessages,
          timestamp: Date.now(),
        });
        await AsyncStorage.setItem(cacheKey, cacheData);
        debugLog('💾 [CACHE] Saved messages to cache');
      } catch (cacheError) {
        debugLog('⚠️ [CACHE] Error saving to cache:', cacheError);
      }

      debugLog('[ChatScreen] 📦 Showing', messagesToDisplay.length, 'of', data.length, 'total messages');
      
      // Only mark as read if there are unread messages
      if (unreadFromOther.length > 0) {
        debugLog('🔵 [DEBUG] Sending read receipt for', unreadFromOther.length, 'messages...');
        
        // CRITICAL: Ensure currentUserId is set BEFORE marking as read!
        if (currentUser?.id) {
          setCurrentUserId(currentUser.id);
        }
        
        // INSTANT: Mark messages as read in LOCAL state FIRST (Kotlin approach!)
        markMessagesAsRead(userId);
        
        // Then emit socket event (for sender to see read receipts)
        await apiClient.markThreadAsRead(userId);
        debugLog('🔵 [DEBUG] Read receipt sent via socket + local state updated');
      } else {
        debugLog('🔵 [DEBUG] No unread messages - skipping read receipt');
      }
        
    } catch (error: any) {
      console.error('[ChatScreen] Failed to fetch messages:', error);
      // If authentication error, don't retry - user needs to re-login
      if (error?.message?.includes('Authentication') || error?.message?.includes('401')) {
        debugWarn('[ChatScreen] ⚠️ Authentication error - stopping polling');
        // Let the error propagate so polling stops
        throw error;
      }
      // DON'T update store on error - keep existing data!
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser?.id, setStoreMessages, markMessagesAsRead, setCurrentUserId]);

  // Check if the other user is online - run in background, don't block UI
  const checkOnlineStatus = useCallback(async () => {
    if (!userId) return;
    
    // First check socket service (real-time)
    if (socketService.isSocketConnected()) {
      setIsOnline(socketService.isUserOnline(userId));
      return;
    }
    
    // Check cache first
    try {
      const cacheKey = CACHE_KEYS.ONLINE_STATUS(userId);
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { status, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < CACHE_EXPIRY.ONLINE_STATUS) {
          setIsOnline(status);
          debugLog('💾 [CACHE HIT] Online status from cache:', status);
          return; // Use cached status, no API call needed
        }
      }
    } catch (cacheError) {
      debugLog('⚠️ [CACHE] Error reading online status cache:', cacheError);
    }
    
    // Fallback to API call
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return;
      
      const response = await fetch(`${API_BASE_URL}/users/online`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const onlineIds = (data || []).map((m: any) => m.id);
        const status = onlineIds.includes(userId);
        setIsOnline(status);
        
        // Cache the online status
        try {
          const cacheKey = CACHE_KEYS.ONLINE_STATUS(userId);
          await AsyncStorage.setItem(cacheKey, JSON.stringify({
            status,
            timestamp: Date.now(),
          }));
          debugLog('💾 [CACHE] Saved online status to cache');
        } catch (cacheError) {
          debugLog('⚠️ [CACHE] Error saving online status:', cacheError);
        }
      }
    } catch (error) {
      debugLog('[ChatScreen] Could not check online status:', error);
    }
  }, [userId]);

  useEffect(() => {
    // Fetch messages ONCE on mount
    fetchMessages(false);
    // Check online status in background (don't await)
    checkOnlineStatus();
    
    // Fallback polling: only when screen is focused AND socket is disconnected
    let pollErrorCount = 0;
    let pollInterval: NodeJS.Timeout | null = null;
    
    const startPolling = () => {
      if (pollInterval) return; // Already polling
      pollInterval = setInterval(async () => {
        // Only poll if socket is disconnected AND screen is focused
        if (!socketService.isSocketConnected() && isFocusedRef.current) {
          try {
            if (__DEV__) debugLog('[ChatScreen] 🔄 Fallback polling (socket disconnected)');
            await fetchMessages(false);
            pollErrorCount = 0;
          } catch (error: any) {
            pollErrorCount++;
            if (__DEV__) debugLog('[ChatScreen] ⚠️ Poll error count:', pollErrorCount);
            if (pollErrorCount >= 2 && (error?.message?.includes('Authentication') || error?.message?.includes('401'))) {
              if (__DEV__) debugWarn('[ChatScreen] 🛑 Stopping polling due to auth errors');
              if (pollInterval) clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      }, 10000);
    };
    
    // Start polling only if socket is initially disconnected
    if (!socketService.isSocketConnected()) {
      startPolling();
    }
    
    // Subscribe to socket online members for real-time updates
    const unsubscribe = socketService.onOnlineMembersChange((members) => {
      if (userId) {
        setIsOnline(members.some(m => m.id === userId));
      }
    });
    
    // Subscribe to new messages from socket
    const handleNewMessage = (data: any) => {
      debugLog('[ChatScreen] Socket new_message event:', data);
      const senderId = data?.sender_id || data?.senderId || '';
      const receiverId = data?.receiver_id || data?.receiverId || '';
      
      // Only add if message is part of this conversation
      if (senderId === userId || receiverId === userId) {
        // If message is FROM the other user, mark it as read immediately (we're viewing it!)
        const isFromOtherUser = senderId === userId;
        const isChatVisible = isFocusedRef.current;
        const messageId = data.id || `socket-${Date.now()}`;
        const pendingReadAt = pendingReadAtByMessageIdRef.current.get(messageId);
        if (pendingReadAt) {
          pendingReadAtByMessageIdRef.current.delete(messageId);
        }
        const newMsg: ChatMessage = {
          id: messageId,
          sender_id: senderId,
          receiver_id: receiverId,
          content: data.content || data.message || '',
          sent_at: data.sent_at || data.created_at || new Date().toISOString(),
          delivered_at: data.delivered_at,
          // CRITICAL: Only set read_at if ChatScreen is FOCUSED (not just mounted!)
          // This ensures badge increments when user is on dashboard
          read_at: isFromOtherUser
            ? (isChatVisible ? new Date().toISOString() : data.read_at)
            : (pendingReadAt || data.read_at),
        };
        
        // Add to START of array (inverted list)
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev;
          // Also avoid adding our own optimistic messages again
          if (prev.some(m => m.content === newMsg.content && m.sender_id === newMsg.sender_id && m.id.startsWith('temp-'))) {
            // Replace optimistic with real
            return prev.map(m => 
              m.content === newMsg.content && m.sender_id === newMsg.sender_id && m.id.startsWith('temp-') 
                ? { ...newMsg, read_at: newMsg.read_at ?? m.read_at } 
                : m
            );
          }
          return [newMsg, ...prev];
        });
        
        // CRITICAL FIX: Only mark as read if ChatScreen is actually visible/focused
        // This prevents auto-marking messages as read when user is on dashboard
        if (isFromOtherUser && isChatVisible) {
          // Mark as read via socket and clear cache for instant badge update
          apiClient.markThreadAsRead(userId);
          apiClient.clearUnreadCountCache();
          // Also mark as read in LOCAL store to prevent badge increment
          markMessagesAsRead(userId);
          debugLog('[ChatScreen] ✅ Marked incoming message as read (screen focused), badge refreshed');
        } else if (isFromOtherUser && !isChatVisible) {
          debugLog('[ChatScreen] 📬 New message received but screen not focused - keeping as unread');
        }
      }
    };
    
    // Subscribe to typing indicators
    const handleTyping = (data: any) => {
      const typingUserId = data?.userId || data?.user_id || data?.senderId || '';
      debugLog('[ChatScreen] Typing event from:', typingUserId, 'expecting:', userId);
      if (typingUserId === userId) {
        setIsTyping(true);
        
        // Auto-hide after 3 seconds in case stop event is not received
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      }
    };
    
    const handleStopTyping = (data: any) => {
      const typingUserId = data?.userId || data?.user_id || data?.senderId || '';
      debugLog('[ChatScreen] Stop typing event from:', typingUserId);
      if (typingUserId === userId) {
        setIsTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
    };
    
    // Subscribe to read receipts
    const handleMessagesRead = (data: any) => {
      debugLog('[ChatScreen] 📖 Messages read event received:', JSON.stringify(data));
      const readAt = data?.readAt || data?.read_at || new Date().toISOString();
      const messageIds = data?.messageIds || data?.message_ids || [];
      // readerId = who read the messages (the OTHER person - userId in this chat)
      const readerId = data?.readerId || data?.reader_id || data?.userId || data?.user_id || '';
      // conversationPartnerId = whose messages were read (could be current user - the sender)
      // When Android reads YOUR messages, conversationPartnerId = YOUR ID (currentUser.id)
      const conversationPartnerId = data?.conversationPartnerId || data?.conversation_partner_id || '';

      debugLog('[ChatScreen] 📖 Read event details:');
      debugLog('  - messageIds:', messageIds.length);
      debugLog('  - readerId:', readerId);
      debugLog('  - conversationPartnerId:', conversationPartnerId);
      debugLog('  - currentUser.id:', currentUser?.id);
      debugLog('  - chatting with userId:', userId);

      // Buffer any IDs so if the read event arrives before the `new_message` with server ID
      // (while we still show a `temp-...` optimistic message), we can apply `read_at` later.
      if (Array.isArray(messageIds) && messageIds.length > 0) {
        const map = pendingReadAtByMessageIdRef.current;
        messageIds.forEach((id: any) => {
          if (typeof id === 'string' && id.length > 0) {
            map.set(id, readAt);
          }
        });
        // Safety: prevent unbounded growth
        if (map.size > 500) {
          pendingReadAtByMessageIdRef.current = new Map(Array.from(map.entries()).slice(-200));
        }
      }
      
      setMessages((prev) => {
        let updated = false;
        const newMessages = prev.map(msg => {
          // If we have specific message IDs, check them
          if (messageIds.length > 0) {
            if (messageIds.includes(msg.id)) {
              debugLog('[ChatScreen] ✓✓ Marking message as read by ID:', msg.id);
              updated = true;
              return { ...msg, read_at: readAt };
            }
          } 
          // Check if this is about messages WE sent (our messages being read)
          // The other person (userId) read our messages - conversationPartnerId would be our ID
          else if (conversationPartnerId === currentUser?.id || readerId === userId) {
            if (msg.sender_id === currentUser?.id && !msg.read_at) {
              debugLog('[ChatScreen] ✓✓ Marking our message as read:', msg.id);
              updated = true;
              return { ...msg, read_at: readAt };
            }
          } 
          // Fallback: if the event is about this conversation, mark our unread messages
          else if (msg.sender_id === currentUser?.id && msg.receiver_id === userId && !msg.read_at) {
            debugLog('[ChatScreen] ✓✓ Marking message as read (fallback):', msg.id);
            updated = true;
            return { ...msg, read_at: readAt };
          }
          return msg;
        });
        
        if (updated) {
          debugLog('[ChatScreen] ✓✓ Messages updated with read status');
        } else {
          debugLog('[ChatScreen] ⚠️ No messages were updated');
        }
        
        return newMessages;
      });
    };
    
    // Register socket listeners
    socketService.on('new_message', handleNewMessage);
    socketService.on('typing', handleTyping);
    socketService.on('stop-typing', handleStopTyping);
    socketService.on('user_typing', handleTyping);
    socketService.on('user_stop_typing', handleStopTyping);
    socketService.on('message_read', handleMessagesRead);
    socketService.on('messagesRead', handleMessagesRead);
    
    // Fallback online status check: only when socket disconnected AND focused
    let onlineInterval: NodeJS.Timeout | null = null;
    const startOnlinePolling = () => {
      if (onlineInterval) return;
      onlineInterval = setInterval(() => {
        if (!socketService.isSocketConnected() && isFocusedRef.current) {
          checkOnlineStatus();
        }
      }, 60000);
    };
    
    if (!socketService.isSocketConnected()) {
      startOnlinePolling();
    }
    
    return () => {
      if (__DEV__) debugLog('[ChatScreen] Leaving chat - will trigger badge refresh');
      
      unsubscribe();
      if (onlineInterval) clearInterval(onlineInterval);
      if (pollInterval) clearInterval(pollInterval);
      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Unsubscribe from socket events
      socketService.off('new_message', handleNewMessage);
      socketService.off('typing', handleTyping);
      socketService.off('stop-typing', handleStopTyping);
      socketService.off('user_typing', handleTyping);
      socketService.off('user_stop_typing', handleStopTyping);
      socketService.off('message_read', handleMessagesRead);
      socketService.off('messagesRead', handleMessagesRead);
    };
  }, [fetchMessages, checkOnlineStatus, userId, currentUser?.id]);

  const scrollToBottom = () => {
    // For inverted list, scroll to index 0 (which appears at bottom)
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // Load more messages when scrolling to top (in inverted list, this is onEndReached)
  const loadMoreMessages = useCallback(() => {
    if (loadingMore || allMessages.length === 0) return;
    if (messages.length >= allMessages.length) {
      debugLog('[ChatScreen] 📜 All messages already loaded');
      return;
    }
    
    setLoadingMore(true);
    debugLog('[ChatScreen] 💼 Loading more messages...');
    
    // Load 20 more messages
    setTimeout(() => {
      const newCount = Math.min(displayCount + 20, allMessages.length);
      setDisplayCount(newCount);
      const messagesToDisplay = allMessages.slice(-newCount).reverse();
      setMessages(messagesToDisplay);
      setLoadingMore(false);
      debugLog('[ChatScreen] 💼 Loaded more. Now showing', messagesToDisplay.length, 'of', allMessages.length);
    }, 300); // Small delay to prevent rapid repeated calls
  }, [loadingMore, messages.length, allMessages.length, allMessages, displayCount]);

  // No need to scroll on message count change - inverted list handles this

  const handleSend = async () => {
    if (!userId || !messageText.trim()) return;
    const content = messageText.trim();
    setMessageText('');
    setSending(true);

    // Optimistically add message at START of array (newest first for inverted list)
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser?.id || '',
      receiver_id: userId,
      content,
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimisticMsg, ...prev]);
    // Already at bottom with inverted list, no scroll needed

    try {
      await apiClient.sendMessage(userId, content);
      // Refresh to get actual message from server
      fetchMessages();
    } catch (error) {
      console.error('[ChatScreen] Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#E6002A" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Chat Header - shows who you're chatting with */}
      <View style={styles.chatHeader}>
        {/* Back button */}
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Avatar with online indicator */}
        <TouchableOpacity
          onPress={() => userPhoto && setShowProfileImage(true)}
          activeOpacity={0.8}
        >
          <View style={styles.avatarContainer}>
            {userPhoto ? (
              <Image source={{ uri: userPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{getInitials(userName || 'U')}</Text>
              </View>
            )}
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
        </TouchableOpacity>
        <Text style={styles.chatHeaderTitle}>{userName || 'Chat'}</Text>
      </View>

      {/* Messages List - inverted so newest at bottom */}
      <FlatList
        ref={flatListRef}
        data={messages}
        extraData={messages} // Force re-render when messages change (including read_at updates)
        keyExtractor={(item) => `${item.id}-${item.read_at || 'unread'}`}
        renderItem={({ item }) => (
          <MessageBubble message={item} isFromCurrentUser={item.sender_id === currentUser?.id} />
        )}
        contentContainerStyle={styles.messagesList}
        inverted
        removeClippedSubviews={false} // Disable to ensure all items render properly
        maxToRenderPerBatch={20}
        windowSize={10}
        initialNumToRender={20}
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 20, transform: [{ scaleY: -1 }] }}>
              <ActivityIndicator size="small" color="#E6002A" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { transform: [{ scaleY: -1 }] }]}>
            <Icon name="chat-bubble-outline" size={64} color="#808080" />
            <Text style={styles.emptyText}>Start a conversation</Text>
          </View>
        }
      />

      {/* Typing indicator - inline above input bar, visible when other user is typing */}
      {isTyping && (
        <View style={styles.typingContainerInline}>
          <View style={styles.typingBubble}>
            <TypingDots />
          </View>
        </View>
      )}

      {/* Input Bar - matching Kotlin */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#808080"
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Icon name="send" size={20} color={messageText.trim() ? '#FFFFFF' : '#808080'} />
          )}
        </TouchableOpacity>
      </View>

      {/* Profile Image Modal - square with close button like Kotlin */}
      <Modal
        visible={showProfileImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileImage(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileImage(false)}
        >
          <View style={styles.modalContent}>
            {userPhoto && (
              <Image source={{ uri: userPhoto }} style={styles.fullProfileImage} resizeMode="cover" />
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowProfileImage(false)}
            >
              <Icon name="close" size={12} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black like Kotlin
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1C1C1E',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(230, 0, 42, 0.3)',
  },
  avatarPlaceholder: {
    backgroundColor: '#E6002A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00D856',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexGrow: 1,
  },
  messageRow: {
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  messageRowLeft: {
    alignItems: 'flex-start', // Your messages on left
  },
  messageRowRight: {
    alignItems: 'flex-end', // Other's messages on right
  },
  messageBubble: {
    maxWidth: 280,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleLeft: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
  },
  bubbleRight: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 3,
  },
  messageTime: {
    fontSize: 11,
  },
  receiptContainer: {
    marginLeft: 3,
  },
  receiptRead: {
    fontSize: 14,
    color: '#0084FF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  receiptDelivered: {
    fontSize: 14,
    color: '#808080',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  receiptSent: {
    fontSize: 14,
    color: '#808080',
    opacity: 0.5,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#808080',
    marginTop: 12,
  },
  typingContainer: {
    position: 'absolute',
    bottom: 80,
    right: 16,
  },
  typingContainerInline: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#000000',
  },
  typingBubble: {
    backgroundColor: '#0084FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    backgroundColor: '#1C1C1E',
  },
  input: {
    flex: 1,
    backgroundColor: '#2D2D2D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#808080',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0084FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#3D3D3D',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullProfileImage: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;
