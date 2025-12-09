import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export const InboxScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const navigation = useNavigation<NavigationProp>();
  
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchThreads = useCallback(async () => {
    try {
      const data = await apiClient.getThreads();
      setThreads(data || []);
    } catch (error) {
      console.error('Failed to fetch threads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchThreads();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const filteredThreads = threads.filter(thread =>
    thread.participant_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.outline,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.onSurface,
    },
    composeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      fontSize: 16,
      color: colors.onSurface,
    },
    listContainer: {
      paddingHorizontal: 16,
    },
    threadItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    threadUnread: {
      backgroundColor: colors.primary + '08',
    },
    avatarContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginRight: 12,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    avatarPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    threadContent: {
      flex: 1,
    },
    threadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    participantName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onSurface,
    },
    threadTime: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
    },
    lastMessage: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
    },
    lastMessageUnread: {
      color: colors.onSurface,
      fontWeight: '500',
    },
    unreadBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    unreadCount: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: 12,
    },
  });

  const renderThreadItem = ({ item }: { item: Thread }) => (
    <TouchableOpacity
      style={[styles.threadItem, item.unread_count > 0 && styles.threadUnread]}
      onPress={() => navigation.navigate('Chat', { threadId: item.id })}
    >
      <View style={styles.avatarContainer}>
        {item.participant_avatar ? (
          <Image source={{ uri: item.participant_avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={24} color={colors.primary} />
          </View>
        )}
      </View>
      <View style={styles.threadContent}>
        <View style={styles.threadHeader}>
          <Text style={styles.participantName}>{item.participant_name || 'Unknown'}</Text>
          <Text style={styles.threadTime}>{formatTime(item.updated_at)}</Text>
        </View>
        <Text
          style={[styles.lastMessage, item.unread_count > 0 && styles.lastMessageUnread]}
          numberOfLines={1}
        >
          {item.last_message || 'No messages yet'}
        </Text>
      </View>
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>
            {item.unread_count > 9 ? '9+' : item.unread_count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loader]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <TouchableOpacity style={styles.composeButton}>
          <Icon name="edit" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.onSurfaceVariant} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor={colors.onSurfaceVariant}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        renderItem={renderThreadItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="chat-bubble-outline" size={64} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>No messages yet</Text>
          </View>
        }
      />
    </View>
  );
};

export default InboxScreen;
