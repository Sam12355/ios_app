import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { UserRole } from '../models';
import { useAuthStore } from '../stores/authStore';
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
  const navigation = useNavigation<any>();
  const userRole = (profile?.role || 'staff') as UserRole;
  const navItems = getNavigationItemsForRole(userRole);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

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
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawer {...props} />}
        screenOptions={({ navigation: navProp }) => ({
          header: () => (
            <TopAppBar
              onMenuPress={() => navProp.openDrawer()}
              onSearchPress={() => setShowSearchModal(true)}
              onNotificationsPress={() => setShowNotificationsDropdown(true)}
              onInboxPress={() => navigation.navigate('Inbox')}
              notificationCount={notificationCount}
              unreadMessagesCount={0}
            />
          ),
          drawerActiveBackgroundColor: Colors.primary + '20',
          drawerActiveTintColor: Colors.primary,
          drawerInactiveTintColor: colors.text,
          drawerStyle: {
            backgroundColor: colors.background,
          },
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

export default AppNavigator;
