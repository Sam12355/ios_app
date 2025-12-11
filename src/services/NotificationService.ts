/**
 * NotificationService - STUB (Firebase removed)
 * 
 * FCM push notifications require a paid Apple Developer account ($99/year).
 * This is a stub file that exports a dummy service to prevent import errors.
 * 
 * Local notifications are handled by LocalNotificationService.ts using @notifee/react-native
 * which works WITHOUT a paid Apple Developer account.
 */

// Notification types matching Kotlin (kept for compatibility)
export const NOTIFICATION_TYPES = {
  GENERAL: 'general',
  STOCK_ALERT: 'stock_alert',
  EVENT: 'event_reminder',
  MESSAGE: 'new_message',
  MOVEOUT: 'moveout',
} as const;

// Listener types (kept for compatibility)
type ChatNavigationListener = (userId: string, userName?: string) => void;
type NotificationTapListener = (data: any) => void;

/**
 * Stub NotificationService - does nothing
 * Use LocalNotificationService instead for local notifications
 */
class NotificationService {
  private static instance: NotificationService;
  private chatNavigationListener: ChatNavigationListener | null = null;
  private notificationTapListener: NotificationTapListener | null = null;
  private currentChatUserId: string | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Stub initialize - logs warning about FCM not being available
   */
  async initialize(): Promise<void> {
    console.log('⚠️ NotificationService: FCM not available (Firebase removed)');
    console.log('📱 Use LocalNotificationService for local notifications instead');
  }

  /**
   * Stub - always returns denied
   */
  async requestPermission(): Promise<number> {
    console.log('⚠️ NotificationService: FCM not available');
    return 0; // DENIED
  }

  /**
   * Stub - returns null
   */
  async getFCMToken(): Promise<string | null> {
    console.log('⚠️ NotificationService: FCM not available');
    return null;
  }

  /**
   * Set the current chat user ID (still works for compatibility)
   */
  setCurrentChatUserId(userId: string | null): void {
    this.currentChatUserId = userId;
  }

  /**
   * Set chat navigation listener (still works for compatibility)
   */
  setChatNavigationListener(listener: ChatNavigationListener | null): void {
    this.chatNavigationListener = listener;
  }

  /**
   * Set notification tap listener (still works for compatibility)
   */
  setNotificationTapListener(listener: NotificationTapListener | null): void {
    this.notificationTapListener = listener;
  }

  /**
   * Stub - does nothing
   */
  async clearFCMToken(): Promise<void> {
    console.log('⚠️ NotificationService: FCM not available');
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();
export default notificationService;
