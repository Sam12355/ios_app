import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

const PendingAccessScreen = () => {
  const { colors } = useTheme();
  const { signOut, refreshProfile, profile } = useAuthStore();
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      await refreshProfile();
    } catch (error) {
      console.log('Error checking status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Auto-check every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshProfile();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: Colors.warning + '20' }]}>
          <Icon name="hourglass-empty" size={60} color={Colors.warning} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>Pending Approval</Text>

        {/* Message */}
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Your account is pending approval from a manager. You'll be able to access the system
          once your account has been activated.
        </Text>

        {/* User Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surfaceVariant }]}>
          <View style={styles.infoRow}>
            <Icon name="person" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {profile?.name || 'User'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="email" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {profile?.email || 'Email'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="badge" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Role: Staff (Pending)
            </Text>
          </View>
        </View>

        {/* Check Status Button */}
        <TouchableOpacity
          style={[styles.checkButton, { backgroundColor: Colors.primary }]}
          onPress={handleCheckStatus}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Icon name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.checkButtonText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutButton, { borderColor: Colors.primary }]}
          onPress={handleSignOut}
        >
          <Icon name="logout" size={20} color={Colors.primary} />
          <Text style={[styles.signOutButtonText, { color: Colors.primary }]}>
            Sign Out
          </Text>
        </TouchableOpacity>

        {/* Info Note */}
        <View style={styles.noteContainer}>
          <Icon name="info-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            Status is automatically checked every 30 seconds
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  infoCard: {
    width: '100%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoText: {
    marginLeft: Spacing.md,
    fontSize: FontSizes.md,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.xl,
  },
  signOutButtonText: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteText: {
    marginLeft: Spacing.xs,
    fontSize: FontSizes.sm,
  },
});

export default PendingAccessScreen;
