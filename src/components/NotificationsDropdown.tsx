import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    LayoutAnimation,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import apiClient from '../api/ApiClient';
import { CalendarEvent } from '../models';
import localNotificationService from '../services/LocalNotificationService';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Section header component matching Kotlin style
const SectionHeader: React.FC<{ title: string; color: string }> = ({ title, color }) => (
  <Text style={[sectionStyles.header, { color }]}>{title}</Text>
);

const SectionDivider: React.FC<{ color: string }> = ({ color }) => (
  <View style={[sectionStyles.divider, { backgroundColor: color }]} />
);

const sectionStyles = StyleSheet.create({
  header: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
});

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
  const { isDark, designColors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasInitiallyLoaded = useRef(false);
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const previousStockAlertIds = useRef<Set<string>>(new Set());
  const previousEventIds = useRef<Set<string>>(new Set());

  // Dynamic colors
  const backgroundColor = designColors.cardBackground;
  const textColor = designColors.textPrimary;
  const mutedColor = designColors.textSecondary;
  const borderColor = designColors.borderLight;
  const alertBg = isDark ? '#2A1A1A' : '#FFF5F5';
  const eventBg = isDark ? '#1A2A2A' : '#F0F9FF';

  const loadNotifications = async () => {
    try {
      const data = await apiClient.getNotifications();
      const unreadNotifs = (data || [])
        .filter((n: any) => !n.is_read)
        .map((n: any) => ({
          id: n.id,
          type: n.type || 'general',
          message: stripHtmlTags(n.message || ''),
          createdAt: n.created_at || '',
          isRead: n.is_read || false,
        }));
      
      // Bulletproof: Never trigger notifee for any notification on the very first load after app start
      if (hasInitiallyLoaded.current && hasInitiallyLoaded.current !== 'first-load' && previousNotificationIds.current.size > 0) {
        unreadNotifs.forEach((notif) => {
          if (!previousNotificationIds.current.has(notif.id)) {
            console.log('🔔 [NotificationsDropdown] NEW NOTIFICATION DETECTED:', notif.message.substring(0, 50));
            localNotificationService.showNotification(
              'Stock Nexus',
              notif.message,
              { type: notif.type, notificationId: notif.id, message: notif.message }
            );
          }
        });
      }
      
      // Update previous IDs
      previousNotificationIds.current = new Set(unreadNotifs.map(n => n.id));
      setNotifications(unreadNotifs);
      if (__DEV__) console.log('[NotificationsDropdown] Loaded notifications:', unreadNotifs.length);
    } catch (error) {
      if (__DEV__) console.log('[NotificationsDropdown] Could not fetch notifications:', error);
    }
  };

  const loadStockAlerts = async () => {
    try {
      const data = await apiClient.getStockData();
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
      
      // Only trigger notifee for truly NEW stock alerts (after initial load)
      if (__DEV__) console.log('[NotificationsDropdown] 🎯 Stock alerts check - hasInitiallyLoaded:', hasInitiallyLoaded.current, 'alerts:', alerts.length, 'previousCount:', previousStockAlertIds.current.size);
      if (hasInitiallyLoaded.current && hasInitiallyLoaded.current !== 'first-load' && previousStockAlertIds.current.size > 0) {
        alerts.forEach((alert) => {
          if (!previousStockAlertIds.current.has(alert.id)) {
            console.log('🔔 [NotificationsDropdown] NEW STOCK ALERT DETECTED:', alert.name, 'ID:', alert.id);
            const message = `${alert.name} - Stock: ${alert.currentQuantity}/${alert.thresholdLevel}`;
            localNotificationService.showNotification(
              '⚠️ Low Stock Alert',
              message,
              { type: 'stock_alert', itemId: alert.id, message }
            ).then(() => {
              console.log('🔔 [NotificationsDropdown] Stock alert notification triggered successfully');
            }).catch((err) => {
              console.error('🔔 [NotificationsDropdown] Failed to trigger stock alert notification:', err);
            });
          }
        });
      } else {
        if (__DEV__) console.log('[NotificationsDropdown] ⏭️ Skipping notifications (first load or no previous data)');
      }
      
      // Update previous IDs
      previousStockAlertIds.current = new Set(alerts.map(a => a.id));
      setStockAlerts(alerts);
      if (__DEV__) console.log('[NotificationsDropdown] Loaded stock alerts:', alerts.length);
    } catch (error) {
      if (__DEV__) console.log('[NotificationsDropdown] Could not fetch stock alerts:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await apiClient.getCalendarEvents();
      const upcomingEvents = (data || [])
        .filter((event: CalendarEvent) => {
          const eventDate = new Date(event.event_date);
          const now = new Date();
          const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7; // Events within next 7 days
        })
        .slice(0, 5);
      
      // Bulletproof: Never trigger notifee for any event on the very first load after app start
      if (hasInitiallyLoaded.current && hasInitiallyLoaded.current !== 'first-load' && previousEventIds.current.size > 0) {
        upcomingEvents.forEach((event) => {
          if (!previousEventIds.current.has(event.id)) {
            console.log('🔔 [NotificationsDropdown] NEW EVENT DETECTED:', event.title);
            const eventDate = new Date(event.event_date);
            const dateStr = eventDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const message = `${event.title} - ${dateStr}`;
            localNotificationService.showNotification(
              '📅 Upcoming Event',
              message,
              { type: 'event', eventId: event.id, message }
            );
          }
        });
      }
      
      // Update previous IDs
      previousEventIds.current = new Set(upcomingEvents.map(e => e.id));
      setEvents(upcomingEvents);
      if (__DEV__) console.log('[NotificationsDropdown] Loaded events:', upcomingEvents.length);
    } catch (error) {
      if (__DEV__) console.log('[NotificationsDropdown] Could not fetch calendar events:', error);
    }
  };

  const refresh = async (showLoading = false) => {
    setIsRefreshing(true);
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      // Mark as loaded BEFORE fetching so subsequent polls can detect new items
      const wasInitiallyLoaded = hasInitiallyLoaded.current;
      if (!hasInitiallyLoaded.current) {
        if (__DEV__) console.log('[NotificationsDropdown] 🎯 First load - will enable notifications on NEXT poll');
        hasInitiallyLoaded.current = 'first-load';
      }

      await Promise.all([loadNotifications(), loadStockAlerts(), loadEvents()]);

      // After first load, switch to normal mode so future refreshes can trigger notifee
      if (hasInitiallyLoaded.current === 'first-load') {
        hasInitiallyLoaded.current = true;
      }

      if (__DEV__) console.log('[NotificationsDropdown] 🎯 Refresh complete. hasInitiallyLoaded:', !wasInitiallyLoaded ? 'NOW TRUE (was false)' : 'TRUE');
    } catch (error) {
      if (__DEV__) console.error('[NotificationsDropdown] Refresh error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load initial data on mount and set up polling
  useEffect(() => {
    // Initial load immediately
    if (__DEV__) console.log('[NotificationsDropdown] Component mounted, loading initial data...');
    refresh(false);

    // Register badge refresh callback so NotificationsScreen can trigger update
    apiClient.setBadgeRefreshCallback(() => {
      if (__DEV__) console.log('[NotificationsDropdown] 🔔 Badge refresh triggered from another screen');
      refresh(false);
    });

    // Poll every 30 seconds to keep count updated
    const pollInterval = setInterval(() => {
      if (__DEV__) console.log('[NotificationsDropdown] Polling for updates...');
      refresh(false);
    }, 30000);

    return () => {
      if (__DEV__) console.log('[NotificationsDropdown] Component unmounting, clearing interval');
      clearInterval(pollInterval);
      apiClient.setBadgeRefreshCallback(null);
    };
  }, []);

  // Refresh when dropdown opens
  useEffect(() => {
    if (visible) {
      if (__DEV__) console.log('[NotificationsDropdown] Dropdown opened, refreshing with loading indicator...');
      refresh(true);
    }
  }, [visible]);

  // Update total count whenever any list changes
  useEffect(() => {
    const totalCount = notifications.length + stockAlerts.length + events.length;
    if (__DEV__) {
      console.log('[NotificationsDropdown] 🔔 Updating badge count to:', totalCount, {
        notifications: notifications.length,
        stockAlerts: stockAlerts.length,
        events: events.length,
      });
    }
    onNotificationCountChange?.(totalCount);
  }, [notifications.length, stockAlerts.length, events.length, onNotificationCountChange]);

  const totalCount = notifications.length + stockAlerts.length + events.length;

  // Animate item removal with slide up effect
  const dismissWithAnimation = (callback: () => void) => {
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
    callback();
  };

  const dismissEvent = (eventId: string) => {
    dismissWithAnimation(() => {
      setEvents(prev => prev.filter(e => e.id !== eventId));
    });
  };

  const dismissStockAlert = (alertId: string) => {
    dismissWithAnimation(() => {
      setStockAlerts(prev => prev.filter(a => a.id !== alertId));
    });
  };

  const dismissNotification = (notificationId: string) => {
    if (__DEV__) console.log('[NotificationsDropdown] Dismissing notification:', notificationId);
    // Optimistic update - remove immediately for fast UX
    dismissWithAnimation(() => {
      setNotifications(prev => {
        const newList = prev.filter(n => n.id !== notificationId);
        if (__DEV__) console.log('[NotificationsDropdown] After dismiss, notifications:', newList.length);
        return newList;
      });
    });
    // Call API in background (fire and forget)
    apiClient.markNotificationAsRead(notificationId).catch((error) => {
      if (__DEV__) console.log('[NotificationsDropdown] Could not mark notification as read:', error);
    });
  };

  const formatEventDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format date like Kotlin: "MMM dd, hh:mm a"
  const formatNotificationDate = (dateString: string): string => {
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

  const renderStockAlert = ({ item }: { item: StockAlert }) => (
    <TouchableOpacity 
      style={[styles.notificationItem, { backgroundColor: 'transparent' }]}
      onPress={() => dismissStockAlert(item.id)}
      activeOpacity={0.7}
    >
      <Icon name="warning" size={20} color="#FF8800" style={styles.itemIcon} />
      <View style={styles.contentContainer}>
        <Text style={[styles.notificationTitle, { color: textColor }]}>
          {item.name}
        </Text>
        <Text style={[styles.notificationMessage, { color: mutedColor }]}>
          Stock: {item.currentQuantity}/{item.thresholdLevel}
        </Text>
        <View style={[styles.tagContainer, { backgroundColor: 'rgba(255, 136, 0, 0.1)' }]}>
          <Text style={[styles.tagText, { color: '#FF8800' }]}>Low Stock</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEvent = ({ item }: { item: CalendarEvent }) => (
    <TouchableOpacity
      style={[styles.notificationItem, { backgroundColor: 'transparent' }]}
      onPress={() => dismissEvent(item.id)}
      activeOpacity={0.7}
    >
      <Icon name="event" size={20} color="#2196F3" style={styles.itemIcon} />
      <View style={styles.contentContainer}>
        <Text style={[styles.notificationTitle, { color: textColor }]}>
          {item.title}
        </Text>
        <Text style={[styles.notificationMessage, { color: mutedColor }]}>
          {formatEventDate(item.event_date)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, { backgroundColor: 'transparent' }]}
      onPress={() => dismissNotification(item.id)}
      activeOpacity={0.7}
    >
      <Icon name="schedule" size={20} color={mutedColor} style={styles.itemIcon} />
      <View style={styles.contentContainer}>
        <Text style={[styles.notificationText, { color: textColor }]}>
          {item.message}
        </Text>
        <Text style={[styles.notificationTime, { color: mutedColor }]}>
          {formatNotificationDate(item.createdAt)}
        </Text>
      </View>
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
        <View 
          style={[
            styles.dropdown, 
            { 
              backgroundColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.3 : 0.15,
              shadowRadius: 8,
              elevation: 8,
            }
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            {/* Header - matching Kotlin style */}
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
              <Text style={[styles.headerTitle, { color: textColor }]}>Notifications</Text>
              <View style={styles.headerActions}>
                {/* Close button */}
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                  <Icon name="close" size={18} color={mutedColor} />
                </TouchableOpacity>
                {/* Refresh button */}
                <TouchableOpacity onPress={() => refresh(true)} style={styles.headerButton} disabled={isRefreshing}>
                  <Icon name="refresh" size={18} color={mutedColor} />
                </TouchableOpacity>
                {/* View all button */}
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onViewAll();
                  }}
                  style={styles.headerButton}
                >
                  <Icon name="history" size={18} color={mutedColor} />
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
                <Text style={[styles.emptyText, { color: mutedColor }]}>
                  No new notifications
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollContainer}>
                {/* Stock Alerts Section - matching Kotlin style */}
                {stockAlerts.length > 0 && (
                  <>
                    <SectionHeader title="Stock Alerts" color={mutedColor} />
                    {stockAlerts.map(alert => (
                      <View key={`alert-${alert.id}`}>
                        {renderStockAlert({ item: alert })}
                      </View>
                    ))}
                    {(events.length > 0 || notifications.length > 0) && (
                      <SectionDivider color={borderColor} />
                    )}
                  </>
                )}

                {/* Event Reminders Section - matching Kotlin style */}
                {events.length > 0 && (
                  <>
                    <SectionHeader title="Event Reminders" color={mutedColor} />
                    {events.map(event => (
                      <View key={`event-${event.id}`}>
                        {renderEvent({ item: event })}
                      </View>
                    ))}
                    {notifications.length > 0 && (
                      <SectionDivider color={borderColor} />
                    )}
                  </>
                )}

                {/* General Notifications Section - matching Kotlin style */}
                {notifications.length > 0 && (
                  <>
                    <SectionHeader title="General Notifications" color={mutedColor} />
                    {notifications.map(notification => (
                      <View key={`notif-${notification.id}`}>
                        {renderNotification({ item: notification })}
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 16,
  },
  dropdown: {
    width: 320,
    maxWidth: width - 32,
    maxHeight: Math.min(600, height - 100),
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 14,
  },
  scrollContainer: {
    maxHeight: 400,
  },
  notificationItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  itemIcon: {
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  notificationMessage: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  notificationText: {
    fontSize: 12,
    lineHeight: 16,
  },
  notificationTime: {
    fontSize: 10,
    marginTop: 4,
  },
  tagContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '500',
  },
});

export default NotificationsDropdown;
