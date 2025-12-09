import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../theme/ThemeContext';

const API_BASE_URL = 'https://stock-nexus-84-main-2-1.onrender.com/api';
const TOKEN_KEY = '@stocknexus_access_token';

// Design System Colors
const colors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  sunOrange: '#FFA500',
  onlineGreen: '#22C55E',
};

interface OnlineMember {
  id: string;
  name: string;
  photoUrl?: string;
}

interface TopAppBarProps {
  onMenuPress: () => void;
  onSearchPress?: () => void;
  onNotificationsPress?: () => void;
  onInboxPress?: () => void;
  notificationCount?: number;
  unreadMessagesCount?: number;
}

const TopAppBar: React.FC<TopAppBarProps> = ({
  onMenuPress,
  onSearchPress,
  onNotificationsPress,
  onInboxPress,
  notificationCount = 0,
  unreadMessagesCount = 0,
}) => {
  const { profile, isAuthenticated } = useAuthStore();
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);

  // Fetch online members (excluding current user)
  useEffect(() => {
    const fetchOnlineMembers = async () => {
      if (!isAuthenticated) return;
      
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/users/online`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          // Filter out current user
          const others = (data || []).filter(
            (member: OnlineMember) => member.id !== profile?.id
          );
          setOnlineMembers(others.slice(0, 4)); // Max 4 avatars
        }
      } catch (error) {
        // Silently fail - online members is not critical
        console.log('Could not fetch online members');
      }
    };

    fetchOnlineMembers();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOnlineMembers, 30000);
    return () => clearInterval(interval);
  }, [profile?.id, isAuthenticated]);

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        {/* Left side - Hamburger Menu */}
        <TouchableOpacity onPress={onMenuPress} style={styles.iconButton}>
          <Icon name="menu" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Center - Spacer */}
        <View style={styles.spacer} />

        {/* Right side - Action Icons */}
        <View style={styles.actionsContainer}>
          {/* Inbox/Envelope Icon */}
          <TouchableOpacity onPress={onInboxPress} style={styles.iconButton}>
            <Icon name="mail-outline" size={24} color={colors.textPrimary} />
            {unreadMessagesCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Stacked Online Members Avatars (other users, not current) */}
          {onlineMembers.length > 0 && (
            <View style={styles.stackedAvatars}>
              {onlineMembers.map((member, index) => (
                <View
                  key={member.id}
                  style={[
                    styles.stackedAvatarContainer,
                    { marginLeft: index === 0 ? 0 : -12 },
                  ]}
                >
                  {member.photoUrl ? (
                    <Image source={{ uri: member.photoUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>
                        {member.name ? getInitials(member.name) : '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.onlineIndicator} />
                </View>
              ))}
            </View>
          )}

          {/* Search Icon */}
          <TouchableOpacity onPress={onSearchPress} style={styles.iconButton}>
            <Icon name="search" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Theme Toggle */}
          <TouchableOpacity onPress={toggleTheme} style={styles.iconButton}>
            <Icon
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={24}
              color={isDark ? colors.sunOrange : colors.textPrimary}
            />
          </TouchableOpacity>

          {/* Notifications Bell */}
          <TouchableOpacity onPress={onNotificationsPress} style={styles.iconButton}>
            <Icon name="notifications-none" size={24} color={colors.textPrimary} />
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.primaryRed,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryRed,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  iconButton: {
    padding: 8,
    position: 'relative',
  },
  spacer: {
    flex: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  stackedAvatarContainer: {
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
    marginHorizontal: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primaryRed,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primaryRed,
  },
  avatarInitials: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.onlineGreen,
    borderWidth: 1.5,
    borderColor: colors.primaryRed,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
});

export default TopAppBar;
