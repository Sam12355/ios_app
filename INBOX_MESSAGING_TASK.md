# Stock Nexus React Native - Inbox & Messaging Feature Task

## Overview

Implement the Inbox (conversations list) and Chat screens with real-time messaging, typing indicators, read receipts, and online status - matching the Android app EXACTLY.

---

## Feature Flow

```
Dashboard Top Bar → Envelope Icon (with unread badge)
                  ↓
            Inbox Screen (Thread List)
                  ↓
         Click on a conversation
                  ↓
            Chat Screen (Messages)
```

---

## Screen 1: Inbox Screen (Conversations List)

### Layout

```
┌─────────────────────────────────┐
│  ← Inbox                     +  │  Top bar (dark: #1C1C1E)
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ ●  [Avatar]  John Doe     │  │  Thread item
│  │              Last message │  │
│  │              2:30 PM   [3]│  │  Time + unread badge
│  └───────────────────────────┘  │
│  ─────────────────────────────  │  Divider
│  ┌───────────────────────────┐  │
│  │ ⚪  [Avatar]  Jane Smith   │  │  Offline user
│  │              Previous msg │  │
│  │              Yesterday    │  │
│  └───────────────────────────┘  │
│  ─────────────────────────────  │
│  ┌───────────────────────────┐  │
│  │ ●  [Avatar]  Mike Wilson  │  │  Online with unread
│  │              Hey there!   │  │
│  │              11:45 AM  [1]│  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
│  [FAB: + Compose]               │  Bottom right
└─────────────────────────────────┘
```

### Design Specifications

**Colors:**

- Background: `#000000` (pure black)
- Thread item background (unread): `#252528` (slightly lighter)
- Thread item background (read): `#1C1C1E` (dark gray)
- Top bar: `#1C1C1E`
- Text primary: `#FFFFFF`
- Text secondary: `#808080`
- Online indicator: `#00D856` (green dot)
- Unread badge: `#E6002A` (red circle)
- Divider: `#CCCCCC` with 0.5dp thickness

**Thread Item Components:**

1. **Avatar (56x56):**

   - If `photoUrl` exists: Show image in circle
   - If no photo: Show initials (first 2 letters uppercase) in blue circle `#0084FF`
   - Clickable: Opens full-size profile photo dialog

2. **Online Indicator:**

   - Green circle `#00D856`, size 12x12
   - Positioned at bottom-right of avatar
   - Solid fill (no border)
   - Only show if user is in `onlineMembers` array

3. **Thread Content:**

   ```
   Name (16sp, bold, white)
   Last Message (14sp, gray #808080, single line, ellipsize end)
   Time + Unread Badge (12sp, gray)
   ```

4. **Unread Badge:**

   - Red circle `#E6002A`
   - White text, bold
   - Min size: 20x20
   - Shows count (e.g., "3" or "99+" for >99)
   - Positioned at end of time text

5. **Timestamp Formatting:**
   ```typescript
   - Today: Show time "2:30 PM"
   - Yesterday: Show "Yesterday"
   - This week: Show day "Monday"
   - Older: Show date "Nov 29"
   ```

### Component Code Structure

