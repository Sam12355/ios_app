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
import { BlurView } from '@react-native-community/blur';
import Icon from 'react-native-vector-icons/MaterialIcons';
import WarehouseIcon from '../../assets/images/warehouse.png';
import { useEffect, useState } from 'react';

import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../theme/ThemeContext';

// Static colors for StyleSheet (dynamic colors applied inline)
const staticColors = {
  primary: '#E6002A',
  backgroundDark: '#131218',
  backgroundLight: '#F5F5F5',
  cardDark: '#1E1E24',
  cardLight: '#FFFFFF',
  textPrimaryDark: '#FFFFFF',
  textPrimaryLight: '#1A1A1A',
  textSecondaryDark: '#B3B3B3',
  textSecondaryLight: '#4A4A4A',
  dividerDark: '#2F2F36',
  dividerLight: '#E0E0E0',
  activePillDark: '#2F3B4F',
  activePillLight: '#E6002A15',
};

type MenuItem = {
  label: string;
  icon: string;
  screen: string;
  roles: string[];
};

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: 'home', screen: 'Dashboard', roles: ['all'] },
  { label: 'Manage Staff', icon: 'groups', screen: 'Staff', roles: ['all'] },
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
  const { isDark, designColors } = useTheme();

  const [profilePhotoError, setProfilePhotoError] = useState(false);
  useEffect(() => {
    setProfilePhotoError(false);
  }, [profile?.photoUrl]);

  const userRole = profile?.role || 'staff';

  const visibleItems = userRole === 'staff'
    ? menuItems.filter((item) => ['Dashboard', 'StockOut', 'StockIn'].includes(item.screen))
    : menuItems;
  const currentRoute = props.state?.routes[props.state.index]?.name || 'Dashboard';
  const navigate = (screen: string) => props.navigation.navigate(screen as never);

  // Render the drawer content
  // Swedish time state
  const [swedishTime, setSwedishTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      // Convert to Swedish time (Europe/Stockholm)
      const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Stockholm' };
      setSwedishTime(now.toLocaleTimeString('en-GB', options));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => (
    <DrawerContentScrollView
      {...props}
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with app title */}
      <View style={styles.header}>
        <View style={styles.headerIconBlock}>
          <Image
            source={WarehouseIcon}
            style={{ width: 38, height: 38, resizeMode: 'contain' }}
          />
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={[styles.inventoryTitle, { color: designColors.textPrimary }]}>INVENTORY</Text>
          <Text style={[styles.managementSubtitle, { color: designColors.textPrimary }]}>Management System</Text>
        </View>
      </View>

        {/* User block - glass effect card */}
        <View style={[styles.userBlock, { 
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }]}>
          {profile?.photoUrl && !profilePhotoError ? (
            <Image
              source={{ uri: profile.photoUrl }}
              style={styles.avatar}
              onError={() => setProfilePhotoError(true)}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)' }]}> 
              <Icon name="person" size={28} color={designColors.textSecondary} />
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: designColors.textPrimary }]}>{profile?.name || 'User'}</Text>
            <Text style={[styles.userRole, { color: designColors.textSecondary, textTransform: 'capitalize' }]}>
              {profile?.role ? profile.role.replace(/_/g, ' ') : 'Staff'}
            </Text>
            {!!profile?.branchName && (
              <Text style={[styles.userBranch, { color: designColors.textMuted }]}>{profile.branchName}</Text>
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
                style={[
                  styles.menuItem, 
                  isActive && [
                    styles.menuItemActive,
                    {
                      backgroundColor: isDark ? 'rgba(230, 0, 42, 0.15)' : 'rgba(230, 0, 42, 0.1)',
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderLeftWidth: 0,
                      borderRightWidth: 0,
                      borderColor: isDark ? 'rgba(230, 0, 42, 0.3)' : 'rgba(230, 0, 42, 0.2)',
                    },
                  ]
                ]}
                onPress={() => navigate(item.screen)}
              >
                <Icon
                  name={item.icon}
                  size={22}
                  color={isActive ? staticColors.primary : designColors.textPrimary}
                />
                <Text style={[styles.menuItemText, { color: isActive ? staticColors.primary : designColors.textPrimary }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: designColors.divider }]} />

        {/* Logout */}
        <TouchableOpacity style={styles.menuItem} onPress={signOut}>
          <Icon name="logout" size={22} color={designColors.textPrimary} />
          <Text style={[styles.menuItemText, { color: designColors.textPrimary }]}>Logout</Text>
        </TouchableOpacity>
      </DrawerContentScrollView>
  );

  // Glass blur effect - like CSS filter: blur()
  return (
    <View style={styles.container}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType={isDark ? 'dark' : 'xlight'}
        blurAmount={5}
        reducedTransparencyFallbackColor={
          isDark ? 'rgba(19, 18, 24, 0.05)' : 'rgba(245, 245, 245, 0.05)'
        }
      />
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    marginTop: 64,
    paddingLeft: 18,
  },
  headerIconBlock: {
    marginRight: 14,
    marginLeft: 0,
    marginBottom: 2,
  },
  headerTextBlock: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  appNameSmall: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  appNameBig: {
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
         inventoryTitle: {
           fontSize: 24,
           fontWeight: 'bold',
           letterSpacing: 0.5,
           marginBottom: 0,
           textTransform: 'uppercase',
         },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
  },
  userRole: {
    fontSize: 14,
    marginTop: 2,
  },
  userBranch: {
    fontSize: 13,
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
    // Background color applied inline
    borderRadius: 0,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
});

export default CustomDrawer;
