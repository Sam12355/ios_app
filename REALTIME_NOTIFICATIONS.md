# Real-Time Notifications via Socket.IO

## Overview

The app now uses **Socket.IO for real-time notifications** instead of polling. This provides instant delivery of notifications when events occur on the server.

## How It Works

### Client-Side Implementation

**SocketService.ts** - Listens to 3 new socket events:

1. **`new_notification`** - General notifications
   - Shows notifee alert with custom title and message
   - Data: `{ id, title, message/body, type }`

2. **`stock_alert`** - Low stock warnings
   - Shows "⚠️ Low Stock Alert" notification
   - Data: `{ id, item_name, current_quantity, threshold_level }`

3. **`new_event`** - Calendar events
   - Shows "📅 Upcoming Event" notification
   - Data: `{ id, title, event_date }`

### Pattern Used

Following the existing `new_message` event pattern:

```typescript
this.socket.on('new_notification', (data: any) => {
  // 1. Log the event
  debugLog('[SocketService] 🔔 New notification received:', data);
  
  // 2. Notify internal listeners (for UI updates)
  this.notifyListeners('new_notification', data);
  
  // 3. Trigger notifee notification immediately
  localNotificationService.showNotification(title, message, data);
});
```

## Server-Side Requirements

The backend must emit these socket events when notifications occur:

### 1. General Notifications
```javascript
// When a new notification is created
io.to(`user_${userId}`).emit('new_notification', {
  id: notification.id,
  title: notification.title,
  message: notification.message,
  type: notification.type,
  created_at: notification.created_at
});
```

### 2. Stock Alerts
```javascript
// When stock falls below threshold
io.to(`branch_${branchId}`).emit('stock_alert', {
  id: alert.id,
  item_id: item.id,
  item_name: item.name,
  current_quantity: item.quantity,
  threshold_level: item.minimum_stock,
  created_at: alert.created_at
});
```

### 3. Calendar Events
```javascript
// When event is created or 7 days before event
io.to(`branch_${branchId}`).emit('new_event', {
  id: event.id,
  title: event.title,
  event_date: event.event_date,
  description: event.description,
  created_at: event.created_at
});
```

## Benefits vs Polling

✅ **Instant delivery** - No delay, notifications arrive in milliseconds  
✅ **Efficient** - No repeated API calls, only when events occur  
✅ **Battery friendly** - Socket maintains persistent connection, no polling timers  
✅ **Works in background** - Socket connection persists when app is backgrounded  
✅ **Same pattern as messages** - Reuses proven infrastructure

## Fallback Strategy

`BackgroundNotificationService` is kept as a fallback:
- Trigger notifications every 5-30 minutes (for when socket disconnects)
- Used only if socket connection fails
- Provides redundancy for critical alerts

## Testing

1. **Create a notification** on the server → Should appear instantly on device
2. **Lower stock below threshold** → Should trigger alert immediately  
3. **Create calendar event** → Should notify user right away
4. **Background app** → Notifications should still arrive (socket stays connected)
5. **Close app completely** → Fallback trigger notifications activate

## Notification Tap Handling

When user taps a notification:
- **Messages**: Navigate to Chat screen
- **Other types**: Show popup modal with title + message + close button

Handled in `AppNavigator.tsx` with `notifee.onForegroundEvent()` listener.

## Socket Events Summary

| Event | Purpose | Notification Title | Data Required |
|-------|---------|-------------------|---------------|
| `new_notification` | General alerts | Custom from data | `id, title, message, type` |
| `stock_alert` | Low stock warnings | "⚠️ Low Stock Alert" | `id, item_name, current_quantity, threshold_level` |
| `new_event` | Calendar reminders | "📅 Upcoming Event" | `id, title, event_date` |
| `new_message` | Chat messages | "New Message" | `senderId, senderName, content, senderPhoto` |

## Files Modified

- ✅ `src/services/SocketService.ts` - Added 3 new event listeners
- ✅ `src/navigation/AppNavigator.tsx` - Notification tap modal
- ✅ `src/components/NotificationsDropdown.tsx` - Only show new items
- ℹ️ `src/services/LocalNotificationService.ts` - Already had `showNotification()` method
- ℹ️ `src/services/BackgroundNotificationService.ts` - Kept as fallback

## Next Steps for Backend

1. Emit `new_notification` event when notifications are created
2. Emit `stock_alert` event when stock goes below threshold
3. Emit `new_event` event when events are created or 7 days before
4. Test socket events are reaching clients correctly