```tsx
// screens/InboxScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../api/ApiClient";
import { Thread, Message } from "../models";

interface InboxScreenProps {
  navigation: any;
  currentUserId: string;
  onlineMembers: string[];
}

export const InboxScreen: React.FC<InboxScreenProps> = ({
  navigation,
  currentUserId,
  onlineMembers,
}) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState<
    string | null
  >(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      const threadsData = await apiClient.getThreads();
      setThreads(threadsData);

      // Load messages for each thread to calculate unread count
      const messagesData: Record<string, Message[]> = {};
      for (const thread of threadsData) {
        const msgs = await apiClient.getMessages(thread.user2Id);
        messagesData[thread.user2Id] = msgs;
      }
      setMessages(messagesData);
    } catch (error) {
      console.log("Error loading threads:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadThreads();
    setIsRefreshing(false);
  }, []);

  const getUnreadCount = (userId: string): number => {
    const userMessages = messages[userId] || [];
    return userMessages.filter((msg) => msg.senderId === userId && !msg.readAt)
      .length;
  };

  const handleThreadClick = (thread: Thread) => {
    navigation.navigate("Chat", {
      userId: thread.user2Id,
      userName: thread.displayName,
      userPhoto: thread.displayPhoto,
    });
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Inbox</Text>
        <TouchableOpacity onPress={() => setShowComposeDialog(true)}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Threads List */}
      {threads.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No messages yet.{"\n"}Pull down to refresh.
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadItem
              thread={item}
              isOnline={onlineMembers.includes(item.user2Id)}
              unreadCount={getUnreadCount(item.user2Id)}
              onPress={() => handleThreadClick(item)}
              onAvatarPress={() => {
                if (item.displayPhoto) {
                  setSelectedProfileImage(item.displayPhoto);
                }
              }}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#E6002A"
            />
          }
        />
      )}

      {/* FAB - Compose New Message */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowComposeDialog(true)}
      >
        <Ionicons name="add" size={28} color="#000000" />
      </TouchableOpacity>

      {/* Profile Image Full Screen Modal */}
      {selectedProfileImage && (
        <Modal
          visible={true}
          transparent={true}
          onRequestClose={() => setSelectedProfileImage(null)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: selectedProfileImage }}
                style={styles.fullImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedProfileImage(null)}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Compose Message Dialog */}
      {showComposeDialog && (
        <ComposeMessageDialog
          onDismiss={() => setShowComposeDialog(false)}
          onUserSelected={(userId, message) => {
            // Send first message and open chat
            // Implementation below
          }}
        />
      )}
    </View>
  );
};

// Thread Item Component
const ThreadItem = ({
  thread,
  isOnline,
  unreadCount,
  onPress,
  onAvatarPress,
}: {
  thread: Thread;
  isOnline: boolean;
  unreadCount: number;
  onPress: () => void;
  onAvatarPress: () => void;
}) => (
  <TouchableOpacity
    style={[styles.threadItem, unreadCount > 0 && styles.threadItemUnread]}
    onPress={onPress}
  >
    <View style={styles.threadContent}>
      {/* Avatar with online indicator */}
      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={onAvatarPress}>
          {thread.displayPhoto ? (
            <Image
              source={{ uri: thread.displayPhoto }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {thread.displayName?.substring(0, 2).toUpperCase() || "U"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {isOnline && <View style={styles.onlineIndicator} />}
      </View>

      {/* Thread info */}
      <View style={styles.threadInfo}>
        <Text style={styles.threadName}>{thread.displayName}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {thread.lastMessageContent || "No messages yet"}
        </Text>
      </View>

      {/* Time & Badge */}
      <View style={styles.threadMeta}>
        <Text style={styles.timestamp}>
          {formatThreadTime(thread.lastMessageAt)}
        </Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 48,
    backgroundColor: "#1C1C1E",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#808080",
    textAlign: "center",
  },
  threadItem: {
    backgroundColor: "#1C1C1E",
    padding: 16,
  },
  threadItemUnread: {
    backgroundColor: "#252528",
  },
  threadContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0084FF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00D856",
  },
  threadInfo: {
    flex: 1,
  },
  threadName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: "#808080",
  },
  threadMeta: {
    alignItems: "flex-end",
  },
  timestamp: {
    fontSize: 12,
    color: "#808080",
    marginBottom: 4,
  },
  unreadBadge: {
    backgroundColor: "#E6002A",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  divider: {
    height: 0.5,
    backgroundColor: "#CCCCCC",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: "85%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
});

// Helper: Format thread timestamp
function formatThreadTime(timestamp: string | null): string {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today - show time
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}
```

---

## Screen 2: Chat Screen (Messaging)

### Layout

```
┌─────────────────────────────────┐
│  ← ● [Avatar] John Doe          │  Top bar (dark: #1C1C1E)
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────┐            │  Other's message (right)
│  │ Hey there!      │            │  Blue bubble (#0084FF)
│  │ 2:30 PM         │            │  White text
│  └─────────────────┘            │
│                                 │
│            ┌─────────────────┐  │  Your message (left)
│            │ Hi! How are you?│  │  White bubble
│            │ 2:31 PM      ✓✓│  │  Black text + read receipt
│            └─────────────────┘  │
│                                 │
│  ┌─────────────────┐            │  Other's message
│  │ I'm good thanks │            │
│  │ 2:32 PM         │            │
│  └─────────────────┘            │
│                                 │
│            ┌─────────────────┐  │  Your message
│            │ Great to hear!  │  │
│            │ 2:33 PM      ✓ │  │  Delivered (gray tick)
│            └─────────────────┘  │
│                                 │
│  [Typing indicator: ●●●]        │  When other user is typing
│                                 │
├─────────────────────────────────┤
│  [Type a message...]       [➤] │  Input bar (dark: #1C1C1E)
└─────────────────────────────────┘
```

