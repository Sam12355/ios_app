import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    LayoutAnimation,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { Notification } from '../../models';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NotificationsScreen = () => {
  const { isDark, colors, designColors } = useTheme();
  
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

  const handleMarkAsRead = (notificationId: string) => {
    // Optimistic update - animate and remove immediately for fast UX
    LayoutAnimation.configureNext({
      duration: 250,
      update: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        duration: 200,
      },
    });
    // Remove the notification from the list immediately
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    
    // Decrement badge count immediately (no API call, instant!)
    apiClient.decrementBadgeCount();
    
    // Call API in background (fire and forget)
    apiClient.markNotificationAsRead(notificationId).catch((error) => {
      console.log('Mark as read error:', error);
    });
  };

  const handleMarkAllAsRead = async () => {
    const currentCount = notifications.filter(n => !n.is_read).length;
    try {
      await apiClient.markAllNotificationsAsRead();
      // Clear all notifications with animation
      LayoutAnimation.configureNext({
        duration: 250,
        update: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
        delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity, duration: 200 },
      });
      setNotifications([]);
      // Decrement badge by the count of unread notifications
      for (let i = 0; i < currentCount; i++) {
        apiClient.decrementBadgeCount();
      }
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

  // Format date like Kotlin: "MMM dd, hh:mm a"
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        { 
          backgroundColor: designColors.cardBackground,
          ...(isDark ? {} : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          }),
        },
      ]}
      onPress={() => handleMarkAsRead(item.id)}
      activeOpacity={0.7}
    >
      <Icon
        name="schedule"
        size={20}
        color={designColors.textSecondary}
        style={styles.itemIcon}
      />
      
      <View style={styles.contentContainer}>
        <Text style={[styles.message, { color: designColors.textPrimary }]}>
          {item.message}
        </Text>
        <Text style={[styles.time, { color: designColors.textSecondary }]}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  itemIcon: {
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
    marginLeft: 12,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
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
