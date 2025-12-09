import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

import apiClient from '../../api/ApiClient';
import { useAuthStore } from '../../stores/authStore';

// Design colors matching Kotlin app
const designColors = {
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardDark: '#252525',
  primaryRed: '#E6002A',
  successGreen: '#10B981',
  warningOrange: '#F59E0B',
  dangerRed: '#EF4444',
  blueAccent: '#3B82F6',
  purpleAccent: '#8B5CF6',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  divider: 'rgba(255, 255, 255, 0.12)',
};

const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({ type, text1, text2, position: 'bottom', visibilityTime: 3000 });
};

interface AlertSchedule {
  frequencies: string[];
  dailyTime?: string;
  weeklyDay?: number;
  weeklyTime?: string;
  monthlyDate?: number;
  monthlyTime?: string;
}

// Schedule Details Component
const ScheduleDetails = ({
  frequencies,
  dailyTime,
  weeklyDay,
  weeklyTime,
  monthlyDate,
  monthlyTime,
}: {
  frequencies?: string[];
  dailyTime?: string;
  weeklyDay?: number;
  weeklyTime?: string;
  monthlyDate?: number;
  monthlyTime?: string;
}) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };

  if (!frequencies || frequencies.length === 0) {
    return <Text style={styles.scheduleDetailText}>Not configured</Text>;
  }

  return (
    <View>
      {frequencies.includes('daily') && (
        <Text style={styles.scheduleDetailText}>Daily: {dailyTime || 'Not set'}</Text>
      )}
      {frequencies.includes('weekly') && (
        <Text style={styles.scheduleDetailText}>
          Weekly: {dayNames[weeklyDay || 0]} at {weeklyTime || 'Not set'}
        </Text>
      )}
      {frequencies.includes('monthly') && (
        <Text style={styles.scheduleDetailText}>
          Monthly: {monthlyDate || 0}{getOrdinalSuffix(monthlyDate || 0)} at {monthlyTime || 'Not set'}
        </Text>
      )}
    </View>
  );
};