### Design Specifications

**Colors:**

- Background: `#000000` (pure black)
- Top bar: `#1C1C1E`
- Your message bubble: `#FFFFFF` (white)
- Your message text: `#000000` (black)
- Other's message bubble: `#0084FF` (blue)
- Other's message text: `#FFFFFF` (white)
- Input bar: `#1C1C1E`
- Input field border (focused): `#FFFFFF`
- Input field border (unfocused): `#808080`
- Send button (enabled): `#0084FF`
- Send button (disabled): `#3D3D3D`
- Read receipt (read): `#0084FF` (blue double tick)
- Read receipt (delivered): `#808080` (gray single tick)
- Read receipt (sent): `#808080` with 30% opacity
- Typing indicator bubble: `#0084FF`
- Typing indicator dots: `#FFFFFF` with 90% opacity

**Message Bubble Specifications:**

1. **Your Messages (Left Side):**

   - Bubble color: `#FFFFFF` (white)
   - Text color: `#000000` (black)
   - Border radius: `topStart: 16, topEnd: 16, bottomStart: 4, bottomEnd: 16`
   - Max width: 280dp
   - Padding: 12dp horizontal, 8dp vertical
   - Shows read receipts at bottom-right

2. **Other's Messages (Right Side):**

   - Bubble color: `#0084FF` (blue)
   - Text color: `#FFFFFF` (white)
   - Border radius: `topStart: 16, topEnd: 16, bottomStart: 16, bottomEnd: 4`
   - Max width: 280dp
   - Padding: 12dp horizontal, 8dp vertical
   - No read receipts

3. **Read Receipts (Your Messages Only):**

   ```
   Sent: ✓ (gray with 30% opacity)
   Delivered: ✓ (gray #808080)
   Read: ✓✓ (blue #0084FF, letter-spacing: -3sp for tight spacing)
   ```

4. **Timestamp Format:**
   ```
   Format: "h:mm a" (e.g., "2:30 PM")
   Color: Same as bubble text with 70% opacity
   Font size: 11sp
   ```

### Typing Indicator

When other user is typing, show animated dots:

```
Position: Bottom-right corner, 80dp from bottom
Background: #0084FF rounded (12dp)
Padding: 10dp horizontal, 6dp vertical
Dots: 3 white circles (5dp each), 3dp spacing
Animation: Bounce up/down alternating (600ms, 150ms delay between dots)
```

### Real-Time Features via Socket.IO

**Socket Events to Listen:**

1. **new_message** - Receive new messages

   ```typescript
   socket.on("new_message", (data) => {
     // Add message to chat
     // Auto-scroll to bottom
     // Play notification sound (if app in background)
   });
   ```

2. **typing** - Other user started typing

   ```typescript
   socket.on("typing", (data) => {
     if (data.senderId === otherUserId) {
       setIsTyping(true);
     }
   });
   ```

3. **stop-typing** - Other user stopped typing

   ```typescript
   socket.on("stop-typing", (data) => {
     if (data.senderId === otherUserId) {
       setIsTyping(false);
     }
   });
   ```

4. **message_read** - Your message was read

   ```typescript
   socket.on("message_read", (data) => {
     // Update message readAt timestamp
     // Change tick from gray to blue double tick
   });
   ```

5. **message_delivered** - Your message was delivered
   ```typescript
   socket.on("message_delivered", (data) => {
     // Update message deliveredAt timestamp
     // Change tick from light gray to dark gray
   });
   ```

**Socket Events to Emit:**

1. **Send typing indicator:**

   ```typescript
   // When user types in input
   socket.emit("typing", { receiverId: otherUserId });

   // After 2 seconds of no typing
   socket.emit("stop-typing", { receiverId: otherUserId });
   ```

2. **Join conversation:**

   ```typescript
   // When chat screen opens
   socket.emit("join-conversation", { otherUserId });
   ```

3. **Mark messages as read:**
   ```typescript
   // When chat screen is visible and has unread messages
   socket.emit("mark_read", { senderId: otherUserId });
   ```

### Component Code Structure

