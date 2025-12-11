/**
 * LocalNotificationService - Local Notifications using Notifee
 * Works without Apple Developer account - shows in status bar just like push notifications!
 * Triggered by Socket.IO events when new messages arrive
 */

import notifee, {
  AndroidImportance,
  AndroidStyle,
  AuthorizationStatus,
  EventType,
  Notification,
} from '@notifee/react-native';
import { Platform, AppState, AppStateStatus } from 'react-native';

// Notification channel ID for Android
const MESSAGES_CHANNEL_ID = 'stocknexus_messages';
const GENERAL_CHANNEL_ID = 'stocknexus_general';

// Listener types
type NotificationTapListener = (data: { userId?: string; userName?: string; type?: string }) => void;

class LocalNotificationService {
  private static instance: LocalNotificationService;
  private currentChatUserId: string | null = null;
  private notificationTapListener: NotificationTapListener | null = null;
  private isAppInForeground = true;
  private isInitialized = false;

  private constructor() {
    // Monitor app state
    AppState.addEventListener('change', this.handleAppStateChange);
    this.isAppInForeground = AppState.currentState === 'active';
  }

  static getInstance(): LocalNotificationService {
    if (!LocalNotificationService.instance) {
      LocalNotificationService.instance = new LocalNotificationService();
    }
    return LocalNotificationService.instance;
  }

  private handleAppStateChange = (state: AppStateStatus) => {
    this.isAppInForeground = state === 'active';
    console.log('📱 LocalNotifications: App state changed to:', state, 'In foreground:', this.isAppInForeground);
  };

  /**
   * Initialize the notification service
   * Call this on app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 LocalNotifications: Already initialized');
      return;
    }

    console.log('📱 LocalNotifications: Initializing...');

    try {
      // Request permission
      const settings = await notifee.requestPermission();
      console.log('📱 LocalNotifications: Permission status:', settings.authorizationStatus);

      if (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
      ) {
        // Create notification channels for Android
        if (Platform.OS === 'android') {
          await this.createChannels();
        }

        // Set up foreground event handler
        this.setupEventHandlers();

        this.isInitialized = true;
        console.log('📱 LocalNotifications: Initialized successfully ✅');
      } else {
        console.log('📱 LocalNotifications: Permission denied');
      }
    } catch (error) {
      console.error('📱 LocalNotifications: Initialization error:', error);
    }
  }

  /**
   * Create notification channels (Android only)
   */
  private async createChannels(): Promise<void> {
    // Messages channel with high importance
    await notifee.createChannel({
      id: MESSAGES_CHANNEL_ID,
      name: 'Messages',
      description: 'New message notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    // General notifications channel
    await notifee.createChannel({
      id: GENERAL_CHANNEL_ID,
      name: 'General',
      description: 'General notifications',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
    });

    console.log('📱 LocalNotifications: Channels created');
  }

  /**
   * Set up notification event handlers
   */
  private setupEventHandlers(): void {
    // Handle notification events when app is in foreground
    notifee.onForegroundEvent(({ type, detail }) => {
      console.log('📱 LocalNotifications: Foreground event:', type, detail.notification?.data);

      if (type === EventType.PRESS) {
        this.handleNotificationTap(detail.notification);
      }
    });

    // Handle notification events when app is in background
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log('📱 LocalNotifications: Background event:', type, detail.notification?.data);

      if (type === EventType.PRESS) {
        this.handleNotificationTap(detail.notification);
      }
    });
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(notification: Notification | undefined): void {
    if (!notification?.data) return;

    const { userId, userName, type } = notification.data as any;
    console.log('📱 LocalNotifications: Notification tapped, navigating to:', userId, userName);

    if (this.notificationTapListener) {
      this.notificationTapListener({ userId, userName, type });
    }
  }

  /**
   * Set listener for notification taps (to navigate to chat)
   */
  setNotificationTapListener(listener: NotificationTapListener | null): void {
    this.notificationTapListener = listener;
  }

  /**
   * Set the current chat user ID to suppress notifications for that conversation
   */
  setCurrentChatUserId(userId: string | null): void {
    console.log('📱 LocalNotifications: Current chat user set to:', userId);
    this.currentChatUserId = userId;
  }

  /**
   * Show a local notification for a new message
   * This is triggered by Socket.IO when a new message arrives
   */
  async showMessageNotification(
    senderId: string,
    senderName: string,
    messageContent: string,
    senderPhoto?: string
  ): Promise<void> {
    // Don't show notification if:
    // 1. This is from the user we're currently chatting with
    // 2. App is in foreground AND we're in that chat
    if (this.currentChatUserId === senderId) {
      console.log('📱 LocalNotifications: Suppressed - user is in this chat');
      return;
    }

    console.log('📱 LocalNotifications: Showing message notification from:', senderName);

    try {
      await notifee.displayNotification({
        title: senderName,
        body: messageContent,
        data: {
          userId: senderId,
          userName: senderName,
          type: 'new_message',
        },
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
          channelId: MESSAGES_CHANNEL_ID,
          smallIcon: 'ic_notification', // Make sure this exists in android/app/src/main/res/drawable
          pressAction: {
            id: 'default',
          },
          style: {
            type: AndroidStyle.BIGTEXT,
            text: messageContent,
          },
        },
      });

      console.log('📱 LocalNotifications: Message notification displayed ✅');
    } catch (error) {
      console.error('📱 LocalNotifications: Error showing notification:', error);
    }
  }

  /**
   * Show a test notification - useful for testing!
   */
  async showTestNotification(): Promise<void> {
    console.log('📱 LocalNotifications: Showing TEST notification...');

    try {
      await notifee.displayNotification({
        title: '🧪 Test Notification',
        body: 'This is a test notification from Stock Nexus! Pull down your status bar to see it.',
        data: {
          type: 'test',
        },
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
          pressAction: {
            id: 'default',
          },
        },
      });

      console.log('📱 LocalNotifications: TEST notification displayed ✅');
    } catch (error) {
      console.error('📱 LocalNotifications: Error showing test notification:', error);
    }
  }

  /**
   * Show a general notification
   */
  async showNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
    console.log('📱 LocalNotifications: Showing notification:', title);

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
          pressAction: {
            id: 'default',
          },
        },
      });

      console.log('📱 LocalNotifications: Notification displayed ✅');
    } catch (error) {
      console.error('📱 LocalNotifications: Error showing notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await notifee.cancelAllNotifications();
    console.log('📱 LocalNotifications: All notifications cancelled');
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await notifee.getBadgeCount();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await notifee.setBadgeCount(count);
  }

  /**
   * Clear badge
   */
  async clearBadge(): Promise<void> {
    await notifee.setBadgeCount(0);
  }
}

// Export singleton instance
export const localNotificationService = LocalNotificationService.getInstance();
export default localNotificationService;
