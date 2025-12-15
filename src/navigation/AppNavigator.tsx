import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer, useNavigation, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../api/ApiClient';
import { UserRole } from '../models';
import { socketService } from '../services/SocketService';
import { localNotificationService } from '../services/LocalNotificationService';
import { useAuthStore } from '../stores/authStore';
import { useMessageStore, initMessageStoreSocketListeners } from '../stores/messageStore';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { AuthStackParamList, DrawerParamList, getNavigationItemsForRole, MainStackParamList, RootStackParamList } from './types';

// Auth Screens
import {
    ForgotPasswordScreen,
    PendingAccessScreen,
    SignInScreen,
    SignUpScreen,
} from '../screens/auth';

// Main Screens - All from screens/main/
import ActivityLogsScreen from '../screens/main/ActivityLogsScreen';
import AnalyticsScreen from '../screens/main/AnalyticsScreen';
import ChatScreen from '../screens/main/ChatScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import ICADeliveryScreen from '../screens/main/ICADeliveryScreen';
import InboxScreen from '../screens/main/InboxScreen';
import ItemsScreen from '../screens/main/ItemsScreen';
import MoveoutListScreen from '../screens/main/MoveoutListScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import RecordStockInScreen from '../screens/main/RecordStockInScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import StaffScreen from '../screens/main/StaffScreen';
import StockInScreen from '../screens/main/StockInScreen';
import StockOutScreen from '../screens/main/StockOutScreen';

// Management Screens
import {
    BranchManagementScreen,
    DistrictManagementScreen,
    RegionManagementScreen,
} from '../screens/management';

// Components
import CustomDrawer from '../components/CustomDrawer';
import NotificationsDropdown from '../components/NotificationsDropdown';
import SearchModal from '../components/SearchModal';
import TopAppBar from '../components/TopAppBar';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const debugLog = (...args: any[]) => {
  if (__DEV__) console.log(...args);
};

const AuthNavigator = () => {
  const { colors } = useTheme();
  
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="PendingAccess" component={PendingAccessScreen} />
    </AuthStack.Navigator>
  );
};