```tsx
// screens/ChatScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../api/ApiClient";
import { socketService } from "../services/SocketService";
import { Message } from "../models";

interface ChatScreenProps {
  route: {
    params: {
      userId: string;
      userName: string;
      userPhoto?: string;
    };
  };
  navigation: any;
  currentUserId: string;
  isOnline: boolean;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  route,
  navigation,
  currentUserId,
  isOnline,
}) => {
  const { userId, userName, userPhoto } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);
  const [showProfileImage, setShowProfileImage] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadMessages();
    joinConversation();
    setupSocketListeners();

    return () => {
      // Cleanup: stop typing, leave conversation
      if (isCurrentlyTyping) {
        socketService.emit("stop-typing", { receiverId: userId });
      }
    };
  }, []);

  const loadMessages = async () => {
    try {
      const msgs = await apiClient.getMessages(userId);
      setMessages(msgs);

      // Mark all messages from this user as read
      const unreadMessages = msgs.filter(
        (msg) => msg.senderId === userId && !msg.readAt
      );
      if (unreadMessages.length > 0) {
        await apiClient.markMessagesAsRead(userId);
        socketService.emit("mark_read", { senderId: userId });
      }
    } catch (error) {
      console.log("Error loading messages:", error);
    }
  };

  const joinConversation = () => {
    socketService.emit("join-conversation", { otherUserId: userId });
  };

  const setupSocketListeners = () => {
    // New message
    socketService.on("new_message", (data: Message) => {
      if (data.senderId === userId || data.senderId === currentUserId) {
        setMessages((prev) => [...prev, data]);
        scrollToBottom();

        // Mark as read immediately if from other user
        if (data.senderId === userId) {
          apiClient.markMessagesAsRead(userId);
          socketService.emit("mark_read", { senderId: userId });
        }
      }
    });

    // Typing indicator
    socketService.on("typing", (data: any) => {
      if (data.senderId === userId) {
        setIsTyping(true);
      }
    });

    socketService.on("stop-typing", (data: any) => {
      if (data.senderId === userId) {
        setIsTyping(false);
      }
    });

    // Message read
    socketService.on("message_read", (data: any) => {
      if (data.userId === userId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId === currentUserId && !msg.readAt
              ? { ...msg, readAt: new Date().toISOString() }
              : msg
          )
        );
      }
    });

    // Message delivered
    socketService.on("message_delivered", (data: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, deliveredAt: new Date().toISOString() }
            : msg
        )
      );
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageText = input.trim();
    setInput("");

    // Stop typing indicator
    if (isCurrentlyTyping) {
      setIsCurrentlyTyping(false);
      socketService.emit("stop-typing", { receiverId: userId });
    }

    try {
      await apiClient.sendMessage(userId, messageText);
      // Message will be added via socket 'new_message' event
    } catch (error) {
      console.log("Error sending message:", error);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);

    // Emit typing indicator
    if (text.length > 0 && !isCurrentlyTyping) {
      setIsCurrentlyTyping(true);
      socketService.emit("typing", { receiverId: userId });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of no input
    if (text.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isCurrentlyTyping) {
          setIsCurrentlyTyping(false);
          socketService.emit("stop-typing", { receiverId: userId });
        }
      }, 2000);
    } else {
      // Input cleared, stop typing immediately
      if (isCurrentlyTyping) {
        setIsCurrentlyTyping(false);
        socketService.emit("stop-typing", { receiverId: userId });
      }
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          {/* Avatar with online indicator */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              onPress={() => userPhoto && setShowProfileImage(true)}
            >
              {userPhoto ? (
                <Image source={{ uri: userPhoto }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {userName.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>

          <Text style={styles.userName}>{userName}</Text>
        </View>

        <View style={{ width: 24 }} />
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isFromCurrentUser={item.senderId === currentUserId}
          />
        )}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
      />

      {/* Typing Indicator */}
      {isTyping && (
        <View style={styles.typingContainer}>
          <View style={styles.typingBubble}>
            <TypingDots />
          </View>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#808080"
          value={input}
          onChangeText={handleInputChange}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !input.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={input.trim() ? "#FFFFFF" : "#808080"}
          />
        </TouchableOpacity>
      </View>

      {/* Profile Image Modal */}
      {showProfileImage && userPhoto && (
        <Modal
          visible={true}
          transparent={true}
          onRequestClose={() => setShowProfileImage(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: userPhoto }}
                style={styles.fullImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowProfileImage(false)}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
};

// Message Bubble Component
const MessageBubble = ({
  message,
  isFromCurrentUser,
}: {
  message: Message;
  isFromCurrentUser: boolean;
}) => {
  const bubbleColor = isFromCurrentUser ? "#FFFFFF" : "#0084FF";
  const textColor = isFromCurrentUser ? "#000000" : "#FFFFFF";
  const alignment = isFromCurrentUser ? "flex-start" : "flex-end";

  return (
    <View style={[styles.messageBubbleContainer, { alignItems: alignment }]}>
      <View
        style={[
          styles.messageBubble,
          {
            backgroundColor: bubbleColor,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: isFromCurrentUser ? 4 : 16,
            borderBottomRightRadius: isFromCurrentUser ? 16 : 4,
          },
        ]}
      >
        <Text style={[styles.messageText, { color: textColor }]}>
          {message.content}
        </Text>

        <View style={styles.messageFooter}>
          <Text style={[styles.timestamp, { color: textColor, opacity: 0.7 }]}>
            {formatMessageTime(message.sentAt)}
          </Text>

          {/* Read Receipts (only for sent messages) */}
          {isFromCurrentUser && (
            <View style={styles.receiptContainer}>
              {message.readAt ? (
                <Text style={styles.receiptRead}>✓✓</Text>
              ) : message.deliveredAt ? (
                <Text style={styles.receiptDelivered}>✓</Text>
              ) : (
                <Text style={styles.receiptSent}>✓</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// Typing Dots Animation
const TypingDots = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -5,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, []);

  return (
    <View style={styles.dotsContainer}>
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: dot1 }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: dot2 }] }]}
      />
      <Animated.View
        style={[styles.dot, { transform: [{ translateY: dot3 }] }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    paddingTop: 48,
    backgroundColor: "#1C1C1E",
  },
  topBarCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(230, 0, 42, 0.3)",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E6002A",
    borderWidth: 2,
    borderColor: "rgba(230, 0, 42, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#00D856",
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  messagesList: {
    padding: 8,
    paddingBottom: 16,
  },
  messageBubbleContainer: {
    width: "100%",
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  messageBubble: {
    maxWidth: 280,
    padding: 12,
    paddingVertical: 8,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 3,
  },
  timestamp: {
    fontSize: 11,
  },
  receiptContainer: {
    marginLeft: 3,
  },
  receiptRead: {
    fontSize: 11,
    color: "#0084FF",
    letterSpacing: -3,
  },
  receiptDelivered: {
    fontSize: 11,
    color: "#808080",
  },
  receiptSent: {
    fontSize: 11,
    color: "#808080",
    opacity: 0.3,
  },
  typingContainer: {
    alignItems: "flex-end",
    paddingRight: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: "#0084FF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    backgroundColor: "#1C1C1E",
  },
  input: {
    flex: 1,
    backgroundColor: "#2D2D2D",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0084FF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#3D3D3D",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: "85%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
});

// Helper: Format message timestamp
function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
```

