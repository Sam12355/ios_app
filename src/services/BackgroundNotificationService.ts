/**
 * BackgroundNotificationService - Handle notifications when app is minimized/closed
 * Uses notifee's background event handlers and trigger notifications
 */

import notifee, { AndroidImportance, TriggerType, TimestampTrigger } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import apiClient from '../api/ApiClient';

const LAST_NOTIFICATION_IDS_KEY = 'last_notification_ids';
const LAST_STOCK_ALERT_IDS_KEY = 'last_stock_alert_ids';
const LAST_EVENT_IDS_KEY = 'last_event_ids';

const GENERAL_CHANNEL_ID = 'stocknexus_general';
const MESSAGES_CHANNEL_ID = 'stocknexus_messages';

class BackgroundNotificationService {
  private static instance: BackgroundNotificationService;
  private checkInterval: NodeJS.Timeout | null = null;
  private appState: AppStateStatus = 'active';

  private constructor() {
    // Monitor app state changes
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  static getInstance(): BackgroundNotificationService {
    if (!BackgroundNotificationService.instance) {
      BackgroundNotificationService.instance = new BackgroundNotificationService();
    }
    return BackgroundNotificationService.instance;
  }

  /**
   * Schedule periodic background check for new notifications
   * Creates multiple trigger notifications at different intervals
   */
  async scheduleBackgroundChecks(): Promise<void> {
    try {
      // Cancel any existing scheduled checks
      await notifee.cancelTriggerNotifications();

      // Schedule multiple triggers at 5, 10, 15, 20, 25, 30 minute intervals
      const intervals = [5, 10, 15, 20, 25, 30];
      
      for (const minutes of intervals) {
        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: Date.now() + minutes * 60 * 1000,
        };

        await notifee.createTriggerNotification(
          {
            id: `background-check-${minutes}`,
            data: { type: 'background_check', interval: minutes.toString() },
            android: {
              channelId: GENERAL_CHANNEL_ID,
              importance: AndroidImportance.MIN,
              ongoing: false,
              autoCancel: true,
              showTimestamp: false,
            },
            ios: {
              categoryId: 'background-check',
            },
          },
          trigger
        );
      }

      console.log('📱 [BackgroundNotificationService] Scheduled background checks at:', intervals, 'minutes');
    } catch (error) {
      console.error('📱 [BackgroundNotificationService] Error scheduling checks:', error);
    }
  }

  /**
   * Check for new notifications and display them
   */
  async checkForNewNotifications(): Promise<void> {
    try {
      console.log('📱 [BackgroundNotificationService] Checking for new notifications...');

      // Load previously seen IDs from storage
      const [lastNotifIds, lastStockIds, lastEventIds] = await Promise.all([
        AsyncStorage.getItem(LAST_NOTIFICATION_IDS_KEY),
        AsyncStorage.getItem(LAST_STOCK_ALERT_IDS_KEY),
        AsyncStorage.getItem(LAST_EVENT_IDS_KEY),
      ]);

      const previousNotifIds = new Set<string>(JSON.parse(lastNotifIds || '[]'));
      const previousStockIds = new Set<string>(JSON.parse(lastStockIds || '[]'));
      const previousEventIds = new Set<string>(JSON.parse(lastEventIds || '[]'));

      // Fetch current data - FORCE FRESH API CALLS (no cache)
      // Add timestamp to bypass cache
      const timestamp = Date.now();
      const [notificationsData, stockData, eventsData] = await Promise.all([
        apiClient.request('/notifications?t=' + timestamp, { method: 'GET' }, undefined, 0, 3, true).then((res: any) => res.data || []).catch(() => []),
        apiClient.request('/stock?t=' + timestamp, { method: 'GET' }, undefined, 0, 3, true).then((res: any) => res.data || []).catch(() => []),
        apiClient.request('/calendar-events?t=' + timestamp, { method: 'GET' }, undefined, 0, 3, true).then((res: any) => res.data || []).catch(() => []),
      ]);

      // Process general notifications
      const unreadNotifs = (notificationsData || [])
        .filter((n: any) => !n.is_read)
        .map((n: any) => ({
          id: n.id,
          message: n.message?.replace(/<[^>]*>/g, '').trim() || '',
          type: n.type || 'general',
        }));

      for (const notif of unreadNotifs) {
        if (!previousNotifIds.has(notif.id)) {
          await this.displayNotification(
            'Stock Nexus',
            notif.message,
            { type: notif.type, notificationId: notif.id, message: notif.message }
          );
        }
      }

      // Process stock alerts
      const stockAlerts = (stockData || [])
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

      for (const alert of stockAlerts) {
        if (!previousStockIds.has(alert.id)) {
          const message = `${alert.name} - Stock: ${alert.currentQuantity}/${alert.thresholdLevel}`;
          await this.displayNotification(
            '⚠️ Low Stock Alert',
            message,
            { type: 'stock_alert', itemId: alert.id, message }
          );
        }
      }

      // Process upcoming events
      const upcomingEvents = (eventsData || [])
        .filter((event: any) => {
          const eventDate = new Date(event.event_date);
          const now = new Date();
          const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7;
        })
        .slice(0, 5);

      for (const event of upcomingEvents) {
        if (!previousEventIds.has(event.id)) {
          const eventDate = new Date(event.event_date);
          const dateStr = eventDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const message = `${event.title} - ${dateStr}`;
          await this.displayNotification(
            '📅 Upcoming Event',
            message,
            { type: 'event', eventId: event.id, message }
          );
        }
      }

      // Save current IDs for next check
      await Promise.all([
        AsyncStorage.setItem(
          LAST_NOTIFICATION_IDS_KEY,
          JSON.stringify(unreadNotifs.map((n: any) => n.id))
        ),
        AsyncStorage.setItem(
          LAST_STOCK_ALERT_IDS_KEY,
          JSON.stringify(stockAlerts.map((a: any) => a.id))
        ),
        AsyncStorage.setItem(
          LAST_EVENT_IDS_KEY,
          JSON.stringify(upcomingEvents.map((e: any) => e.id))
        ),
      ]);

      console.log('📱 [BackgroundNotificationService] ✅ Check complete');
    } catch (error) {
      console.error('📱 [BackgroundNotificationService] Error checking notifications:', error);
    }
  }

