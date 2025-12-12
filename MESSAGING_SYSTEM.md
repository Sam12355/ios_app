# React Native Messaging System - Matches Kotlin Implementation

## Overview
The React Native messaging system has been updated to **exactly match** the Kotlin Android app's behavior, ensuring consistent user experience across platforms.

## Architecture

### 1. Message Model (`src/models/Message.ts`)
```typescript
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  sent_at?: string;
  created_at?: string;
  delivered_at?: string;
  read_at?: string;
  fcm_message_id?: string;
}
```

Matches Kotlin's `data class Message` exactly.

### 2. Message Store (`src/stores/messageStore.ts`)

**Key Insight from Kotlin**: Badge updates work instantly because:
1. Messages are stored in **LOCAL state** (like Kotlin's `mutableStateMapOf`)
2. When marking as read, **LOCAL state** is updated with `read_at` timestamp
3. Unread count is calculated from **LOCAL state**, not server fetch
4. Socket events update **LOCAL state** directly

**Key Methods**:
- `setMessages()` - Store messages for a conversation (from API)
- `addMessage()` - Add new message to conversation (from socket)
- `markMessagesAsRead()` - Mark messages as read **LOCALLY** (instant!)
- `getUnreadCount()` - Calculate unread count from LOCAL state
- `getTotalUnreadCount()` - Calculate total badge count

### 3. ChatScreen (`src/screens/main/ChatScreen.tsx`)

**Message Display**:
- **Current user's messages**: LEFT side, WHITE bubble, BLACK text
- **Other person's messages**: RIGHT side, BLUE bubble (#0084FF), WHITE text
- **Read receipts**: ✓ (sent), ✓ (delivered), ✓✓ (read in blue)

**Key Features**:
1. **Instant Read Marking**: When opening chat, messages are marked as read immediately
2. **Real-time Updates**: Socket events update messages instantly
3. **Optimistic UI**: Shows sent messages immediately, replaces with real message when confirmed
4. **Typing Indicators**: Shows when other person is typing
5. **Online Status**: Green dot when other person is online
6. **Profile Image Dialog**: Click avatar to view full-size profile picture

**Polling Strategy** (matches Kotlin):
- Poll every 10 seconds for message updates (uses cache when available)
- Force refresh every 30 seconds for read status sync
- Check online status every 60 seconds as fallback (socket is primary)

### 4. InboxScreen (`src/screens/main/InboxScreen.tsx`)

**Thread Display**:
- Shows all conversations with last message preview
- Unread count badge (calculated from LOCAL state!)
- Online status indicator (green dot)
- Click profile picture to view full-size

**Instant Updates** (Kotlin approach):
1. When messages change in store, thread unread counts update **immediately**
2. Socket `new_message` event → update thread locally (no API call!)
3. Only fetch from API on app startup or pull-to-refresh

**Key Features**:
- Hybrid unread count: Prefer local count, fallback to API
- Real-time online status via socket
- Debounced thread fetching (500ms) to prevent redundant calls
- Profile image dialog (same as ChatScreen)

## Socket Integration

### Events Handled:

**Incoming**:
- `new_message` - New message received → add to local state
- `messagesRead` - Messages marked as read → update `read_at` locally
- `typing` / `user_typing` - Other user is typing
- `stop-typing` / `user_stop_typing` - Other user stopped typing
- `onlineMembers` - List of online users updated

**Outgoing**:
- `sendMessage` - Send new message
- `markMessagesAsRead` - Mark conversation as read
- `typing` - Current user is typing
- `stop-typing` - Current user stopped typing

## Read Receipt Logic

### When Messages Are Marked as Read:

1. **Opening ChatScreen**: All unread messages from the other user are marked as read immediately
2. **Receiving new message while in chat**: Marked as read instantly
3. **Socket `messagesRead` event**: Update read status from server (for cross-device sync)

### How Read Status is Updated:

```typescript
// 1. Mark as read LOCALLY (instant badge update!)
markMessagesAsRead(userId);

// 2. Notify server via API (for read receipts on sender's side)
await apiClient.markThreadAsRead(userId);

// 3. Clear cache (force badge refresh)
apiClient.clearUnreadCountCache();
```

This matches Kotlin's approach:
```kotlin
// 1. Update local state
messages = messages.mapValues { (key, msgs) ->
    msgs.map { msg ->
        if (msg.senderId == senderId && msg.readAt == null) {
            msg.copy(readAt = readInstant)
        } else msg
    }
}

// 2. Notify server
apiClient.markThreadAsRead(senderId)
```

## Badge Count Calculation

**Kotlin approach (instant updates)**:
```kotlin
val unreadCount = messages[threadUserId]?.count { 
    message -> message.senderId == threadUserId && message.readAt == null 
} ?: 0
```

**React Native (same approach)**:
```typescript
const unreadCount = messages[threadUserId].filter(
  msg => msg.sender_id === threadUserId && !msg.read_at
).length;
```

Both calculate from **local state**, not API fetch!

## Performance Optimizations

1. **Debounced Thread Fetching**: Prevents redundant API calls (500ms debounce)
2. **Socket-First Online Status**: Check socket before API fallback
3. **Request Caching**: API client caches requests for 15 seconds
4. **Optimistic Updates**: Show sent messages immediately, replace when confirmed
5. **Lazy Loading**: ChatScreen shows last 20 messages initially, load more on scroll

## UI/UX Match with Kotlin

### Message Bubbles:
- ✅ Same colors (white for sent, blue for received)
- ✅ Same text colors (black for sent, white for received)
- ✅ Same alignment (left for sent, right for received)
- ✅ Same read receipts (✓ gray sent, ✓ gray delivered, ✓✓ blue read)
- ✅ Same timestamp format (HH:mm)

### Chat Screen:
- ✅ Profile picture in top bar with online indicator
- ✅ Typing indicator at bottom-right
- ✅ Message input with send button
- ✅ Auto-scroll to bottom on new messages
- ✅ Profile picture dialog on click

### Inbox Screen:
- ✅ Thread list with unread badges
- ✅ Online status indicators
- ✅ Last message preview
- ✅ Pull-to-refresh
- ✅ Profile picture dialog

## Testing Checklist

- [ ] Send message → appears in chat immediately
- [ ] Receive message → appears in chat with correct alignment/color
- [ ] Open chat → badge clears instantly
- [ ] Send message → shows ✓ (sent)
- [ ] Other person reads → shows ✓✓ in blue
- [ ] Typing indicator → shows when other person types
- [ ] Online status → green dot when online
- [ ] Profile picture → click to view full-size
- [ ] Badge count → matches unread messages across both apps
- [ ] Cross-device sync → read status syncs between devices

## Key Differences from Initial Implementation

1. **Local-First Unread Count**: Was using API fetch, now uses local state (Kotlin approach)
2. **Instant Read Marking**: Was delayed, now immediate when opening chat
3. **Socket-First Online Status**: Was API-only, now prioritizes socket
4. **Optimistic Badge Updates**: Clears badge immediately when opening chat
5. **Debounced Thread Fetching**: Prevents redundant API calls on rapid state changes

## Conclusion

The React Native messaging system now **exactly matches** the Kotlin implementation:
- ✅ Same message display (colors, alignment, read receipts)
- ✅ Same badge update behavior (instant, local-first)
- ✅ Same polling strategy (10s messages, 30s read status, 60s online)
- ✅ Same socket integration (real-time updates)
- ✅ Same UI/UX (profile dialogs, typing indicators, online status)

Both platforms provide a **consistent, real-time messaging experience** with instant badge updates and reliable read receipts.