---

## Screen 3: Compose Message Dialog

### Layout

```
┌─────────────────────────────────┐
│  New Message              [X]   │  Dialog header
├─────────────────────────────────┤
│  To:                            │
│  ┌───────────────────────────┐  │
│  │ Search contact...      ▼ │  │  Searchable dropdown
│  └───────────────────────────┘  │
│                                 │
│  [User List Dropdown]           │  Shows when focused
│  ┌───────────────────────────┐  │
│  │ ● JD  John Doe            │  │  Clickable user item
│  │ ⚪ JS  Jane Smith         │  │
│  │ ● MW  Mike Wilson         │  │
│  └───────────────────────────┘  │
│                                 │
│  Message:                       │
│  ┌───────────────────────────┐  │
│  │                           │  │  Multi-line text input
│  │ Type your message...      │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│      [Cancel]        [Send]     │  Action buttons
└─────────────────────────────────┘
```

### Functionality

1. **Load all staff users** on dialog open: `GET /api/users`
2. **Search filter** - filter users by name as user types
3. **Select user** - tap on user in list to select (highlight with blue background)
4. **Enter message** - type first message to send
5. **Send** - Creates conversation and sends first message, then opens chat screen
6. **API**: `POST /api/messages` with `{receiverId, content}`

---

## API Endpoints

```typescript
// Threads & Messages
GET  /api/threads                 // Get all conversations
GET  /api/messages/:userId        // Get messages with specific user
POST /api/messages                // Send message {receiverId, content}
PUT  /api/messages/read/:userId   // Mark messages as read

// Users (for compose dialog)
GET  /api/users                   // Get all staff users

// Socket.IO Events
socket.emit('join-conversation', {otherUserId})
socket.emit('typing', {receiverId})
socket.emit('stop-typing', {receiverId})
socket.emit('mark_read', {senderId})

socket.on('new_message', (message) => {})
socket.on('typing', (data) => {})
socket.on('stop-typing', (data) => {})
socket.on('message_read', (data) => {})
socket.on('message_delivered', (data) => {})
socket.on('online-members', (members) => {})
```

