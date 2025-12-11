import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
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
import { Thread } from '../../models/Inventory';
import { MainStackParamList } from '../../navigation/types';
import { socketService } from '../../services/SocketService';
import { useAuthStore } from '../../stores/authStore';

// API config - same as TopAppBar and ApiClient
const API_BASE_URL = 'https://stock-nexus-84-main-2-1.onrender.com/api';
const TOKEN_KEY = '@stocknexus/auth_token';
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Online member interface
interface OnlineMember {
  id: string;
  name?: string;
  photoUrl?: string;
}

export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile: currentUser } = useAuthStore();
  
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState<string | null>(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<string[]>([]); // List of online user IDs

  // Fetch online members - matches Kotlin implementation
  const fetchOnlineMembers = useCallback(async () => {
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
        // Extract user IDs (excluding current user)
        const onlineIds = (data || [])
          .filter((member: OnlineMember) => member.id !== currentUser?.id)
          .map((member: OnlineMember) => member.id);
        console.log('[InboxScreen] Online members:', onlineIds.length, onlineIds);
        setOnlineMembers(onlineIds);
      }
    } catch (error) {
      console.log('[InboxScreen] Could not fetch online members:', error);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchOnlineMembers();
    
    // Subscribe to socket service for real-time online status updates
    const unsubscribe = socketService.onOnlineMembersChange((members) => {
      const ids = members
        .filter(m => m.id !== currentUser?.id)
        .map(m => m.id);
      console.log('[InboxScreen] Socket online members update:', ids.length);
      setOnlineMembers(ids);
    });
    
    // Also poll API as fallback every 30 seconds
    const interval = setInterval(fetchOnlineMembers, 30000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [fetchOnlineMembers, currentUser?.id]);

  const fetchThreads = useCallback(async () => {
    try {
      const data = await apiClient.getThreads();
      console.log('[InboxScreen] Got threads:', data?.length || 0);
      
      if (!data || data.length === 0) {
        setThreads([]);
        return;
      }

      // Map ALL threads - backend provides other_user_name and other_user_photo
      // Don't filter - backend already handles the "other user" logic
      const mappedThreads: Thread[] = data.map((item: any) => {
        // Backend provides other_user_name and other_user_photo, and other_user_id
        const displayName = item.other_user_name || item.displayName || 'Unknown User';
        const displayPhoto = item.other_user_photo || item.displayPhoto || null;
        const lastMessage = item.last_message_content || item.last_message || 'No messages yet';
        // Use other_user_id from backend (like Kotlin uses user2Id)
        const otherUserId = item.other_user_id || item.user2_id || item.user2Id || item.participant_id || '';

        return {
          id: item.id || item.thread_id || `thread-${Date.now()}`,
          participant_id: otherUserId,
          participant_name: displayName,
          participant_avatar: displayPhoto,
          last_message: lastMessage,
          unread_count: item.unread_count || item.unreadCount || 0,
          updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
        };
      });

      console.log('[InboxScreen] Mapped threads:', mappedThreads.length);
      setThreads(mappedThreads);
    } catch (error) {
      console.error('[InboxScreen] Failed to fetch threads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

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
          hasUnread && styles.threadItemUnread,
        ]}
        onPress={() => {
          if (item.participant_id) {
            navigation.navigate('Chat', { 
              userId: item.participant_id,
              userName: item.participant_name,
              userPhoto: item.participant_avatar,
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
              <Text style={styles.participantName} numberOfLines={1}>
                {item.participant_name}
              </Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(item.updated_at)}
              </Text>
            </View>
            <Text style={styles.lastMessage} numberOfLines={1}>
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
        <View style={styles.divider} />
      </TouchableOpacity>
    );
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
    <View style={styles.container}>
      {/* Content */}
      {threads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="chat-bubble-outline" size={64} color="#808080" />
          <Text style={styles.emptyText}>
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
              colors={['#E6002A']}
              tintColor="#E6002A"
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
}

const ComposeMessageDialog: React.FC<ComposeDialogProps> = ({
  visible,
  onClose,
  onUserSelected,
  currentUserId,
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
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return;
      
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const userList = (data.data || data || [])
          .filter((u: any) => u.id !== currentUserId)
          .map((u: any) => ({
            id: u.id,
            name: u.name || 'Unknown User',
            photoUrl: u.photo_url || u.photoUrl,
          }));
        setUsers(userList);
        setFilteredUsers(userList);
      }
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
        <View style={composeStyles.dialog}>
          {/* Header */}
          <View style={composeStyles.header}>
            <Text style={composeStyles.title}>New Message</Text>
            <TouchableOpacity onPress={onClose} style={composeStyles.closeBtn}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={composeStyles.searchContainer}>
            <Icon name="search" size={20} color="#808080" />
            <TextInput
              style={composeStyles.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor="#808080"
              value={searchText}
              onChangeText={handleSearch}
              autoFocus
            />
          </View>

          {/* User List */}
          {loading ? (
            <View style={composeStyles.loader}>
              <ActivityIndicator size="large" color="#E6002A" />
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              style={composeStyles.userList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={composeStyles.userItem}
                  onPress={() => onUserSelected(item)}
                >
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={composeStyles.userAvatar} />
                  ) : (
                    <View style={[composeStyles.userAvatar, composeStyles.avatarPlaceholder]}>
                      <Text style={composeStyles.avatarText}>{getInitials(item.name)}</Text>
                    </View>
                  )}
                  <Text style={composeStyles.userName}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={composeStyles.emptyContainer}>
                  <Text style={composeStyles.emptyText}>No users found</Text>
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
    bottom: 16,
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
