import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { Thread } from '../../models';
import { MainStackParamList } from '../../navigation/types';
import { socketService } from '../../services/SocketService';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { useTheme } from '../../theme/ThemeContext';

// API config - same as TopAppBar and ApiClient
const API_BASE_URL = 'https://stock-nexus-84-main-2-1.onrender.com/api';
const TOKEN_KEY = '@stocknexus_access_token';
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Cache keys
const CACHE_KEYS = {
  THREADS: '@inbox_threads',
  ONLINE_MEMBERS: '@inbox_online_members',
};

// Cache expiry
const CACHE_EXPIRY = {
  THREADS: 3 * 60 * 1000, // 3 minutes
  ONLINE_MEMBERS: 60 * 1000, // 1 minute
};

// Online member interface
interface OnlineMember {
  id: string;
  name?: string;
  photoUrl?: string;
}

export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile: currentUser } = useAuthStore();
  const { isDark, designColors } = useTheme();
  // Subscribe to messages state directly (re-renders when messages change!)
  const messages = useMessageStore((state) => state.messages);
  
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState<string | null>(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<string[]>([]); // List of online user IDs

  // Fetch online members - matches Kotlin implementation
  const fetchOnlineMembers = useCallback(async () => {
    try {
      // Check cache first
      const cached = await AsyncStorage.getItem(CACHE_KEYS.ONLINE_MEMBERS);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < CACHE_EXPIRY.ONLINE_MEMBERS) {
          setOnlineMembers(cachedData);
          if (__DEV__) console.log('💾 [CACHE HIT] Online members from cache');
          return; // Use cached data, skip API call
        }
      }
      
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
        // Extract user IDs (excluding current user)
        const onlineIds = (data || [])
          .filter((member: OnlineMember) => member.id !== currentUser?.id)
          .map((member: OnlineMember) => member.id);
        setOnlineMembers(onlineIds);
        
        // Cache online members
        try {
          const cacheData = JSON.stringify({
            data: onlineIds,
            timestamp: Date.now(),
          });
          await AsyncStorage.setItem(CACHE_KEYS.ONLINE_MEMBERS, cacheData);
          if (__DEV__) console.log('💾 [CACHE] Saved online members to cache');
        } catch (cacheError) {
          if (__DEV__) console.log('⚠️ [CACHE] Error caching online members:', cacheError);
        }
      }
    } catch (error) {
      console.log('[InboxScreen] Could not fetch online members:', error);
    }
  }, [currentUser?.id]);

  // Debounce timer to prevent rapid successive calls
  const fetchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Helper function to calculate local unread count for a conversation
  const getLocalUnreadCount = useCallback((partnerId: string): number => {
    if (!currentUser?.id || !messages[partnerId]) return -1; // -1 means no local data
    return messages[partnerId].filter(
      (msg) => msg.sender_id === partnerId && !msg.read_at
    ).length;
  }, [messages, currentUser?.id]);

  const fetchThreads = useCallback(async (immediate = false) => {
    // If not immediate, debounce the call
    if (!immediate && fetchTimerRef.current) {
      if (__DEV__) console.log('[InboxScreen] Debouncing fetchThreads call');
      return;
    }

    try {
      // Set debounce timer (500ms for faster response)
      if (!immediate) {
        fetchTimerRef.current = setTimeout(() => {
          fetchTimerRef.current = null;
        }, 500);
      }

      // Try to load from cache first for INSTANT display
      if (!immediate) {
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEYS.THREADS);
          if (cached) {
            const { data: cachedData, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            if (age < CACHE_EXPIRY.THREADS) {
              if (__DEV__) console.log('💾 [CACHE HIT] Using cached threads, age:', Math.round(age / 1000), 's');
              setThreads(cachedData);
              setLoading(false);
              // Continue to fetch fresh data in background
              if (__DEV__) console.log('🔄 [CACHE] Fetching fresh threads in background...');
            }
          }
        } catch (cacheError) {
          if (__DEV__) console.log('⚠️ [CACHE] Error reading threads cache:', cacheError);
        }
      }

      // Fetch threads and unread counts - but use cached results when available
      const data = await apiClient.getThreads();
      const unreadCounts = await apiClient.getUnreadCountsPerConversation();
      
      if (__DEV__) console.log('[InboxScreen] Got threads:', data?.length || 0);
      if (__DEV__) console.log('[InboxScreen] Unread counts (API):', unreadCounts);
      
      if (!data || data.length === 0) {
        setThreads([]);
        return;
      }

      // Map ALL threads - backend provides other_user_name and other_user_photo
      const mappedThreads: Thread[] = data.map((item: any) => {
        // Backend provides other_user_name and other_user_photo, and other_user_id
        const displayName = item.other_user_name || item.displayName || 'Unknown User';
        const displayPhoto = item.other_user_photo || item.displayPhoto || null;
        const lastMessage = item.last_message_content || item.last_message || 'No messages yet';
        // Use other_user_id from backend (like Kotlin uses user2Id)
        const otherUserId = item.other_user_id || item.user2_id || item.user2Id || item.participant_id || '';

        // KOTLIN APPROACH: Prefer LOCAL unread count (instant updates!)
        // -1 means no messages loaded for this conversation yet, use API count
        const localCount = getLocalUnreadCount(otherUserId);
        const apiCount = unreadCounts[otherUserId] || item.unread_count || item.unreadCount || 0;
        // Use local count if we have messages loaded (even if 0), otherwise use API
        const unreadCount = localCount >= 0 ? localCount : apiCount;
        
        if (__DEV__) console.log('[InboxScreen] Thread', displayName, '- Local:', localCount, 'API:', apiCount, '→ Using:', unreadCount);

        return {
          id: item.id || item.thread_id || `thread-${Date.now()}`,
          participant_id: otherUserId,
          participant_name: displayName,
          participant_avatar: displayPhoto,
          last_message: lastMessage,
          unread_count: unreadCount,
          updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
        };
      });

      console.log('[InboxScreen] Mapped threads with unread counts:', mappedThreads.map(t => ({ name: t.participant_name, unread: t.unread_count })));
      setThreads(mappedThreads);
      
      // Cache threads for instant loading next time
      try {
        const cacheData = JSON.stringify({
          data: mappedThreads,
          timestamp: Date.now(),
        });
        await AsyncStorage.setItem(CACHE_KEYS.THREADS, cacheData);
        if (__DEV__) console.log('💾 [CACHE] Saved threads to cache');
      } catch (cacheError) {
        if (__DEV__) console.log('⚠️ [CACHE] Error saving threads:', cacheError);
      }
    } catch (error) {
      console.error('[InboxScreen] Failed to fetch threads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, getLocalUnreadCount]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // INSTANT UPDATE: When messages in store change, update thread unread counts immediately
  // This matches Kotlin's reactive approach where UI updates automatically when state changes
  // IMPORTANT: Only increase counts, never decrease (decreasing only happens when marking as read)
  useEffect(() => {
    if (threads.length === 0) return;
    
    // Recalculate unread counts for existing threads from local state
    setThreads((prevThreads) => {
      let hasChanges = false;
      const updated = prevThreads.map((thread) => {
        if (!thread.participant_id) return thread;
        const localCount = getLocalUnreadCount(thread.participant_id);
        // Only update if:
        // 1. We have messages loaded locally (localCount >= 0)
        // 2. Local count is HIGHER than current count (prevents badge disappearing)
        // Never decrease here - that only happens when explicitly marking as read
        if (localCount >= 0 && localCount > thread.unread_count) {
          hasChanges = true;
          console.log('[InboxScreen] 🔄 Instant update:', thread.participant_name, 'unread:', thread.unread_count, '→', localCount);
          return { ...thread, unread_count: localCount };
        }
        return thread;
      });
      return hasChanges ? updated : prevThreads;
    });
  }, [messages, getLocalUnreadCount]); // Re-run when messages change

  // Socket listeners for real-time updates
  useEffect(() => {
    fetchOnlineMembers();
    
    // Subscribe to socket service for real-time online status updates
    const unsubscribe = socketService.onOnlineMembersChange((members) => {
      const ids = members
        .filter(m => m.id !== currentUser?.id)
        .map(m => m.id);
      if (__DEV__) console.log('[InboxScreen] Socket online members update:', ids.length);
      setOnlineMembers(ids);
    });
    
    // Listen for new messages to update threads INSTANTLY (no API calls!)
    const handleNewMessage = (data: any) => {
      if (__DEV__) console.log('[InboxScreen] 📬 New message received via socket - instant update');
      const senderId = data?.sender_id || data?.senderId;
      const messageContent = data?.content || data?.message || '';
      const timestamp = data?.sent_at || data?.timestamp || new Date().toISOString();
      
      if (!senderId) return;
      
      // INSTANT update: Update thread with incremented unread count
      // The useEffect will sync it later from messageStore, but this gives immediate feedback
      setThreads(prevThreads => {
        const existingThread = prevThreads.find(t => t.participant_id === senderId);
        
        if (existingThread) {
          // Update last message, timestamp, and increment unread count immediately
          if (__DEV__) console.log('[InboxScreen] Updating thread for:', senderId, '- incrementing unread count from', existingThread.unread_count);
          return prevThreads.map(thread => {
            if (thread.participant_id === senderId) {
              return {
                ...thread,
                unread_count: (thread.unread_count || 0) + 1,
                last_message: messageContent,
                updated_at: timestamp,
              };
            }
            return thread;
          }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        } else {
          // New thread - fetch full thread list (only if new conversation)
          fetchThreads(true);
          return prevThreads;
        }
      });
      
      if (__DEV__) console.log('[InboxScreen] ✅ Thread updated instantly - unread count incremented');
    };
    
    socketService.on('new_message', handleNewMessage);
    
    // Fallback polling: only when socket disconnected
    let interval: NodeJS.Timeout | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (!socketService.isSocketConnected()) {
          fetchOnlineMembers();
        }
      }, 30000);
    };
    
    if (!socketService.isSocketConnected()) {
      startPolling();
    }
    
    return () => {
      unsubscribe();
      socketService.off('new_message', handleNewMessage);
      if (interval) clearInterval(interval);
    };
  }, [fetchOnlineMembers, fetchThreads, currentUser?.id]);

  // Refresh threads when screen gains focus (e.g., coming back from ChatScreen)
  // This ensures unread counts are updated after reading messages
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) console.log('[InboxScreen] Screen focused - refreshing threads');
      fetchThreads(true); // immediate = true, skip debounce
      fetchOnlineMembers();
    }, [fetchThreads, fetchOnlineMembers])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchThreads();
    fetchOnlineMembers(); // Also refresh online status
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[date.getDay()];
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderThreadItem = ({ item }: { item: Thread }) => {
    const hasUnread = item.unread_count > 0;
    // Check if this user is online (matches Kotlin: onlineMembers.contains(thread.user2Id))
    const isOnline = item.participant_id ? onlineMembers.includes(item.participant_id) : false;

    return (
      <TouchableOpacity
        style={[
          styles.threadItem,
          { backgroundColor: hasUnread ? designColors.surfaceVariant : designColors.cardBackground },
        ]}
        onPress={() => {
          if (item.participant_id) {
            console.log('🔵 [DEBUG] Tapped on thread:', item.participant_name, 'unread:', item.unread_count);
            navigation.navigate('Chat', { 
              userId: item.participant_id,
              userName: item.participant_name,
              userPhoto: item.participant_avatar || undefined,
            });
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.threadContent}>
          {/* Avatar with online indicator */}
          <TouchableOpacity
            onPress={() => setSelectedProfileImage(item.participant_avatar || null)}
            activeOpacity={0.8}
          >
            <View style={styles.avatarContainer}>
              {item.participant_avatar ? (
                <Image
                  source={{ uri: item.participant_avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>
                    {(item.participant_name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {/* Online indicator - green dot - ONLY show if user is online */}
              {isOnline && <View style={styles.onlineIndicator} />}
            </View>
          </TouchableOpacity>

          {/* Thread info */}
          <View style={styles.threadInfo}>
            <View style={styles.threadHeader}>
              <Text style={[styles.participantName, { color: designColors.textPrimary }]} numberOfLines={1}>
                {item.participant_name}
              </Text>
              <Text style={[styles.timestamp, { color: designColors.textMuted }]}>
                {formatTimestamp(item.updated_at)}
              </Text>
            </View>
            <Text style={[styles.lastMessage, { color: designColors.textMuted }]} numberOfLines={1}>
              {item.last_message}
            </Text>
          </View>

          {/* Unread badge */}
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {item.unread_count > 9 ? '9+' : String(item.unread_count)}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.divider, { backgroundColor: designColors.borderLight }]} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: designColors.background }]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={designColors.primaryRed} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: designColors.background }]}>
      {/* Content */}
      {threads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="chat-bubble-outline" size={64} color={designColors.textMuted} />
          <Text style={[styles.emptyText, { color: designColors.textSecondary }]}>
            No messages yet.{"\n"}Pull down to refresh.
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={renderThreadItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[designColors.primaryRed]}
              tintColor={designColors.primaryRed}
            />
          }
        />
      )}

      {/* Floating Action Button - White background like Kotlin */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowComposeDialog(true)}
        activeOpacity={0.8}
      >
        <Icon name="add" size={24} color="#000000" />
      </TouchableOpacity>

      {/* Profile Image Modal */}
      <Modal
        visible={selectedProfileImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedProfileImage(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedProfileImage(null)}
        >
          <View style={styles.modalContent}>
            {selectedProfileImage && (
              <Image
                source={{ uri: selectedProfileImage }}
                style={styles.fullProfileImage}
                resizeMode="cover"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Compose Message Dialog */}
      <ComposeMessageDialog
        visible={showComposeDialog}
        onClose={() => setShowComposeDialog(false)}
        onUserSelected={(user) => {
          setShowComposeDialog(false);
          navigation.navigate('Chat', {
            userId: user.id,
            userName: user.name,
            userPhoto: user.photoUrl,
          });
        }}
        currentUserId={currentUser?.id || ''}
        designColors={designColors}
      />
    </View>
  );
};

// Compose Message Dialog Component
interface ComposeUser {
  id: string;
  name: string;
  photoUrl?: string;
}

interface ComposeDialogProps {
  visible: boolean;
  onClose: () => void;
  onUserSelected: (user: ComposeUser) => void;
  currentUserId: string;
  designColors: typeof import('../../theme/colors').getDesignColors extends (...args: any[]) => infer R ? R : never;
}

const ComposeMessageDialog: React.FC<ComposeDialogProps> = ({
  visible,
  onClose,
  onUserSelected,
  currentUserId,
  designColors,
}) => {
  const [users, setUsers] = useState<ComposeUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<ComposeUser[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchUsers();
    }
  }, [visible]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Use apiClient.getStaff() - same as Kotlin app which uses /users/staff endpoint
      const staffList = await apiClient.getStaff();
      
      const userList = (staffList || [])
        .filter((u: any) => u.id !== currentUserId)
        .map((u: any) => ({
          id: u.id,
          name: u.name || 'Unknown User',
          photoUrl: u.photoUrl || u.photo_url,
        }));
      
      setUsers(userList);
      setFilteredUsers(userList);
      
      if (__DEV__) console.log('[ComposeDialog] Loaded', userList.length, 'users from /users/staff');
    } catch (error) {
      console.log('[ComposeDialog] Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (!text.trim()) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter((u) =>
        u.name.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredUsers(filtered);
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={composeStyles.overlay}>
        <View style={[composeStyles.dialog, { backgroundColor: designColors.cardBackground }]}>
          {/* Header */}
          <View style={[composeStyles.header, { borderBottomColor: designColors.borderLight }]}>
            <Text style={[composeStyles.title, { color: designColors.textPrimary }]}>New Message</Text>
            <TouchableOpacity onPress={onClose} style={composeStyles.closeBtn}>
              <Icon name="close" size={24} color={designColors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={[composeStyles.searchContainer, { backgroundColor: designColors.surfaceVariant }]}>
            <Icon name="search" size={20} color={designColors.textMuted} />
            <TextInput
              style={[composeStyles.searchInput, { color: designColors.textPrimary }]}
              placeholder="Search contacts..."
              placeholderTextColor={designColors.textMuted}
              value={searchText}
              onChangeText={handleSearch}
              autoFocus
            />
          </View>

          {/* User List */}
          {loading ? (
            <View style={composeStyles.loader}>
              <ActivityIndicator size="large" color={designColors.primaryRed} />
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              style={composeStyles.userList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[composeStyles.userItem, { borderBottomColor: designColors.borderLight }]}
                  onPress={() => onUserSelected(item)}
                >
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={composeStyles.userAvatar} />
                  ) : (
                    <View style={[composeStyles.userAvatar, composeStyles.avatarPlaceholder]}>
                      <Text style={composeStyles.avatarText}>{getInitials(item.name)}</Text>
                    </View>
                  )}
                  <Text style={[composeStyles.userName, { color: designColors.textPrimary }]}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={composeStyles.emptyContainer}>
                  <Text style={[composeStyles.emptyText, { color: designColors.textMuted }]}>No users found</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const composeStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2D2D',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  userList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#0084FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 14,
    color: '#808080',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black per spec
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#333333',
  },
  topBarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flexGrow: 1,
  },
  threadItem: {
    backgroundColor: '#1C1C1E', // Read thread background
  },
  threadItemUnread: {
    backgroundColor: '#252528', // Unread thread background
  },
  threadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: '#0084FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00D856', // Green online indicator
    borderWidth: 2,
    borderColor: '#000000',
  },
  threadInfo: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  participantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#808080',
  },
  lastMessage: {
    fontSize: 14,
    color: '#808080',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E6002A', // Red badge per spec
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 12,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#CCCCCC',
    marginLeft: 84, // 16 + 56 + 12 (padding + avatar + spacing)
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#808080',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF', // White FAB per spec
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8, // Android shadow
    shadowColor: '#000000', // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default InboxScreen;
