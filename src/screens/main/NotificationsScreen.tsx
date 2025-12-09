import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { Notification } from '../../models';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

const NotificationsScreen = () => {
  const { colors } = useTheme();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    try {
      const data = await apiClient.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.log('Load notifications error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadNotifications(true);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await apiClient.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.log('Mark as read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.log('Mark all as read error:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock': return 'warning';
      case 'critical_stock': return 'error';
      case 'stock_in': return 'add-box';
      case 'stock_out': return 'remove-shopping-cart';
      case 'delivery': return 'local-shipping';
      case 'approval': return 'how-to-reg';
      case 'message': return 'message';
      case 'system': return 'info';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'low_stock': return Colors.warning;
      case 'critical_stock': return Colors.danger;
      case 'stock_in': return Colors.success;
      case 'stock_out': return Colors.primary;
      case 'delivery': return Colors.info;
      case 'approval': return Colors.success;
      case 'message': return Colors.primary;
      case 'system': return Colors.info;
      default: return Colors.secondary;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        { backgroundColor: item.is_read ? colors.card : colors.surfaceVariant },
      ]}
      onPress={() => !item.is_read && handleMarkAsRead(item.id)}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: getNotificationColor(item.type) + '20' },
        ]}
      >
        <Icon
          name={getNotificationIcon(item.type)}
          size={24}
          color={getNotificationColor(item.type)}
        />
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: Colors.primary }]} />}
        </View>
        
        <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.message}
        </Text>
        
        <Text style={[styles.time, { color: colors.textSecondary }]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading notifications...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with mark all read */}
      {unreadCount > 0 && (
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.headerText, { color: colors.textSecondary }]}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={[styles.markAllText, { color: Colors.primary }]}>
              Mark all as read
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="notifications-none" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No notifications yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              You'll see notifications about stock alerts,{'\n'}deliveries, and updates here
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerText: {
    fontSize: FontSizes.sm,
  },
  markAllText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  message: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  time: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.lg,
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
