import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import App from './src/App';
import notifee, { EventType } from '@notifee/react-native';
import { backgroundNotificationService } from './src/services/BackgroundNotificationService';

// Note: Firebase/FCM removed - using Notifee for local notifications instead
// Local notifications are triggered by Socket.IO events and background checks

// Handle background events (when app is minimized or closed)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('[Notifee] Background event:', type, detail.notification?.data);

  if (type === EventType.DELIVERED) {
    // Check if this is our background check trigger (either short-interval or long-interval)
    if (detail.notification?.data?.type === 'background_check') {
      console.log('[Notifee] Background check triggered, checking for new notifications...');
      try {
        await backgroundNotificationService.checkForNewNotifications();
        
        // If this was a short interval trigger, reschedule more short triggers
        const interval = parseInt(detail.notification?.data?.interval || '0', 10);
        if (interval <= 60) {
          // Short interval - reschedule more short checks
          console.log('[Notifee] Rescheduling short-interval background checks...');
        } else {
          // Long interval - reschedule regular checks
          await backgroundNotificationService.scheduleBackgroundChecks();
        }
      } catch (error) {
        console.log('[Notifee] Background check error:', error);
      }
    }
  }

  if (type === EventType.PRESS) {
    // Notification was tapped - will be handled by the app when it opens
    console.log('[Notifee] Notification tapped:', detail.notification?.data);
  }
});

AppRegistry.registerComponent(appName, () => App);