const DrawerNavigator = () => {
  const { colors, isDark } = useTheme();
  const { profile } = useAuthStore();
  // Subscribe to messages state directly (Kotlin approach - re-renders when messages change!)
  const messages = useMessageStore((state) => state.messages);
  const currentUserId = useMessageStore((state) => state.currentUserId);
  const currentChatUserId = useMessageStore((state) => state.currentChatUserId);
  const setCurrentUserId = useMessageStore((state) => state.setCurrentUserId);
  
  // Calculate unread count from local messages (matches Kotlin exactly!)
  // messages.values.flatten().count { message -> message.senderId != currentUserState.id && message.readAt == null }
  const localUnreadCount = React.useMemo(() => {
    if (!currentUserId) return 0;
    let total = 0;
    Object.entries(messages).forEach(([partnerId, msgList]) => {
      msgList.forEach((msg) => {
        if (msg.sender_id !== currentUserId && !msg.read_at) {
          total++;
        }
      });
    });
    debugLog('[AppNavigator] 📊 Calculated local unread count:', total, 'from', Object.keys(messages).length, 'conversations');
    return total;
  }, [messages, currentUserId]);
  
  const navigation = useNavigation<any>();
  const userRole = (profile?.role || 'staff') as UserRole;
  const navItems = getNavigationItemsForRole(userRole);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [showNotificationDetail, setShowNotificationDetail] = useState(false);
  const [notificationDetail, setNotificationDetail] = useState<{title: string; message: string; type: string} | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  
  // Initialize message store socket listeners once
  useEffect(() => {
    initMessageStoreSocketListeners();
  }, []);

  // Register badge decrement callback for fast updates from NotificationsScreen
  useEffect(() => {
    apiClient.setBadgeDecrementCallback(() => {
      setNotificationCount(prev => Math.max(0, prev - 1));
      debugLog('[AppNavigator] 🔔 Badge decremented');
    });
    return () => {
      apiClient.setBadgeDecrementCallback(null);
    };
  }, []);
  
  // Set current user ID in message store
  useEffect(() => {
    if (profile?.id) {
      setCurrentUserId(profile.id);
      debugLog('[AppNavigator] 👤 Set currentUserId:', profile.id);
    }
  }, [profile?.id, setCurrentUserId]);
  
  // Use LOCAL unread count for immediate updates (Kotlin approach!)
  // Only fall back to API count when NO conversations are loaded in store
  // (localUnreadCount=0 is valid when all messages are read!)
  const hasLocalMessages = Object.keys(messages).length > 0;
  const displayUnreadCount = hasLocalMessages ? localUnreadCount : unreadMessagesCount;
  
  // Debug logging for badge updates
  useEffect(() => {
    debugLog('[AppNavigator] 🏷️ Badge update: local=' + localUnreadCount + ', api=' + unreadMessagesCount + ', display=' + displayUnreadCount + ', hasLocal=' + hasLocalMessages);
  }, [localUnreadCount, unreadMessagesCount, displayUnreadCount, hasLocalMessages]);

  // Fetch unread message count (for initial load and fallback)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await apiClient.getTotalUnreadMessageCount();
      if (count === null) {
        debugLog('[AppNavigator] ⚠️ Unread fetch failed - skipping badge update');
        return;
      }
      debugLog('[AppNavigator] 📊 API unread count:', count, 'Local count:', localUnreadCount);
      setUnreadMessagesCount(count);
    } catch (error) {
      console.error('[AppNavigator] Error fetching unread count:', error);
    }
  }, [localUnreadCount]);

  // Fetch on mount and set up polling
  useEffect(() => {
    fetchUnreadCount();
    
    // REMOVED POLLING: Local count from message store is primary source
    // Only fetch on mount, socket events will keep it updated
    // const interval = setInterval(fetchUnreadCount, 90000);
    
    // Listen for new messages via socket to update badge immediately
    const handleNewMessage = (data: any) => {
      const senderId = data?.sender_id || data?.senderId;
      if (senderId && senderId !== profile?.id) {
        // DON'T increment if user is currently viewing that chat!
        if (currentChatUserId === senderId) {
          debugLog('[AppNavigator] 📬 New message from current chat - NOT incrementing badge');
          return;
        }
        // Increment API-based unread count as fallback
        setUnreadMessagesCount(prev => prev + 1);
        debugLog('[AppNavigator] 📬 New message received, incrementing unread count');
      }
    };
    
    // Listen for messages being read - no need to fetch API anymore!
    // The local message store handles this automatically
    const handleMessagesRead = (data: any) => {
      debugLog('[AppNavigator] 📖 Messages marked as read - local store will update');
      // Only fetch API as a background sync (not critical path)
      setTimeout(() => {
        fetchUnreadCount();
      }, 2000); // 2s delay - not urgent since local state is primary
    };
    
    socketService.on('new_message', handleNewMessage);
    socketService.on('messagesRead', handleMessagesRead);
    socketService.on('message_read', handleMessagesRead);
    
    return () => {
      // No interval to clear anymore
      socketService.off('new_message', handleNewMessage);
      socketService.off('messagesRead', handleMessagesRead);
      socketService.off('message_read', handleMessagesRead);
    };
  }, [fetchUnreadCount, profile?.id, currentChatUserId]);

  // Set up notification tap handler to navigate to chat or show popup
  useEffect(() => {
    localNotificationService.setNotificationTapListener((data) => {
      debugLog('[AppNavigator] 📱 Notification tapped:', data);
      
      if (data.userId && data.type === 'new_message') {
        // Navigate to Chat screen with the sender's info
        navigation.navigate('Chat', {
          userId: data.userId,
          userName: data.userName || 'User',
        });
      } else if (data.type && data.message) {
        // Show popup for other notification types
        let title = 'Notification';
        if (data.type === 'stock_alert') title = '⚠️ Low Stock Alert';
        else if (data.type === 'event') title = '📅 Upcoming Event';
        else title = 'Stock Nexus';
        
        setNotificationDetail({ title, message: data.message, type: data.type });
        setShowNotificationDetail(true);
      }
    });

    return () => {
      localNotificationService.setNotificationTapListener(null);
    };
  }, [navigation]);

  return (
    <>
      <SearchModal 
        visible={showSearchModal} 
        onClose={() => setShowSearchModal(false)} 
      />
      <NotificationsDropdown
        visible={showNotificationsDropdown}
        onClose={() => setShowNotificationsDropdown(false)}
        onViewAll={() => {
          setShowNotificationsDropdown(false);
          navigation.navigate('Notifications');
        }}
        onNotificationCountChange={setNotificationCount}
      />
      <Modal
        visible={showNotificationDetail}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotificationDetail(false)}
      >
        <View style={notificationModalStyles.overlay}>
          <View style={[notificationModalStyles.container, { backgroundColor: colors.cardBackground }]}>
            <View style={notificationModalStyles.header}>
              <Text style={[notificationModalStyles.title, { color: colors.text }]}>
                {notificationDetail?.title}
              </Text>
              <TouchableOpacity 
                onPress={() => setShowNotificationDetail(false)}
                style={notificationModalStyles.closeButton}
              >
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[notificationModalStyles.message, { color: colors.textSecondary }]}>
              {notificationDetail?.message}
            </Text>
            <TouchableOpacity 
              style={[notificationModalStyles.button, { backgroundColor: Colors.primary }]}
              onPress={() => setShowNotificationDetail(false)}
            >
              <Text style={notificationModalStyles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={({ navigation: navProp }) => ({
          header: () => (
            <TopAppBar
              onMenuPress={() => navProp.openDrawer()}
              onSearchPress={() => setShowSearchModal(true)}
              onNotificationsPress={() => setShowNotificationsDropdown(true)}
              onInboxPress={() => navigation.navigate('Inbox')}
              onAvatarClick={(member) => {
                // Navigate to Chat screen when avatar is clicked
                navigation.navigate('Chat', {
                  userId: member.id,
                  userName: member.name || 'User',
                  userPhoto: member.photoUrl,
                });
              }}
              notificationCount={notificationCount}
              unreadMessagesCount={displayUnreadCount}
            />
          ),
          drawerType: 'front',
          drawerActiveBackgroundColor: Colors.primary + '20',
          drawerActiveTintColor: Colors.primary,
          drawerInactiveTintColor: colors.text,
          drawerStyle: {
            backgroundColor: 'transparent',
          },
          drawerContentStyle: {
            backgroundColor: 'transparent',
          },
          sceneContainerStyle: {
            backgroundColor: colors.background,
          },
          overlayColor: 'rgba(0, 0, 0, 0.15)',
        })}
      >
      <Drawer.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      {navItems.some(i => i.route === 'BranchManagement') && (
        <Drawer.Screen 
          name="BranchManagement" 
          component={BranchManagementScreen}
          options={{ title: 'Branch Management' }}
        />
      )}
      {navItems.some(i => i.route === 'Staff') && (
        <Drawer.Screen 
          name="Staff" 
          component={StaffScreen}
          options={{ title: 'Manage Staff' }}
        />
      )}
      {navItems.some(i => i.route === 'Items') && (
        <Drawer.Screen 
          name="Items" 
          component={ItemsScreen}
          options={{ title: 'Manage Items' }}
        />
      )}
      <Drawer.Screen 
        name="StockOut" 
        component={StockOutScreen}
        options={{ title: 'Stock Out' }}
      />
      {navItems.some(i => i.route === 'ICADelivery') && (
        <Drawer.Screen 
          name="ICADelivery" 
          component={ICADeliveryScreen}
          options={{ title: 'ICA Delivery' }}
        />
      )}
      {navItems.some(i => i.route === 'StockIn') && (
        <Drawer.Screen 
          name="StockIn" 
          component={StockInScreen}
          options={{ title: 'Stock In' }}
        />
      )}
      {navItems.some(i => i.route === 'RecordStockIn') && (
        <Drawer.Screen 
          name="RecordStockIn" 
          component={RecordStockInScreen}
          options={{ title: 'Record Stock In' }}
        />
      )}
      {navItems.some(i => i.route === 'Reports') && (
        <Drawer.Screen 
          name="Reports" 
          component={ReportsScreen}
          options={{ title: 'Reports' }}
        />
      )}
      {navItems.some(i => i.route === 'Analytics') && (
        <Drawer.Screen 
          name="Analytics" 
          component={AnalyticsScreen}
          options={{ title: 'Analytics' }}
        />
      )}
      {navItems.some(i => i.route === 'ActivityLogs') && (
        <Drawer.Screen 
          name="ActivityLogs" 
          component={ActivityLogsScreen}
          options={{ title: 'Activity Logs' }}
        />
      )}
      {navItems.some(i => i.route === 'RegionManagement') && (
        <Drawer.Screen 
          name="RegionManagement" 
          component={RegionManagementScreen}
          options={{ title: 'Region Management' }}
        />
      )}
      {navItems.some(i => i.route === 'DistrictManagement') && (
        <Drawer.Screen 
          name="DistrictManagement" 
          component={DistrictManagementScreen}
          options={{ title: 'District Management' }}
        />
      )}
      {navItems.some(i => i.route === 'MoveoutList') && (
        <Drawer.Screen 
          name="MoveoutList" 
          component={MoveoutListScreen}
          options={{ title: 'Moveout Lists' }}
        />
      )}
      <Drawer.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Drawer.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Drawer.Screen 
        name="Inbox" 
        component={InboxScreen}
        options={{ title: 'Messages', drawerItemStyle: { display: 'none' } }}
      />
      <Drawer.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat', drawerItemStyle: { display: 'none' } }}
      />
    </Drawer.Navigator>
    </>
  );
};

const MainNavigator = () => {
  const { colors } = useTheme();
  
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: '#FFFFFF',
      }}
    >
      <MainStack.Screen 
        name="DrawerNav" 
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />
    </MainStack.Navigator>
  );
};

const AppNavigator = () => {
  const { isLoading, isAuthenticated, checkAuth, profile } = useAuthStore();
  const { colors } = useTheme();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Check if user has pending access (staff with no branch)
  const hasPendingAccess = isAuthenticated && 
    profile?.role === 'staff' && 
    !profile?.branchId;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : hasPendingAccess ? (
          <RootStack.Screen name="Auth">
            {() => <PendingAccessScreen />}
          </RootStack.Screen>
        ) : (
          <RootStack.Screen name="Main" component={MainNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const notificationModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppNavigator;