// Alert Scheduling Dialog
const AlertSchedulingDialog = ({
  visible,
  onDismiss,
  onSave,
  title,
  description,
  initialSchedule,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSave: (schedule: AlertSchedule) => void;
  title: string;
  description: string;
  initialSchedule?: AlertSchedule;
}) => {
  const [frequencies, setFrequencies] = useState<string[]>(initialSchedule?.frequencies || []);
  const [dailyTime, setDailyTime] = useState(initialSchedule?.dailyTime || '09:00');
  const [weeklyDay, setWeeklyDay] = useState(initialSchedule?.weeklyDay || 1);
  const [weeklyTime, setWeeklyTime] = useState(initialSchedule?.weeklyTime || '09:00');
  const [monthlyDate, setMonthlyDate] = useState(initialSchedule?.monthlyDate || 1);
  const [monthlyTime, setMonthlyTime] = useState(initialSchedule?.monthlyTime || '09:00');

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const toggleFrequency = (freq: string) => {
    if (frequencies.includes(freq)) {
      setFrequencies(frequencies.filter(f => f !== freq));
    } else {
      setFrequencies([...frequencies, freq]);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.dialogContainer}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogDescription}>{description}</Text>

          <ScrollView style={{ maxHeight: 400 }}>
            {/* Frequency Selection */}
            <Text style={styles.dialogSectionTitle}>Frequency</Text>
            {['daily', 'weekly', 'monthly'].map(freq => (
              <TouchableOpacity
                key={freq}
                style={styles.frequencyOption}
                onPress={() => toggleFrequency(freq)}
              >
                <Icon
                  name={frequencies.includes(freq) ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={frequencies.includes(freq) ? designColors.primaryRed : designColors.textSecondary}
                />
                <Text style={styles.frequencyLabel}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</Text>
              </TouchableOpacity>
            ))}

            {/* Daily Settings */}
            {frequencies.includes('daily') && (
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Daily Time</Text>
                <TextInput
                  style={styles.timeInput}
                  value={dailyTime}
                  onChangeText={setDailyTime}
                  placeholder="HH:MM"
                  placeholderTextColor={designColors.textSecondary}
                />
              </View>
            )}

            {/* Weekly Settings */}
            {frequencies.includes('weekly') && (
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Weekly Day & Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {dayNames.map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayButton,
                        weeklyDay === index && { backgroundColor: designColors.primaryRed },
                      ]}
                      onPress={() => setWeeklyDay(index)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          weeklyDay === index && { color: '#FFFFFF' },
                        ]}
                      >
                        {day.substring(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.timeInput, { marginTop: 8 }]}
                  value={weeklyTime}
                  onChangeText={setWeeklyTime}
                  placeholder="HH:MM"
                  placeholderTextColor={designColors.textSecondary}
                />
              </View>
            )}

            {/* Monthly Settings */}
            {frequencies.includes('monthly') && (
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>Monthly Date & Time</Text>
                <View style={styles.monthlyRow}>
                  <Text style={styles.settingLabel}>Day of month:</Text>
                  <TextInput
                    style={[styles.timeInput, { width: 60 }]}
                    value={monthlyDate.toString()}
                    onChangeText={(text) => setMonthlyDate(parseInt(text) || 1)}
                    keyboardType="number-pad"
                    placeholderTextColor={designColors.textSecondary}
                  />
                </View>
                <TextInput
                  style={[styles.timeInput, { marginTop: 8 }]}
                  value={monthlyTime}
                  onChangeText={setMonthlyTime}
                  placeholder="HH:MM"
                  placeholderTextColor={designColors.textSecondary}
                />
              </View>
            )}
          </ScrollView>

          {/* Buttons */}
          <View style={styles.dialogButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onDismiss}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                onSave({
                  frequencies,
                  dailyTime,
                  weeklyDay,
                  weeklyTime,
                  monthlyDate,
                  monthlyTime,
                });
              }}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const SettingsScreen: React.FC = () => {
  const { profile, signOut, updateProfile } = useAuthStore();
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Profile fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [stockAlerts, setStockAlerts] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);
  const [softdrinkTrends, setSoftdrinkTrends] = useState(false);
  
  // Dialog states
  const [showStockAlertDialog, setShowStockAlertDialog] = useState(false);
  const [showEventReminderDialog, setShowEventReminderDialog] = useState(false);
  const [showSoftdrinkDialog, setShowSoftdrinkDialog] = useState(false);
  
  // Permissions (for managers)
  const [assistantManagerStockInAccess, setAssistantManagerStockInAccess] = useState(false);

  // Load profile data
  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const user = await apiClient.getProfile();
      setCurrentUser(user);
      setName(user.name || '');
      setPhone(user.phone || '');
      setPosition(user.position || '');
      
      // Load notification preferences from notificationSettings object
      const settings = user.notificationSettings || {};
      
      // Check both the settings object AND if frequencies are configured
      // stockLevelAlerts is what the web app saves, but also check if frequencies exist
      const hasStockAlertFrequencies = user.stockAlertFrequencies && user.stockAlertFrequencies.length > 0;
      const hasEventReminderFrequencies = user.eventReminderFrequencies && user.eventReminderFrequencies.length > 0;
      const hasSoftdrinkFrequencies = user.softdrinkTrendsFrequencies && user.softdrinkTrendsFrequencies.length > 0;
      
      setEmailNotifications(settings.email ?? true);
      setSmsNotifications(settings.sms ?? false);
      setWhatsappNotifications(settings.whatsapp ?? false);
      // Use stockLevelAlerts from settings OR check if frequencies are set
      setStockAlerts(settings.stockLevelAlerts ?? hasStockAlertFrequencies ?? false);
      setEventReminders(settings.eventReminders ?? hasEventReminderFrequencies ?? false);
      setSoftdrinkTrends(settings.softdrinkTrends ?? hasSoftdrinkFrequencies ?? false);
      setAssistantManagerStockInAccess(settings.assistant_manager_stock_in_access ?? false);
    } catch (error) {
      console.error('Load profile error:', error);
      showToast('error', 'Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile(true);
  }, [loadProfile]);

  // Save profile changes
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updates: any = {};
      if (name !== currentUser?.name) updates.name = name;
      if (phone !== currentUser?.phone) updates.phone = phone;
      if (position !== currentUser?.position) updates.position = position;
      
      await apiClient.updateProfile(updates);
      showToast('success', 'Success', 'Profile updated successfully');
      loadProfile(true);
    } catch (error: any) {
      console.error('Save profile error:', error);
      showToast('error', 'Error', error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Save notification preferences - accepts optional overrides for values being changed
  const saveNotificationPreferences = async (overrides?: {
    stockLevelAlerts?: boolean;
    eventReminders?: boolean;
    softdrinkTrends?: boolean;
  }) => {
    try {
      const settings = {
        email: emailNotifications,
        sms: smsNotifications,
        whatsapp: whatsappNotifications,
        stockLevelAlerts: overrides?.stockLevelAlerts ?? stockAlerts,
        eventReminders: overrides?.eventReminders ?? eventReminders,
        softdrinkTrends: overrides?.softdrinkTrends ?? softdrinkTrends,
      };
      
      await apiClient.updateNotificationSettings(settings);
      
      // Reload profile to ensure state is synced
      const updatedProfile = await apiClient.getProfile();
      setCurrentUser(updatedProfile);
      
      showToast('success', 'Success', 'Notification preferences saved');
    } catch (error: any) {
      console.error('Save notifications error:', error);
      showToast('error', 'Error', error.message || 'Failed to save preferences');
    }
  };

  // Handle schedule save
  const handleScheduleSave = async (type: string, schedule: AlertSchedule) => {
    try {
      const profileUpdates: any = {};
      
      // Determine which toggle is being enabled
      const notificationOverrides: {
        stockLevelAlerts?: boolean;
        eventReminders?: boolean;
        softdrinkTrends?: boolean;
      } = {};
      
      if (type === 'stock') {
        setStockAlerts(true);
        notificationOverrides.stockLevelAlerts = true;
        profileUpdates.stock_alert_frequencies = schedule.frequencies;
        if (schedule.frequencies.includes('daily')) {
          profileUpdates.daily_schedule_time = schedule.dailyTime;
        }
        if (schedule.frequencies.includes('weekly')) {
          profileUpdates.weekly_schedule_day = schedule.weeklyDay;
          profileUpdates.weekly_schedule_time = schedule.weeklyTime;
        }
        if (schedule.frequencies.includes('monthly')) {
          profileUpdates.monthly_schedule_date = schedule.monthlyDate;
          profileUpdates.monthly_schedule_time = schedule.monthlyTime;
        }
      } else if (type === 'event') {
        setEventReminders(true);
        notificationOverrides.eventReminders = true;
        profileUpdates.event_reminder_frequencies = schedule.frequencies;
        if (schedule.frequencies.includes('daily')) {
          profileUpdates.event_daily_schedule_time = schedule.dailyTime;
        }
        if (schedule.frequencies.includes('weekly')) {
          profileUpdates.event_weekly_schedule_day = schedule.weeklyDay;
          profileUpdates.event_weekly_schedule_time = schedule.weeklyTime;
        }
        if (schedule.frequencies.includes('monthly')) {
          profileUpdates.event_monthly_schedule_date = schedule.monthlyDate;
          profileUpdates.event_monthly_schedule_time = schedule.monthlyTime;
        }
      } else if (type === 'softdrink') {
        setSoftdrinkTrends(true);
        notificationOverrides.softdrinkTrends = true;
        profileUpdates.softdrink_trends_frequencies = schedule.frequencies;
        if (schedule.frequencies.includes('daily')) {
          profileUpdates.softdrink_trends_daily_schedule_time = schedule.dailyTime;
        }
        if (schedule.frequencies.includes('weekly')) {
          profileUpdates.softdrink_trends_weekly_schedule_day = schedule.weeklyDay;
          profileUpdates.softdrink_trends_weekly_schedule_time = schedule.weeklyTime;
        }
        if (schedule.frequencies.includes('monthly')) {
          profileUpdates.softdrink_trends_monthly_schedule_date = schedule.monthlyDate;
          profileUpdates.softdrink_trends_monthly_schedule_time = schedule.monthlyTime;
        }
      }

      // Pass overrides to saveNotificationPreferences since state hasn't updated yet
      await saveNotificationPreferences(notificationOverrides);
      const updatedProfile = await apiClient.updateProfile(profileUpdates);
      // Immediately update local state with the new schedule data
      setCurrentUser((prev: any) => ({
        ...prev,
        ...profileUpdates,
        // Also set camelCase versions for display
        stockAlertFrequencies: profileUpdates.stock_alert_frequencies || prev?.stockAlertFrequencies,
        dailyScheduleTime: profileUpdates.daily_schedule_time || prev?.dailyScheduleTime,
        weeklyScheduleDay: profileUpdates.weekly_schedule_day ?? prev?.weeklyScheduleDay,
        weeklyScheduleTime: profileUpdates.weekly_schedule_time || prev?.weeklyScheduleTime,
        monthlyScheduleDate: profileUpdates.monthly_schedule_date ?? prev?.monthlyScheduleDate,
        monthlyScheduleTime: profileUpdates.monthly_schedule_time || prev?.monthlyScheduleTime,
        eventReminderFrequencies: profileUpdates.event_reminder_frequencies || prev?.eventReminderFrequencies,
        eventDailyScheduleTime: profileUpdates.event_daily_schedule_time || prev?.eventDailyScheduleTime,
        eventWeeklyScheduleDay: profileUpdates.event_weekly_schedule_day ?? prev?.eventWeeklyScheduleDay,
        eventWeeklyScheduleTime: profileUpdates.event_weekly_schedule_time || prev?.eventWeeklyScheduleTime,
        eventMonthlyScheduleDate: profileUpdates.event_monthly_schedule_date ?? prev?.eventMonthlyScheduleDate,
        eventMonthlyScheduleTime: profileUpdates.event_monthly_schedule_time || prev?.eventMonthlyScheduleTime,
        softdrinkTrendsFrequencies: profileUpdates.softdrink_trends_frequencies || prev?.softdrinkTrendsFrequencies,
        softdrinkTrendsDailyScheduleTime: profileUpdates.softdrink_trends_daily_schedule_time || prev?.softdrinkTrendsDailyScheduleTime,
        softdrinkTrendsWeeklyScheduleDay: profileUpdates.softdrink_trends_weekly_schedule_day ?? prev?.softdrinkTrendsWeeklyScheduleDay,
        softdrinkTrendsWeeklyScheduleTime: profileUpdates.softdrink_trends_weekly_schedule_time || prev?.softdrinkTrendsWeeklyScheduleTime,
        softdrinkTrendsMonthlyScheduleDate: profileUpdates.softdrink_trends_monthly_schedule_date ?? prev?.softdrinkTrendsMonthlyScheduleDate,
        softdrinkTrendsMonthlyScheduleTime: profileUpdates.softdrink_trends_monthly_schedule_time || prev?.softdrinkTrendsMonthlyScheduleTime,
      }));
      showToast('success', 'Success', 'Schedule saved successfully');
      // Also refresh from server to ensure consistency
      loadProfile(true);
    } catch (error: any) {
      console.error('Save schedule error:', error);
      showToast('error', 'Error', error.message || 'Failed to save schedule');
    }
  };

  // Handle photo change
  const handleChangePhoto = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 500,
        maxHeight: 500,
      });
      
      if (result.assets && result.assets[0]?.uri) {
        setIsSaving(true);
        try {
          await apiClient.updateProfilePhoto(result.assets[0].uri);
          showToast('success', 'Success', 'Profile picture updated');
          loadProfile(true);
        } catch (error: any) {
          showToast('error', 'Error', error.message || 'Failed to update photo');
        } finally {
          setIsSaving(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  // Handle permissions save (for managers)
  const handleSavePermissions = async () => {
    try {
      const settings = {
        ...currentUser?.notificationSettings,
        assistant_manager_stock_in_access: assistantManagerStockInAccess,
      };
      await apiClient.updateNotificationSettings(settings);
      showToast('success', 'Success', 'Permission updated successfully');
      loadProfile(true);
    } catch (error: any) {
      console.error('Save permissions error:', error);
      showToast('error', 'Error', error.message || 'Failed to update permission');
    }
  };

  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  // Get initials
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(part => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const isManager = currentUser?.role?.toLowerCase() === 'manager';
  const isManagerOrAssistant = isManager || currentUser?.role?.toLowerCase() === 'assistant_manager';
  const isStaff = currentUser?.role?.toLowerCase() === 'staff';

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={designColors.primaryRed} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={designColors.primaryRed}
        />
      }
    >
      {/* Page Title */}
      <Text style={styles.pageTitle}>Settings</Text>

      {/* Profile Settings Section */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Icon name="person" size={20} color={designColors.textPrimary} />
          <Text style={styles.sectionTitle}>Profile Settings</Text>
        </View>

        {/* Profile Picture */}
        <TouchableOpacity style={styles.profilePictureContainer} onPress={handleChangePhoto}>
          {currentUser?.photoUrl ? (
            <Image source={{ uri: currentUser.photoUrl }} style={styles.profilePicture} />
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Text style={styles.profileInitials}>{getInitials(currentUser?.name || 'U')}</Text>
            </View>
          )}
          <View style={styles.editOverlay}>
            <Icon name="edit" size={24} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Profile Fields */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            maxLength={100}
            placeholderTextColor={designColors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={[styles.textInput, styles.disabledInput]}
            value={currentUser?.email || ''}
            editable={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.textInput}
            value={phone}
            onChangeText={setPhone}
            maxLength={30}
            keyboardType="phone-pad"
            placeholderTextColor={designColors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Position</Text>
          <TextInput
            style={styles.textInput}
            value={position}
            onChangeText={setPosition}
            maxLength={100}
            placeholderTextColor={designColors.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Role</Text>
          <TextInput
            style={[styles.textInput, styles.disabledInput]}
            value={currentUser?.role || ''}
            editable={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSaving && { opacity: 0.7 }]}
          onPress={handleSaveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Notification Preferences (hide for staff) */}
      {!isStaff && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="notifications" size={20} color={designColors.textPrimary} />
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
          </View>

          <Text style={styles.subsectionTitle}>Alert Types</Text>

          {/* Stock Level Alerts */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Stock Level Alerts</Text>
              <Text style={styles.switchDescription}>Get notified about low stock levels</Text>
            </View>
            <Switch
              value={stockAlerts}
              onValueChange={(value) => {
                if (value) {
                  setShowStockAlertDialog(true);
                } else {
                  setStockAlerts(false);
                  saveNotificationPreferences({ stockLevelAlerts: false });
                }
              }}
              trackColor={{ false: designColors.cardDark, true: designColors.primaryRed + '50' }}
              thumbColor={stockAlerts ? designColors.primaryRed : designColors.textSecondary}
            />
          </View>

          {/* Event Reminders */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Event Reminders</Text>
              <Text style={styles.switchDescription}>Receive reminders for upcoming events</Text>
            </View>
            <Switch
              value={eventReminders}
              onValueChange={(value) => {
                if (value) {
                  setShowEventReminderDialog(true);
                } else {
                  setEventReminders(false);
                  saveNotificationPreferences({ eventReminders: false });
                }
              }}
              trackColor={{ false: designColors.cardDark, true: designColors.primaryRed + '50' }}
              thumbColor={eventReminders ? designColors.primaryRed : designColors.textSecondary}
            />
          </View>

          {/* Softdrink Trends */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Softdrink Trends</Text>
              <Text style={styles.switchDescription}>Get updates on softdrink consumption trends</Text>
            </View>
            <Switch
              value={softdrinkTrends}
              onValueChange={(value) => {
                if (value) {
                  setShowSoftdrinkDialog(true);
                } else {
                  setSoftdrinkTrends(false);
                  saveNotificationPreferences({ softdrinkTrends: false });
                }
              }}
              trackColor={{ false: designColors.cardDark, true: designColors.primaryRed + '50' }}
              thumbColor={softdrinkTrends ? designColors.primaryRed : designColors.textSecondary}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.subsectionTitle}>Notification Channels</Text>

          {/* Email Notifications */}
          <View style={styles.switchRow}>
            <View style={styles.channelRow}>
              <Icon name="email" size={20} color={designColors.textPrimary} />
              <Text style={styles.switchLabel}>Email Notifications</Text>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={(value) => {
                setEmailNotifications(value);
                saveNotificationPreferences({ email: value });
              }}
              trackColor={{ false: designColors.cardDark, true: designColors.primaryRed + '50' }}
              thumbColor={emailNotifications ? designColors.primaryRed : designColors.textSecondary}
            />
          </View>

          {/* SMS Notifications */}
          <View style={styles.switchRow}>
            <View style={styles.channelRow}>
              <Icon name="sms" size={20} color={designColors.textPrimary} />
              <Text style={styles.switchLabel}>SMS Notifications</Text>
            </View>
            <Switch
              value={smsNotifications}
              onValueChange={(value) => {
                setSmsNotifications(value);
                saveNotificationPreferences({ sms: value });
              }}
              trackColor={{ false: designColors.cardDark, true: designColors.primaryRed + '50' }}
              thumbColor={smsNotifications ? designColors.primaryRed : designColors.textSecondary}
            />
          </View>

          {/* WhatsApp Notifications */}
          <View style={styles.switchRow}>
            <View style={styles.channelRow}>
              <Icon name="chat" size={20} color={designColors.textPrimary} />
              <Text style={styles.switchLabel}>WhatsApp Notifications</Text>
            </View>
            <Switch
              value={whatsappNotifications}
              onValueChange={(value) => {
                if (!phone) {
                  showToast('info', 'Info', 'Please add a phone number first');
                  return;
                }
                setWhatsappNotifications(value);
                saveNotificationPreferences({ whatsapp: value });
              }}
              trackColor={{ false: designColors.cardDark, true: designColors.primaryRed + '50' }}
              thumbColor={whatsappNotifications ? designColors.primaryRed : designColors.textSecondary}
            />
          </View>

          <View style={styles.divider} />

          {/* Current Alert Schedule Section */}
          <Text style={styles.subsectionTitle}>Current Alert Schedule</Text>

          {stockAlerts && (
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Stock Level Alerts</Text>
              <ScheduleDetails
                frequencies={currentUser?.stockAlertFrequencies}
                dailyTime={currentUser?.dailyScheduleTime}
                weeklyDay={currentUser?.weeklyScheduleDay}
                weeklyTime={currentUser?.weeklyScheduleTime}
                monthlyDate={currentUser?.monthlyScheduleDate}
                monthlyTime={currentUser?.monthlyScheduleTime}
              />
            </View>
          )}

          {eventReminders && (
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Event Reminders</Text>
              <ScheduleDetails
                frequencies={currentUser?.eventReminderFrequencies}
                dailyTime={currentUser?.eventDailyScheduleTime}
                weeklyDay={currentUser?.eventWeeklyScheduleDay}
                weeklyTime={currentUser?.eventWeeklyScheduleTime}
                monthlyDate={currentUser?.eventMonthlyScheduleDate}
                monthlyTime={currentUser?.eventMonthlyScheduleTime}
              />
            </View>
          )}

          {softdrinkTrends && (
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Softdrink Trends</Text>
              <ScheduleDetails
                frequencies={currentUser?.softdrinkTrendsFrequencies}
                dailyTime={currentUser?.softdrinkTrendsDailyScheduleTime}
                weeklyDay={currentUser?.softdrinkTrendsWeeklyScheduleDay}
                weeklyTime={currentUser?.softdrinkTrendsWeeklyScheduleTime}
                monthlyDate={currentUser?.softdrinkTrendsMonthlyScheduleDate}
                monthlyTime={currentUser?.softdrinkTrendsMonthlyScheduleTime}
              />
            </View>
          )}
        </View>
      )}

      {/* Permissions Management (managers only) */}
      {isManager && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="security" size={20} color={designColors.textPrimary} />
            <Text style={styles.sectionTitle}>Permissions Management</Text>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelContainer}>
              <Text style={styles.switchLabel}>Assistant Manager Stock In Access</Text>
              <Text style={styles.switchDescription}>Allow Assistant Managers to access{'\n'}the Stock In page</Text>
            </View>
            <Switch
              value={assistantManagerStockInAccess}
              onValueChange={setAssistantManagerStockInAccess}
              trackColor={{ false: designColors.cardDark, true: designColors.primaryRed + '50' }}
              thumbColor={assistantManagerStockInAccess ? designColors.primaryRed : designColors.textSecondary}
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSavePermissions}>
            <Text style={styles.primaryButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Branch Settings (for managers and assistant managers) */}
      {isManagerOrAssistant && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Icon name="store" size={20} color={designColors.textPrimary} />
            <Text style={styles.sectionTitle}>Branch Settings</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Branch Name</Text>
            <TextInput
              style={[styles.textInput, styles.disabledInput]}
              value={currentUser?.branchName || 'N/A'}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Branch Location</Text>
            <TextInput
              style={[styles.textInput, styles.disabledInput]}
              value={
                currentUser?.branchLocation ||
                [currentUser?.branchName, currentUser?.districtName, currentUser?.regionName]
                  .filter(Boolean)
                  .join(', ') ||
                'Not specified'
              }
              editable={false}
            />
          </View>
        </View>
      )}

      {/* System Information */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Icon name="info" size={20} color={designColors.textPrimary} />
          <Text style={styles.sectionTitle}>System Information</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Account Created</Text>
          <TextInput
            style={[styles.textInput, styles.disabledInput]}
            value={formatTimestamp(currentUser?.createdAt || '')}
            editable={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Last Updated</Text>
          <TextInput
            style={[styles.textInput, styles.disabledInput]}
            value={formatTimestamp(currentUser?.updatedAt || '')}
            editable={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Login Count</Text>
          <TextInput
            style={[styles.textInput, styles.disabledInput]}
            value={`${currentUser?.accessCount || 0}`}
            editable={false}
          />
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={20} color={designColors.dangerRed} />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      {/* Alert Scheduling Dialogs */}
      <AlertSchedulingDialog
        visible={showStockAlertDialog}
        onDismiss={() => setShowStockAlertDialog(false)}
        onSave={(schedule) => {
          setShowStockAlertDialog(false);
          handleScheduleSave('stock', schedule);
        }}
        title="Stock Alert Schedule"
        description="Choose how often you want to receive stock level alerts."
        initialSchedule={{
          frequencies: currentUser?.stockAlertFrequencies || [],
          dailyTime: currentUser?.dailyScheduleTime,
          weeklyDay: currentUser?.weeklyScheduleDay,
          weeklyTime: currentUser?.weeklyScheduleTime,
          monthlyDate: currentUser?.monthlyScheduleDate,
          monthlyTime: currentUser?.monthlyScheduleTime,
        }}
      />

      <AlertSchedulingDialog
        visible={showEventReminderDialog}
        onDismiss={() => setShowEventReminderDialog(false)}
        onSave={(schedule) => {
          setShowEventReminderDialog(false);
          handleScheduleSave('event', schedule);
        }}
        title="Event Reminder Schedule"
        description="Choose how often you want to receive event reminders."
        initialSchedule={{
          frequencies: currentUser?.eventReminderFrequencies || [],
          dailyTime: currentUser?.eventDailyScheduleTime,
          weeklyDay: currentUser?.eventWeeklyScheduleDay,
          weeklyTime: currentUser?.eventWeeklyScheduleTime,
          monthlyDate: currentUser?.eventMonthlyScheduleDate,
          monthlyTime: currentUser?.eventMonthlyScheduleTime,
        }}
      />

      <AlertSchedulingDialog
        visible={showSoftdrinkDialog}
        onDismiss={() => setShowSoftdrinkDialog(false)}
        onSave={(schedule) => {
          setShowSoftdrinkDialog(false);
          handleScheduleSave('softdrink', schedule);
        }}
        title="Softdrink Trends Schedule"
        description="Choose how often you want to receive softdrink trend alerts."
        initialSchedule={{
          frequencies: currentUser?.softdrinkTrendsFrequencies || [],
          dailyTime: currentUser?.softdrinkTrendsDailyScheduleTime,
          weeklyDay: currentUser?.softdrinkTrendsWeeklyScheduleDay,
          weeklyTime: currentUser?.softdrinkTrendsWeeklyScheduleTime,
          monthlyDate: currentUser?.softdrinkTrendsMonthlyScheduleDate,
          monthlyTime: currentUser?.softdrinkTrendsMonthlyScheduleTime,
        }}
      />

      <Toast />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designColors.backgroundDark,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: designColors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: designColors.surfaceDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColors.textPrimary,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  profilePictureContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: designColors.cardDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: designColors.textSecondary,
  },
  editOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: designColors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: designColors.textPrimary,
    borderWidth: 1,
    borderColor: designColors.borderLight,
  },
  disabledInput: {
    color: designColors.textSecondary,
  },
  primaryButton: {
    backgroundColor: designColors.primaryRed,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
  switchDescription: {
    fontSize: 12,
    color: designColors.textSecondary,
    marginTop: 2,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: designColors.divider,
    marginVertical: 16,
  },
  scheduleCard: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 4,
  },
  scheduleDetailText: {
    fontSize: 12,
    color: designColors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: designColors.surfaceDark,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: designColors.dangerRed + '50',
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: designColors.dangerRed,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContainer: {
    backgroundColor: designColors.surfaceDark,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 350,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogDescription: {
    fontSize: 14,
    color: designColors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  dialogSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 12,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  frequencyLabel: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
  settingSection: {
    marginTop: 16,
  },
  settingLabel: {
    fontSize: 12,
    color: designColors.textSecondary,
    marginBottom: 8,
  },
  timeInput: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: designColors.textPrimary,
    borderWidth: 1,
    borderColor: designColors.borderLight,
  },
  dayButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: designColors.cardDark,
    marginRight: 8,
  },
  dayButtonText: {
    fontSize: 12,
    color: designColors.textSecondary,
  },
  monthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: designColors.cardDark,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: designColors.primaryRed,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SettingsScreen;
