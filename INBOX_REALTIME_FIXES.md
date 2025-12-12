# Inbox Real-Time Updates & Notification Navigation Fixes

## Issues Fixed

### 1. ❌ Inbox badges not showing instantly
**Problem**: Had to manually pull-to-refresh to see unread message badges in Inbox threads.

**Solution**: Added socket.io listener for `new_message` events that automatically refreshes threads when a new message arrives.

### 2. ❌ Notification tap didn't navigate to chat
**Problem**: Tapping a message notification didn't open the specific chat thread.

**Solution**: Set up notification tap handler in AppNavigator that navigates to the Chat screen with the sender's info.

---

## Changes Made

### InboxScreen.tsx

**Added real-time socket listener**:
```typescript
// Listen for new messages to refresh threads instantly
const handleNewMessage = (data: any) => {
  console.log('[InboxScreen] 📬 New message received via socket - refreshing threads');
  // Refresh threads to update unread counts and last message
  fetchThreads();
};

socketService.on('new_message', handleNewMessage);
```

**What this does**:
- Listens for incoming messages via Socket.IO
- Automatically calls `fetchThreads()` to refresh the thread list
- Updates unread badges instantly without manual pull-to-refresh
- Works in combination with existing `useFocusEffect` for navigation-based refresh

### AppNavigator.tsx

**Added notification tap handler**:
```typescript
// Set up notification tap handler to navigate to chat
useEffect(() => {
  localNotificationService.setNotificationTapListener((data) => {
    console.log('[AppNavigator] 📱 Notification tapped:', data);
    
    if (data.userId && data.type === 'new_message') {
      // Navigate to Chat screen with the sender's info
      navigation.navigate('Chat', {
        userId: data.userId,
        userName: data.userName || 'User',
      });
    }
  });

  return () => {
    localNotificationService.setNotificationTapListener(null);
  };
}, [navigation]);
```

**What this does**:
- Registers a callback with `localNotificationService`
- When user taps a message notification, extracts `userId` and `userName` from notification data
- Navigates directly to the Chat screen with that user
- Opens the specific conversation where the new message came from

---

## How It Works

### Inbox Badge Flow:

1. **New message arrives** → Socket.IO emits `new_message` event
2. **InboxScreen** receives event → Calls `fetchThreads()`
3. **fetchThreads()** → Fetches threads + unread counts in parallel
4. **UI updates** → Unread badges appear instantly (no pull-to-refresh needed)

### Notification Tap Flow:

1. **User taps notification** → Notifee triggers foreground/background event
2. **LocalNotificationService** → Calls registered tap listener with notification data
3. **AppNavigator** → Receives callback with `userId`, `userName`, `type`
4. **Navigation** → `navigation.navigate('Chat', { userId, userName })`
5. **ChatScreen** → Opens with the specific user's conversation

---

## Testing Instructions

### Test 1: Inbox Real-Time Updates

1. Have the app open on Inbox screen
2. Send a message from another account/device
3. **Expected**: Inbox thread list refreshes automatically, unread badge appears instantly
4. **No need to pull down to refresh!**

### Test 2: Notification Navigation

1. Close or background the app
2. Send a message from another account
3. **Expected**: Notifee notification appears in status bar
4. Tap the notification
5. **Expected**: App opens directly to Chat screen with that specific conversation

### Test 3: Combined Flow

1. App in background, receive message → notification appears
2. Tap notification → opens to Chat screen
3. Go back to Inbox
4. **Expected**: Unread badge should update (marked as read after viewing chat)

---

## Code Structure

```
AppNavigator.tsx
├── localNotificationService.setNotificationTapListener()
│   └── navigation.navigate('Chat', { userId, userName })
│
InboxScreen.tsx
├── socketService.on('new_message')
│   └── fetchThreads() → updates unread badges
├── useFocusEffect()
│   └── fetchThreads() → refresh when returning from ChatScreen
└── onRefresh()
    └── fetchThreads() → manual pull-to-refresh still works
```

---

## Key Points

✅ **Instant Badge Updates**: No more manual refresh needed - badges update when messages arrive

✅ **Direct Navigation**: Tapping notification opens the exact chat thread

✅ **Multiple Refresh Triggers**:
- Socket event (real-time)
- Screen focus (navigation-based)
- Pull-to-refresh (manual)

✅ **No Breaking Changes**: All existing functionality preserved

✅ **TypeScript Errors**: All resolved ✓

---

## Dependencies

- `socketService` - Already connected and listening for events
- `localNotificationService` - Already showing notifications
- `fetchThreads()` - Existing function, just called from new places
- Navigation prop - Standard React Navigation

---

**Result**: Inbox now updates in real-time, and notifications navigate to the correct chat! 🚀