  /**
   * Display a notification using notifee
   */
  private async displayNotification(
    title: string,
    body: string,
    data: Record<string, string>
  ): Promise<void> {
    try {
      await notifee.displayNotification({
        title,
        body,
        data,
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            badge: true,
            sound: true,
            banner: true,
            list: true,
          },
        },
        android: {
          channelId: GENERAL_CHANNEL_ID,
          smallIcon: 'ic_notification',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
        },
      });

      console.log('📱 [BackgroundNotificationService] Displayed:', title);
    } catch (error) {
      console.error('📱 [BackgroundNotificationService] Display error:', error);
    }
  }

  /**
   * Handle app state changes to manage background polling
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('📱 [BackgroundNotificationService] App state changed:', this.appState, '->', nextAppState);
    
    if (this.appState === 'active' && nextAppState.match(/inactive|background/)) {
      // App going to background - start more frequent polling
      console.log('📱 [BackgroundNotificationService] 🔴 NEW CODE v2 - App backgrounded - scheduling short triggers');
      this.startBackgroundPolling();
    } else if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App coming to foreground - stop polling (NotificationsDropdown will handle it)
      console.log('📱 [BackgroundNotificationService] App foregrounded - stopping polling');
      this.stopBackgroundPolling();
    }
    
    this.appState = nextAppState;
  };

  /**
   * Start background polling when app is minimized
   * Note: setInterval doesn't work reliably on iOS background
   * Instead, schedule trigger notifications that will wake the app
   */
  private async startBackgroundPolling(): Promise<void> {
    try {
      // Clear any existing interval
      this.stopBackgroundPolling();
      // 🟡 Starting background polling... (NO background check notifications will be shown)
      // No notifee notifications will be created for background checks.
      // If you want to trigger real notification checks, do it silently here (e.g., via silent push or background fetch, not notifee UI)
    } catch (error) {
      console.error('📱 [BackgroundNotificationService] ❌ Error in startBackgroundPolling:', error);
    }
  }

  /**
   * Stop background polling
   */
  private stopBackgroundPolling(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Initialize the background service
   */
  async initialize(): Promise<void> {
    console.log('📱 [BackgroundNotificationService] Initializing...');
    
    // Schedule periodic checks using trigger notifications
    await this.scheduleBackgroundChecks();
    
    // Start polling if app is already in background
    if (this.appState === 'background') {
      this.startBackgroundPolling();
    }
    
    console.log('📱 [BackgroundNotificationService] ✅ Initialized');
  }
}

export const backgroundNotificationService = BackgroundNotificationService.getInstance();
export default backgroundNotificationService;
