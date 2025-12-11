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

// Design System Colors (matching Kotlin app)
const colors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  surfaceLight: '#FFFFFF',
  textPrimaryDark: '#FFFFFF',
  textPrimaryLight: '#1E1E1E',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  sunOrange: '#FFA500',
  onlineGreen: '#22C55E',
  primaryContainer: '#2A2A2A',
  primaryContainerLight: '#E8E8E8',
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

  // Dynamic colors based on theme (matching Kotlin app)
  const surfaceColor = isDark ? colors.surfaceDark : colors.surfaceLight;
  const textColor = isDark ? colors.textPrimaryDark : colors.textPrimaryLight;
  const containerColor = isDark ? colors.primaryContainer : colors.primaryContainerLight;

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
    <View style={[styles.wrapper, { paddingTop: insets.top, backgroundColor: surfaceColor }]}>
      <View style={[styles.container, { backgroundColor: surfaceColor }]}>
        {/* Left side - Hamburger Menu */}
        <TouchableOpacity onPress={onMenuPress} style={styles.iconButton}>
          <Icon name="menu" size={24} color={textColor} />
        </TouchableOpacity>

        {/* Center - Spacer */}
        <View style={styles.spacer} />

        {/* Right side - Action Icons */}
        <View style={styles.actionsContainer}>
          {/* Inbox/Envelope Icon */}
          <TouchableOpacity onPress={onInboxPress} style={styles.iconButton}>
            <Icon name="mail-outline" size={24} color={textColor} />
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
                    <Image 
                      source={{ uri: member.photoUrl }} 
                      style={[styles.avatar, { borderColor: surfaceColor }]} 
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: containerColor, borderColor: surfaceColor }]}>
                      <Text style={[styles.avatarInitials, { color: textColor }]}>
                        {member.name ? getInitials(member.name) : '?'}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.onlineIndicator, { borderColor: surfaceColor }]} />
                </View>
              ))}
            </View>
          )}

          {/* Search Icon */}
          <TouchableOpacity onPress={onSearchPress} style={styles.iconButton}>
            <Icon name="search" size={24} color={textColor} />
          </TouchableOpacity>

          {/* Theme Toggle - matches Kotlin: sun in dark mode (orange), moon in light mode */}
          <TouchableOpacity onPress={toggleTheme} style={styles.iconButton}>
            <Icon
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={24}
              color={isDark ? colors.sunOrange : textColor}
            />
          </TouchableOpacity>

          {/* Notifications Bell - filled icon like Kotlin */}
          <TouchableOpacity onPress={onNotificationsPress} style={styles.iconButton}>
            <Icon name="notifications" size={24} color={textColor} />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
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
    // backgroundColor set dynamically
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set dynamically
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
    gap: 8,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    // borderColor set dynamically
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    // backgroundColor set dynamically
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    // borderColor set dynamically
  },
  avatarInitials: {
    fontSize: 10,
    fontWeight: 'bold',
    // color set dynamically
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
    // borderColor set dynamically
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default TopAppBar;
