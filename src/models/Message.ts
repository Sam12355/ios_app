// Message model - matches Kotlin data class Message
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

// Thread model for inbox
export interface Thread {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_avatar?: string | null;
  last_message: string;
  unread_count: number;
  updated_at: string;
}

// Typing status
export interface TypingStatus {
  userId: string;
  isTyping: boolean;
}

// Online status
export interface OnlineStatus {
  userId: string;
  isOnline: boolean;
}
