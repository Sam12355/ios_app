// SocketService.ts - Socket.IO service for React Native
// Matches the Kotlin SocketIOService for online presence and messaging

import { io, Socket } from 'socket.io-client';
import { localNotificationService } from './LocalNotificationService';

const SOCKET_URL = 'https://stock-nexus-84-main-2-1.onrender.com';

interface OnlineMember {
  id: string;
  name?: string;
  photoUrl?: string;
}

type SocketEventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentToken: string | null = null;
  private currentBranchId: string | null = null;
  private currentUserId: string | null = null;
  
  // Event listeners
  private listeners: Map<string, SocketEventCallback[]> = new Map();
  
  // Online members state
  private _onlineMembers: OnlineMember[] = [];
  private onlineMembersCallbacks: ((members: OnlineMember[]) => void)[] = [];

  connect(token: string, branchId: string, userId: string) {
    // Always disconnect and reconnect to ensure fresh connection
    this.disconnect();

    console.log('[SocketService] 🔌 Connecting to Socket.IO server...');
    console.log('[SocketService] 🔌 Branch ID:', branchId);
    console.log('[SocketService] 🔌 User ID:', userId);
    console.log('[SocketService] 🔌 Server URL:', SOCKET_URL);

    this.currentToken = token;
    this.currentBranchId = branchId;
    this.currentUserId = userId;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      query: { branchId },
      transports: ['polling', 'websocket'], // polling first like Kotlin
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
    });

    this.socket.on('connect', () => {
      console.log('[SocketService] ✅ Connected to Socket.IO server:', this.socket?.id);
      this.isConnected = true;

      // Join the branch room
      if (this.currentBranchId) {
        this.socket?.emit('join-branch', this.currentBranchId);
        console.log('[SocketService] 👥 Joined branch room:', this.currentBranchId);
      }

      // Join personal user room for direct messages
      if (this.currentUserId) {
        this.socket?.emit('join-room', this.currentUserId);
        console.log('[SocketService] 🚪 Joined personal room:', this.currentUserId);
      }

      // Request online members list
      this.socket?.emit('get-online-members');
      console.log('[SocketService] 📡 Requesting online members list');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketService] ❌ Disconnected from Socket.IO server:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketService] ❌ Socket.IO connection error:', error.message);
      this.isConnected = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[SocketService] 🔄 Reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;

      // Rejoin rooms after reconnection
      if (this.currentBranchId) {
        this.socket?.emit('join-branch', this.currentBranchId);
      }
      if (this.currentUserId) {
        this.socket?.emit('join-room', this.currentUserId);
      }
      this.socket?.emit('get-online-members');
    });

    // Online presence events
    this.socket.on('online-members', (data: any) => {
      try {
        const members: OnlineMember[] = [];
        if (Array.isArray(data)) {
          for (const item of data) {
            const id = item.id || item.userId || '';
            const name = item.name || null;
            const photoUrl = item.photoUrl || item.photo_url || null;
            if (id) {
              members.push({ id, name, photoUrl });
            }
          }
        }
        console.log('[SocketService] 👥 Online members updated:', members.length);
        this._onlineMembers = members;
        this.notifyOnlineMembersChange();
      } catch (e) {
        console.error('[SocketService] Error processing online-members:', e);
      }
    });

    this.socket.on('user-online', (data: any) => {
      try {
        const id = data?.id || data?.userId || '';
        const name = data?.name || null;
        const photoUrl = data?.photoUrl || data?.photo_url || null;
        if (id && !this._onlineMembers.some(m => m.id === id)) {
          this._onlineMembers = [{ id, name, photoUrl }, ...this._onlineMembers];
          console.log('[SocketService] ➕ User online:', id, name);
          this.notifyOnlineMembersChange();
        }
      } catch (e) {
        console.error('[SocketService] Error processing user-online:', e);
      }
    });

    this.socket.on('user-offline', (data: any) => {
      try {
        const id = data?.id || data?.userId || '';
        if (id) {
          this._onlineMembers = this._onlineMembers.filter(m => m.id !== id);
          console.log('[SocketService] ➖ User offline:', id);
          this.notifyOnlineMembersChange();
        }
      } catch (e) {
        console.error('[SocketService] Error processing user-offline:', e);
      }
    });

    // Messaging events
    this.socket.on('new_message', (data: any) => {
      console.log('[SocketService] 💬 New message received:', JSON.stringify(data).substring(0, 200));
      this.notifyListeners('new_message', data);
      
      // Trigger local notification if message is from another user
      const senderId = data?.sender_id || data?.senderId;
      if (senderId && senderId !== this.currentUserId) {
        const senderName = data?.sender_name || data?.senderName || 'New Message';
        const content = data?.content || data?.message || 'You have a new message';
        const senderPhoto = data?.sender_photo || data?.senderPhoto;
        
        console.log('[SocketService] 📱 Triggering local notification for message from:', senderName);
        localNotificationService.showMessageNotification(senderId, senderName, content, senderPhoto);
      }
    });

    this.socket.on('user_typing', (data: any) => {
      console.log('[SocketService] ⌨️ User typing:', data);
      this.notifyListeners('typing', data);
      this.notifyListeners('user_typing', data);
    });

    this.socket.on('user_stop_typing', (data: any) => {
      console.log('[SocketService] ⏸️ User stop typing:', data);
      this.notifyListeners('stop-typing', data);
      this.notifyListeners('user_stop_typing', data);
    });

    // Also listen for 'typing' and 'stop-typing' events directly
    this.socket.on('typing', (data: any) => {
      console.log('[SocketService] ⌨️ Typing event:', data);
      this.notifyListeners('typing', data);
    });

    this.socket.on('stop-typing', (data: any) => {
      console.log('[SocketService] ⏸️ Stop-typing event:', data);
      this.notifyListeners('stop-typing', data);
    });

    this.socket.on('messageDelivered', (data: any) => {
      console.log('[SocketService] ✓ Message delivered:', data);
      this.notifyListeners('message_delivered', data);
      this.notifyListeners('messageDelivered', data);
    });

    this.socket.on('messagesRead', (data: any) => {
      console.log('[SocketService] ✓✓ Messages read:', data);
      this.notifyListeners('message_read', data);
      this.notifyListeners('messagesRead', data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('[SocketService] 🔌 Disconnecting from Socket.IO server...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentToken = null;
      this.currentBranchId = null;
      this.currentUserId = null;
      this._onlineMembers = [];
    }
  }

  // Subscribe to online members changes
  onOnlineMembersChange(callback: (members: OnlineMember[]) => void) {
    this.onlineMembersCallbacks.push(callback);
    // Immediately call with current value
    callback(this._onlineMembers);
    
    // Return unsubscribe function
    return () => {
      this.onlineMembersCallbacks = this.onlineMembersCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyOnlineMembersChange() {
    for (const cb of this.onlineMembersCallbacks) {
      cb(this._onlineMembers);
    }
  }

  // Get current online members
  getOnlineMembers(): OnlineMember[] {
    return this._onlineMembers;
  }

  // Check if a user is online
  isUserOnline(userId: string): boolean {
    return this._onlineMembers.some(m => m.id === userId);
  }

  // Subscribe to socket events
  on(event: string, callback: SocketEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  // Unsubscribe from socket events
  off(event: string, callback?: SocketEventCallback) {
    if (callback) {
      const callbacks = this.listeners.get(event) || [];
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    } else {
      this.listeners.delete(event);
    }
  }

  private notifyListeners(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event) || [];
    for (const cb of callbacks) {
      try {
        cb(...args);
      } catch (e) {
        console.error(`[SocketService] Error in ${event} listener:`, e);
      }
    }
  }

  // Emit events
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[SocketService] Cannot emit, socket not connected');
    }
  }

  // Typing indicators
  emitTyping(receiverId: string) {
    this.emit('typing', { receiverId, userId: this.currentUserId });
  }

  emitStopTyping(receiverId: string) {
    this.emit('stop-typing', { receiverId, userId: this.currentUserId });
  }

  // Mark messages as read - matches Kotlin: markMessagesRead with conversationPartnerId
  emitMarkRead(conversationPartnerId: string) {
    console.log('[SocketService] 👁️ Emitting markMessagesRead for:', conversationPartnerId);
    this.emit('markMessagesRead', { conversationPartnerId });
  }

  // Join conversation
  joinConversation(otherUserId: string) {
    this.emit('join-conversation', { otherUserId });
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  forceReconnect() {
    console.log('[SocketService] 🔄 Forcing reconnection...');
    if (this.currentToken && this.currentBranchId && this.currentUserId) {
      this.connect(this.currentToken, this.currentBranchId, this.currentUserId);
    }
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

// Singleton instance
export const socketService = new SocketService();
export default socketService;
