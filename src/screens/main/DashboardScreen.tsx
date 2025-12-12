import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import AddEventModal from '../../components/dashboard/AddEventModal';
import GenerateMoveoutModal from '../../components/dashboard/GenerateMoveoutModal';
import MoveoutItemsModal from '../../components/dashboard/MoveoutItemsModal';
import { CalendarEvent, MoveoutList, WeatherData } from '../../models';
import { useAuthStore } from '../../stores/authStore';

// Design System Colors - Matching Android app exactly
const colors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardBackground: '#1A1A1A',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  warningOrange: '#FFA726',
  errorRed: '#E53935',
  deepOrange: '#FF7043',
  infoBlue: '#2196F3',
};

const { width } = Dimensions.get('window');

// Format date helper
const formatDate = (date: Date) => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

// Stats Card Component - Matching Android exactly
const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  onPress,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  iconColor: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity 
    style={styles.statsCard} 
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.statsCardHeader}>
      <Text style={styles.statsCardTitle}>{title}</Text>
      <Icon name={icon} size={16} color={iconColor} />
    </View>
    <Text style={[styles.statsCardValue, { color: iconColor }]}>{value}</Text>
    <Text style={styles.statsCardSubtitle}>{subtitle}</Text>
  </TouchableOpacity>
);

// Weather Widget Component - Matching Android exactly
const WeatherWidget = ({ weather, isLoading }: { weather: WeatherData | null; isLoading?: boolean }) => {
  // Always show weather widget with default or actual data
  const displayWeather = weather || {
    temperature: 15,
    condition: 'Loading...',
    location: 'Stockholm',
    humidity: 70,
    windSpeed: 10,
  };

  return (
    <View style={styles.weatherCard}>
      <View style={styles.weatherHeader}>
        <Icon name="cloud" size={20} color={colors.textSecondary} />
        <Text style={styles.weatherLocation}>Weather in {displayWeather.location}</Text>
      </View>
      
      <View style={styles.weatherMain}>
        <Text style={styles.weatherTemp}>{Math.round(displayWeather.temperature)}°C</Text>
        <Text style={styles.weatherCondition}>{displayWeather.condition}</Text>
      </View>
      
      <View style={styles.weatherDetails}>
        <View style={styles.weatherDetailItem}>
          <Icon name="water" size={16} color={colors.infoBlue} />
          <Text style={styles.weatherDetailText}>{String(displayWeather.humidity || 95)}%</Text>
        </View>
        <View style={styles.weatherDetailItem}>
          <Icon name="air" size={16} color={colors.textSecondary} />
          <Text style={styles.weatherDetailText}>{String(displayWeather.windSpeed || 9.0)} km/h</Text>
        </View>
      </View>
      
      <Text style={styles.weatherMessage}>Good conditions for deliveries</Text>
    </View>
  );
};

// Moveout List Item Component - Matching Android exactly
const MoveoutListItem = ({
  list,
  onPress,
}: {
  list: MoveoutList;
  onPress: () => void;
}) => {
  const formatListDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const itemCount = list.items?.length || 0;
  const status = list.status || 'Pending';
  const isPending = status.toLowerCase() === 'pending' || status.toLowerCase() === 'draft' || status.toLowerCase() === 'active';

  return (
    <TouchableOpacity style={styles.moveoutItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.moveoutItemContent}>
        <Text style={styles.moveoutItemTitle}>{list.title || 'Moveout List'}</Text>
        <Text style={styles.moveoutItemDate}>{formatListDate(list.created_at)}</Text>
        <Text style={styles.moveoutItemCount}>{itemCount} items</Text>
      </View>
      <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusCompleted]}>
        <Text style={styles.statusText}>{isPending ? 'Pending' : 'Completed'}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Calendar Component - Matching Android exactly
