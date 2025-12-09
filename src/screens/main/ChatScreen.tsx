import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { Message } from '../../models/Inventory';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

type ChatRouteParams = {
  Chat: {
    threadId: string;
  };
};

export const ChatScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ChatRouteParams, 'Chat'>>();
  const flatListRef = useRef<FlatList>(null);
  
  const threadId = route.params?.threadId;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [participantName, setParticipantName] = useState('');

  const fetchMessages = useCallback(async () => {
    if (!threadId) return;
    
    try {
      const data = await apiClient.getMessages(threadId);
      setMessages(data || []);
      // Mark as read
      await apiClient.markThreadAsRead(threadId);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!threadId || !messageText.trim()) return;
    
    setSending(true);
    try {
      await apiClient.sendMessage(threadId, messageText.trim());
      setMessageText('');
      fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.outline,
    },
    backButton: {
      marginRight: 12,
    },
    headerContent: {
      flex: 1,
    },
    headerName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.onSurface,
    },
    headerStatus: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
    },
    messagesContainer: {
      flex: 1,
      padding: 16,
    },
    dateSeparator: {
      alignItems: 'center',
      marginVertical: 16,
    },
    dateSeparatorText: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      backgroundColor: colors.surfaceVariant,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    messageContainer: {
      maxWidth: '80%',
      marginBottom: 8,
    },
    myMessage: {
      alignSelf: 'flex-end',
    },
    otherMessage: {
      alignSelf: 'flex-start',
    },
    messageBubble: {
      padding: 12,
      borderRadius: 16,
    },
    myBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    otherBubble: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 20,
    },
    myMessageText: {
      color: colors.onPrimary,
    },
    otherMessageText: {
      color: colors.onSurface,
    },
    messageTime: {
      fontSize: 11,
      marginTop: 4,
    },
    myMessageTime: {
      color: colors.onPrimary,
      opacity: 0.7,
      textAlign: 'right',
    },
    otherMessageTime: {
      color: colors.onSurfaceVariant,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 12,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.outline,
    },
    textInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.background,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
      minHeight: 44,
      maxHeight: 120,
    },
    textInput: {
      flex: 1,
      fontSize: 16,
      color: colors.onSurface,
      maxHeight: 100,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.surfaceVariant,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: 12,
    },
  });

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.sender_id === user?.id;
    const showDate = index === 0 || 
      formatDate(messages[index - 1]?.created_at) !== formatDate(item.created_at);

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.messageContainer, isMyMessage ? styles.myMessage : styles.otherMessage]}>
          <View style={[styles.messageBubble, isMyMessage ? styles.myBubble : styles.otherBubble]}>
            <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loader]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerName}>{participantName || 'Chat'}</Text>
          <Text style={styles.headerStatus}>Active now</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesContainer}
        inverted={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="chat-bubble-outline" size={64} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>Start a conversation</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />
        </View>
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Icon name="send" size={20} color={messageText.trim() ? colors.onPrimary : colors.onSurfaceVariant} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;
