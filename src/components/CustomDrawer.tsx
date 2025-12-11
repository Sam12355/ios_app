import {
    DrawerContentComponentProps,
    DrawerContentScrollView,
} from '@react-navigation/drawer';
import React from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuthStore } from '../stores/authStore';

// Palette aligned to Android screenshot
const colors = {
  primary: '#E6002A',
  background: '#131218',
  card: '#1E1E24',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  divider: '#2F2F36',
  activePill: '#2F3B4F',
};

type MenuItem = {
  label: string;
  icon: string;
  screen: string;
  roles: string[];
};

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: 'home', screen: 'Dashboard', roles: ['all'] },
  { label: 'Manage Staff', icon: 'groups', screen: 'Staff', roles: ['admin', 'manager', 'assistant_manager'] },
  { label: 'Manage Items', icon: 'inventory', screen: 'Items', roles: ['all'] },
  { label: 'Stock Out', icon: 'remove-shopping-cart', screen: 'StockOut', roles: ['all'] },
  { label: 'ICA Delivery', icon: 'local-shipping', screen: 'ICADelivery', roles: ['all'] },
  { label: 'Stock In', icon: 'add-shopping-cart', screen: 'StockIn', roles: ['all'] },
  { label: 'Reports', icon: 'assignment', screen: 'Reports', roles: ['all'] },
  { label: 'Analytics', icon: 'insights', screen: 'Analytics', roles: ['all'] },
  { label: 'Settings', icon: 'settings', screen: 'Settings', roles: ['all'] },
];

const CustomDrawer: React.FC<DrawerContentComponentProps> = (props) => {
  const { profile, signOut } = useAuthStore();
  const userRole = profile?.role || 'staff';

  const visibleItems = menuItems.filter(
    (item) => item.roles.includes('all') || item.roles.includes(userRole)
  );

  const currentRoute = props.state?.routes[props.state.index]?.name || 'Dashboard';

  const navigate = (screen: string) => props.navigation.navigate(screen as never);

  return (
    <View style={styles.container}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with app title */}
        <View style={styles.header}>
          <Icon name="storefront" size={32} color={colors.textPrimary} />
          <Text style={styles.appName}>Stock Nexus</Text>
        </View>

        {/* User block */}
        <View style={styles.userBlock}>
          {profile?.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="person" size={28} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile?.name || 'User'}</Text>
            <Text style={styles.userRole}>{profile?.role ? profile.role.replace('_', ' ') : 'Staff'}</Text>
            {!!profile?.branchName && (
              <Text style={styles.userBranch}>{profile.branchName}</Text>
            )}
          </View>
        </View>

        {/* Menu list */}
        <View style={styles.menuSection}>
          {visibleItems.map((item) => {
            const isActive = currentRoute === item.screen;
            return (
              <TouchableOpacity
                key={item.screen}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => navigate(item.screen)}
              >
                <Icon
                  name={item.icon}
                  size={22}
                  color={colors.textPrimary}
                />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        {/* Logout */}
        <TouchableOpacity style={styles.menuItem} onPress={signOut}>
          <Icon name="logout" size={22} color={colors.textPrimary} />
          <Text style={styles.menuItemText}>Logout</Text>
        </TouchableOpacity>
      </DrawerContentScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.divider,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userRole: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  userBranch: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuSection: {
    gap: 8,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  menuItemActive: {
    backgroundColor: colors.activePill,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 16,
  },
});

export default CustomDrawer;