const CalendarSection = ({
  events,
  selectedDate,
  onAddEvent,
  showAddButton,
}: {
  events: CalendarEvent[];
  selectedDate: Date;
  onAddEvent: () => void;
  showAddButton: boolean;
}) => {
  const [displayedMonth, setDisplayedMonth] = useState(new Date());
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  
  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Create calendar days array
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }
  
  // Get today's day for highlighting
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const todayDay = today.getDate();
  
  const goToPrevMonth = () => {
    setDisplayedMonth(new Date(year, month - 1, 1));
  };
  
  const goToNextMonth = () => {
    setDisplayedMonth(new Date(year, month + 1, 1));
  };

  return (
    <View style={styles.calendarCard}>
      {/* Header */}
      <View style={styles.calendarHeader}>
        <View>
          <Text style={styles.calendarTitle}>Calendar & Events</Text>
          <Text style={styles.calendarSubtitle}>Upcoming events and reminders</Text>
        </View>
        {showAddButton && (
          <TouchableOpacity style={styles.addEventButton} onPress={onAddEvent}>
            <Icon name="add" size={16} color={colors.textPrimary} />
            <Text style={styles.addEventText}>Add Event</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
          <Icon name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthText}>{monthNames[month]} {year}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Icon name="chevron-right" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      
      {/* Day Names */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((day) => (
          <Text key={day} style={styles.dayName}>{day}</Text>
        ))}
      </View>
      
      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => (
          <View key={index} style={styles.dayCell}>
            {day !== null && (
              <View style={[
                styles.dayCellContent,
                isCurrentMonth && day === todayDay && styles.todayCell
              ]}>
                <Text style={[
                  styles.dayText,
                  isCurrentMonth && day === todayDay && styles.todayText
                ]}>
                  {day}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
      
      {/* Upcoming Events */}
      <View style={styles.upcomingEvents}>
        <Text style={styles.upcomingTitle}>Upcoming Events</Text>
        {events.length === 0 ? (
          <Text style={styles.noEventsText}>No upcoming events</Text>
        ) : (
          events.slice(0, 5).map((event) => (
            <Text key={event.id} style={styles.eventItem}>• {event.title}</Text>
          ))
        )}
      </View>
    </View>
  );
};

// Main Dashboard Screen
const DashboardScreen = ({ navigation }: any) => {
  const { profile } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    thresholdStockItems: 0,
    lowStockItems: 0,
    criticalStockItems: 0,
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [moveoutLists, setMoveoutLists] = useState<MoveoutList[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedMoveoutList, setSelectedMoveoutList] = useState<MoveoutList | null>(null);
  const [showMoveoutItemsModal, setShowMoveoutItemsModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Role checks
  const isStaff = profile?.role === 'staff';
  const isManager = profile?.role === 'manager' || profile?.role === 'assistant_manager';
  const isAdmin = profile?.role === 'admin';
  const showStatsGrid = !isStaff; // Non-staff see stats
  const showGenerateButton = isManager; // Only managers can generate

  const userName = profile?.name || 'User';
  const todayDate = formatDate(new Date());

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);

    // Set default weather immediately so UI shows something
    if (!weather) {
      setWeather({
        temperature: 15,
        condition: 'Loading...',
        location: profile?.branchLocation || 'Växjö',
        humidity: 70,
        windSpeed: 10,
      });
    }

    try {
      // Load ALL data in parallel for much faster loading
      const city = profile?.branchLocation || 'Vaxjo';
      
      const [analyticsResult, weatherResult, moveoutResult, eventsResult] = await Promise.allSettled([
        apiClient.getAnalytics(),
        apiClient.getWeather(city),
        apiClient.getMoveoutLists(),
        apiClient.getCalendarEvents(),
      ]);

      // Process analytics (errors logged by ApiClient, just use defaults)
      if (analyticsResult.status === 'fulfilled') {
        const analyticsData = analyticsResult.value;
        setStats({
          totalItems: analyticsData.totalItems || 0,
          thresholdStockItems: (analyticsData as any).thresholdStockItems || analyticsData.lowStockItems || 0,
          lowStockItems: analyticsData.lowStockItems || 0,
          criticalStockItems: analyticsData.criticalItems || 0,
        });
      }

      // Process weather (show defaults on error)
      if (weatherResult.status === 'fulfilled') {
        setWeather(weatherResult.value);
      } else {
        setWeather({
          temperature: 15,
          condition: 'Clear sky',
          location: 'Växjö',
          humidity: 70,
          windSpeed: 10,
        });
      }

      // Process moveout lists
      if (moveoutResult.status === 'fulfilled') {
        const lists = moveoutResult.value;
        setMoveoutLists(lists.filter((l) => l.status === 'draft' || l.status === 'active'));
      }

      // Process calendar events
      if (eventsResult.status === 'fulfilled') {
        setCalendarEvents(eventsResult.value.slice(0, 5));
      }
    } catch (error) {
      // Errors already logged by ApiClient with throttling
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [profile, weather]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDashboardData(true);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    // Reload lists when showing history
    loadDashboardData(true);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryRed} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primaryRed}
            colors={[colors.primaryRed]}
          />
        }
      >
        {/* Dashboard Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              Welcome back, {userName}! Here's what's happening with your inventory.
            </Text>
            <View style={styles.dateRow}>
              <Icon name="today" size={16} color={colors.textSecondary} />
              <Text style={styles.dateText}>Today: {todayDate}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <Icon name="refresh" size={24} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Grid - 2x2 (Non-staff only) */}
        {showStatsGrid && (
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="Total Items"
                value={stats.totalItems}
                subtitle="Items in inventory"
                icon="inventory"
                iconColor={colors.primaryRed}
              />
              <StatCard
                title="Below Threshold"
                value={stats.thresholdStockItems}
                subtitle="Below threshold"
                icon="warning"
                iconColor={colors.warningOrange}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="Low Stock"
                value={stats.lowStockItems}
                subtitle="Need restocking"
                icon="trending-down"
                iconColor={colors.deepOrange}
              />
              <StatCard
                title="Critical Stock"
                value={stats.criticalStockItems}
                subtitle="Urgent action"
                icon="priority-high"
                iconColor={colors.errorRed}
              />
            </View>
          </View>
        )}

        {/* Weather Widget */}
        <WeatherWidget weather={weather} />

        {/* Generated Moveout Lists Section */}
        <View style={styles.moveoutSection}>
          <View style={styles.moveoutHeader}>
            <View>
              <Text style={styles.moveoutTitle}>Generated Moveout Lists</Text>
              <Text style={styles.moveoutSubtitle}>
                {showHistory ? 'Generated and completed moveout lists' : 'Generated moveout lists'}
              </Text>
            </View>
            <View style={styles.moveoutActions}>
              {showGenerateButton && (
                <TouchableOpacity 
                  style={styles.generateButton}
                  onPress={() => setShowGenerateModal(true)}
                >
                  <Icon name="add" size={16} color={colors.textPrimary} />
                  <Text style={styles.generateButtonText}>Generate</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={toggleHistory} style={styles.historyButton}>
                <Icon name="history" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Moveout Lists */}
          {moveoutLists.length === 0 ? (
            <View style={styles.emptyMoveout}>
              <Icon name="assignment" size={48} color={colors.textMuted} />
              <Text style={styles.emptyMoveoutText}>No active moveout lists generated yet</Text>
              <Text style={styles.emptyMoveoutHint}>Click "Generate" to create your first list</Text>
            </View>
          ) : (
            moveoutLists.map((list) => (
              <MoveoutListItem
                key={list.id}
                list={list}
                onPress={() => {
                  setSelectedMoveoutList(list);
                  setShowMoveoutItemsModal(true);
                }}
              />
            ))
          )}
        </View>

        {/* Calendar & Events Section (Non-staff only) */}
        {!isStaff && (
          <CalendarSection
            events={calendarEvents}
            selectedDate={new Date()}
            onAddEvent={() => setShowAddEventModal(true)}
            showAddButton={isManager}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Generate Moveout Modal */}
      {showGenerateModal && (
        <GenerateMoveoutModal
          visible={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false);
            loadDashboardData(true);
          }}
        />
      )}

      {/* Moveout Items Detail Modal */}
      <MoveoutItemsModal
        visible={showMoveoutItemsModal}
        moveoutList={selectedMoveoutList}
        onClose={() => {
          setShowMoveoutItemsModal(false);
          setSelectedMoveoutList(null);
        }}
        onItemProcessed={() => {
          loadDashboardData(true);
        }}
      />

      {/* Add Event Modal */}
      <AddEventModal
        visible={showAddEventModal}
        onClose={() => setShowAddEventModal(false)}
        onSuccess={() => {
          loadDashboardData(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 16,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  refreshButton: {
    padding: 8,
  },
  // Stats Grid
  statsGrid: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsCard: {
    width: (width - 44) / 2,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  statsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsCardTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  statsCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsCardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Weather Card
  weatherCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  weatherLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  weatherMain: {
    alignItems: 'center',
    marginBottom: 16,
  },
  weatherTemp: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  weatherCondition: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  weatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 12,
  },
  weatherDetailItem: {
    alignItems: 'center',
  },
  weatherDetailText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 4,
  },
  weatherMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Moveout Section
  moveoutSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  moveoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  moveoutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  moveoutSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  moveoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryRed,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  generateButtonText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginLeft: 4,
    fontWeight: '500',
  },
  historyButton: {
    padding: 4,
  },
  moveoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceDark,
  },
  moveoutItemContent: {
    flex: 1,
  },
  moveoutItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  moveoutItemDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  moveoutItemCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: colors.primaryRed,
  },
  statusCompleted: {
    backgroundColor: '#00C851',
  },
  statusText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  emptyMoveout: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyMoveoutText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptyMoveoutHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  // Calendar Section
  calendarCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  calendarSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryRed,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addEventText: {
    fontSize: 12,
    color: colors.textPrimary,
    marginLeft: 4,
    fontWeight: '500',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 8,
  },
  navButton: {
    padding: 4,
  },
  monthText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellContent: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  todayCell: {
    backgroundColor: colors.primaryRed,
  },
  dayText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  todayText: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  upcomingEvents: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceDark,
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  noEventsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  eventItem: {
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 4,
  },
});

export default DashboardScreen;
