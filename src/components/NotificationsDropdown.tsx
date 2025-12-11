import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';

const API_BASE_URL = 'https://stock-nexus-84-main-2-1.onrender.com/api';
const TOKEN_KEY = '@stocknexus_access_token';

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

interface StockAlert {
  id: string;
  name: string;
  currentQuantity: number;
  thresholdLevel: number;
}

interface NotificationsDropdownProps {
  visible: boolean;
  onClose: () => void;
  onViewAll: () => void;
  onNotificationCountChange?: (count: number) => void;
}

// Strip HTML tags from notification messages
const stripHtmlTags = (text: string): string => {
  return text.replace(/<[^>]*>/g, '').trim();
};

const formatTimeAgo = (dateString: string): string => {
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

const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  visible,
  onClose,
  onViewAll,
  onNotificationCountChange,
}) => {
  const { isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic colors
  const backgroundColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#1E1E1E';
  const mutedColor = isDark ? '#B3B3B3' : '#666666';
  const borderColor = isDark ? '#333333' : '#E0E0E0';
  const alertBg = isDark ? '#2A1A1A' : '#FFF5F5';

  const loadNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const unreadNotifs = (data || [])
          .filter((n: any) => !n.is_read)
          .map((n: any) => ({
            id: n.id,
            type: n.type || 'general',
            message: stripHtmlTags(n.message || ''),
            createdAt: n.created_at || '',
            isRead: n.is_read || false,
          }));
        setNotifications(unreadNotifs);
        onNotificationCountChange?.(unreadNotifs.length);
      }
    } catch (error) {
      console.log('Could not fetch notifications');
    }
  };

  const loadStockAlerts = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/inventory/stock-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const alerts = (data || [])
          .filter((item: any) => {
            const threshold = item.items?.threshold_level || 0;
            return item.current_quantity <= threshold;
          })
          .slice(0, 5)
          .map((item: any) => ({
            id: item.item_id || '',
            name: item.items?.name || 'Unknown',
            currentQuantity: item.current_quantity,
            thresholdLevel: item.items?.threshold_level || 0,
          }));
        setStockAlerts(alerts);
      }
    } catch (error) {
      console.log('Could not fetch stock alerts');
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return;

      await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      onNotificationCountChange?.(notifications.length - 1);
    } catch (error) {
      console.log('Could not mark notification as read');
    }
  };

  const refresh = async () => {
    setIsLoading(true);
    await Promise.all([loadNotifications(), loadStockAlerts()]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [visible]);

  const totalCount = notifications.length + stockAlerts.length;

  const renderStockAlert = ({ item }: { item: StockAlert }) => (
    <View style={[styles.alertItem, { backgroundColor: alertBg, borderBottomColor: borderColor }]}>
      <View style={styles.alertIcon}>
        <Icon name="warning" size={20} color="#E6002A" />
      </View>
      <View style={styles.alertContent}>
        <Text style={[styles.alertTitle, { color: textColor }]}>{item.name}</Text>
        <Text style={[styles.alertSubtitle, { color: mutedColor }]}>
          Stock: {item.currentQuantity} (Threshold: {item.thresholdLevel})
        </Text>
      </View>
    </View>
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, { borderBottomColor: borderColor }]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={styles.notificationIcon}>
        <Icon
          name={item.type.includes('event') ? 'event' : 'notifications'}
          size={20}
          color="#E6002A"
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationText, { color: textColor }]} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={[styles.notificationTime, { color: mutedColor }]}>
          {formatTimeAgo(item.createdAt)}
        </Text>
      </View>
      <TouchableOpacity onPress={() => markAsRead(item.id)} style={styles.dismissButton}>
        <Icon name="close" size={16} color={mutedColor} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.dropdown, { backgroundColor }]}>
          <TouchableOpacity activeOpacity={1}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
              <Text style={[styles.headerTitle, { color: textColor }]}>Notifications</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Icon name="close" size={20} color={mutedColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={refresh} style={styles.headerButton}>
                  <Icon name="refresh" size={20} color={mutedColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onViewAll();
                  }}
                  style={styles.headerButton}
                >
                  <Icon name="history" size={20} color={mutedColor} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#E6002A" />
              </View>
            ) : totalCount === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="notifications-none" size={48} color={mutedColor} />
                <Text style={[styles.emptyText, { color: mutedColor }]}>
                  No new notifications
                </Text>
              </View>
            ) : (
              <FlatList
                data={[...stockAlerts.map(a => ({ ...a, _type: 'alert' })), ...notifications.map(n => ({ ...n, _type: 'notification' }))]}
                renderItem={({ item }) => 
                  (item as any)._type === 'alert' 
                    ? renderStockAlert({ item: item as StockAlert })
                    : renderNotification({ item: item as Notification })
                }
                keyExtractor={(item) => item.id}
                style={styles.list}
                ListHeaderComponent={
                  stockAlerts.length > 0 ? (
                    <Text style={[styles.sectionTitle, { color: mutedColor }]}>Stock Alerts</Text>
                  ) : null
                }
              />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 8,
  },
  dropdown: {
    width: Math.min(320, width - 32),
    maxHeight: 500,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  list: {
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(230, 0, 42, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  alertSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(230, 0, 42, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationText: {
    fontSize: 14,
  },
  notificationTime: {
    fontSize: 11,
    marginTop: 4,
  },
  dismissButton: {
    padding: 8,
  },
});

export default NotificationsDropdown;