---

## Data Models

```typescript
interface Thread {
  id: string;
  user1Id: string;
  user2Id: string;
  displayName: string;
  displayPhoto?: string;
  lastMessageContent?: string;
  lastMessageAt?: string;
  createdAt: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
}
```

---

## Navigation Flow

```typescript
// In DashboardScreen.tsx - Envelope icon press
<TouchableOpacity onPress={() => navigation.navigate('Inbox')}>
  <Ionicons name="mail" size={22} color="#FFFFFF" />
  {unreadMessages > 0 && <Badge count={unreadMessages} />}
</TouchableOpacity>

// In InboxScreen.tsx - Thread item press
<TouchableOpacity onPress={() => navigation.navigate('Chat', {
  userId: thread.user2Id,
  userName: thread.displayName,
  userPhoto: thread.displayPhoto,
})}>

// In InboxScreen.tsx - FAB press
<TouchableOpacity onPress={() => setShowComposeDialog(true)}>

// In ComposeDialog - After sending first message
navigation.replace('Chat', {
  userId: selectedUserId,
  userName: selectedUserName,
  userPhoto: selectedUserPhoto,
});
```

---

## Key Implementation Notes

1. **Auto-scroll behavior:**

   - Scroll to bottom when new message arrives
   - Scroll to bottom when typing indicator appears
   - Only scroll if user is already near bottom OR message is from current user

2. **Typing indicator debounce:**

   - Emit "typing" when user starts typing
   - Clear timeout on each keystroke
   - Emit "stop-typing" after 2 seconds of no input
   - Emit "stop-typing" immediately when input is cleared
   - Emit "stop-typing" before sending message

3. **Read receipts logic:**

   - Mark messages as read when chat screen is open
   - Update receipt icons in real-time via socket
   - Only show receipts on YOUR messages (not on received messages)

4. **Online status:**

   - Get online members from Socket.IO "online-members" event
   - Show green dot on avatar if user.id is in onlineMembers array
   - Update in real-time as users come online/offline

5. **Profile photo modal:**

   - Square aspect ratio (not circle)
   - 85% screen width
   - Rounded corners (12dp)
   - Small close button (20x20) at top-right with margin
   - Semi-transparent black background (60% opacity) on button

6. **Unread badge calculation:**
   - Count messages where `senderId === otherUserId && readAt === null`
   - Update badge when new message arrives
   - Clear badge when user opens chat

---

## Testing Checklist

- [ ] Inbox loads all conversations correctly
- [ ] Online status shows green dot for online users
- [ ] Unread badge shows correct count
- [ ] Pull-to-refresh works on inbox
- [ ] FAB opens compose dialog
- [ ] Compose dialog loads all users
- [ ] Search filter works in compose dialog
- [ ] Sending first message creates conversation and opens chat
- [ ] Chat screen loads all messages
- [ ] Messages appear on correct side (left=yours, right=theirs)
- [ ] Typing indicator appears when other user types
- [ ] Typing indicator disappears after 2 seconds
- [ ] Sending message stops typing indicator
- [ ] Messages auto-scroll to bottom
- [ ] Read receipts update in real-time (gray → blue)
- [ ] Profile photo modal opens on avatar tap
- [ ] Profile photo modal has square aspect ratio
- [ ] Back button navigates correctly
- [ ] Socket.IO connects and receives events
- [ ] Unread messages marked as read when chat opens
- [ ] Keyboard avoiding works properly (iOS)

---

## Socket.IO Service Setup

```typescript
// services/SocketService.ts
import io, { Socket } from "socket.io-client";
import { APIConfig } from "../config";

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(userId: string, token: string) {
    if (this.socket?.connected) return;

    this.socket = io(APIConfig.socketURL, {
      transports: ["websocket"],
      auth: { token },
    });

    this.socket.on("connect", () => {
      console.log("✅ Socket connected");
      this.socket?.emit("user-connected", { userId });
    });

    this.socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    this.socket?.on(event, (...args) => {
      this.listeners.get(event)?.forEach((cb) => cb(...args));
    });
  }

  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.listeners.clear();
  }
}

export const socketService = new SocketService();
```

---

This is the complete guide for implementing the Inbox and Messaging feature in React Native iOS app, matching the Android implementation exactly!
