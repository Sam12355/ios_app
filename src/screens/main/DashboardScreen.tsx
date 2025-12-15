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
import { useRef } from 'react';

import apiClient from '../../api/ApiClient';
import AddEventModal from '../../components/dashboard/AddEventModal';
import GenerateMoveoutModal from '../../components/dashboard/GenerateMoveoutModal';
import MoveoutItemsModal from '../../components/dashboard/MoveoutItemsModal';
import { CalendarEvent, MoveoutList, WeatherData } from '../../models';
import { useAuthStore } from '../../stores/authStore';
import { getDesignColors, useTheme } from '../../theme/ThemeContext';
import { Colors, DesignColors } from '../../theme/colors';

const { width } = Dimensions.get('window');

// Format time helper (Swedish time, with seconds)
const formatSwedishTime = (date: Date) => {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Europe/Stockholm',
  });
};
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
  themeColors,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  iconColor: string;
  onPress?: () => void;
  themeColors: DesignColors;
}) => (
  <TouchableOpacity 
    style={[
      styles.statsCard, 
      { 
        backgroundColor: themeColors.cardBackground,
        shadowColor: themeColors.shadowColor,
        shadowOpacity: themeColors.shadowOpacity,
        shadowRadius: themeColors.shadowRadius,
        shadowOffset: themeColors.shadowOffset,
        elevation: themeColors.elevation,
        borderWidth: themeColors.elevation === 0 ? 0 : 1,
        borderColor: themeColors.border,
      }
    ]} 
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.statsCardHeader}>
      <Text style={[styles.statsCardTitle, { color: themeColors.textSecondary }]}>{title}</Text>
      <Icon name={icon} size={16} color={iconColor} />
    </View>
    <Text style={[styles.statsCardValue, { color: iconColor }]}>{value}</Text>
    <Text style={[styles.statsCardSubtitle, { color: themeColors.textMuted }]}>{subtitle}</Text>
  </TouchableOpacity>
);

// Weather Widget Component - Matching Android exactly
const WeatherWidget = ({ weather, isLoading, themeColors }: { weather: WeatherData | null; isLoading?: boolean; themeColors: DesignColors }) => {
  // Always show weather widget with default or actual data
  const displayWeather = weather || {
    temperature: 15,
    condition: 'Loading...',
    location: 'Stockholm',
    humidity: 70,
    windSpeed: 10,
  };

  return (
    <View style={[
      styles.weatherCard, 
      { 
        backgroundColor: themeColors.cardBackground,
        shadowColor: themeColors.shadowColor,
        shadowOpacity: themeColors.shadowOpacity,
        shadowRadius: themeColors.shadowRadius,
        shadowOffset: themeColors.shadowOffset,
        elevation: themeColors.elevation,
        borderWidth: themeColors.elevation === 0 ? 0 : 1,
        borderColor: themeColors.border,
      }
    ]}>
      <View style={styles.weatherHeader}>
        <Icon name="cloud" size={20} color={themeColors.textSecondary} />
        <Text style={[styles.weatherLocation, { color: themeColors.textSecondary }]}>Weather in {displayWeather.location}</Text>
      </View>
      
      <View style={styles.weatherMain}>
        <Text style={[styles.weatherTemp, { color: themeColors.textPrimary }]}>{Math.round(displayWeather.temperature)}°C</Text>
        <Text style={[styles.weatherCondition, { color: themeColors.textSecondary }]}>{displayWeather.condition}</Text>
      </View>
      
      <View style={styles.weatherDetails}>
        <View style={styles.weatherDetailItem}>
          <Icon name="water" size={16} color={themeColors.infoBlue} />
          <Text style={[styles.weatherDetailText, { color: themeColors.textPrimary }]}>{String(displayWeather.humidity || 95)}%</Text>
        </View>
        <View style={styles.weatherDetailItem}>
          <Icon name="air" size={16} color={themeColors.textSecondary} />
          <Text style={[styles.weatherDetailText, { color: themeColors.textPrimary }]}>{String(displayWeather.windSpeed || 9.0)} km/h</Text>
        </View>
      </View>
      
      <Text style={[styles.weatherMessage, { color: themeColors.textMuted }]}>Good conditions for deliveries</Text>
    </View>
  );
};

// Moveout List Item Component - Matching Android exactly
const MoveoutListItem = ({
  list,
  onPress,
  themeColors,
}: {
  list: MoveoutList;
  onPress: () => void;
  themeColors: DesignColors;
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
    <TouchableOpacity 
      style={[
        styles.moveoutItem, 
        { 
          backgroundColor: themeColors.cardBackground, 
          borderColor: themeColors.border,
        }
      ]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={styles.moveoutItemContent}>
        <Text style={[styles.moveoutItemTitle, { color: themeColors.textPrimary }]}>{list.title || 'Moveout List'}</Text>
        <Text style={[styles.moveoutItemDate, { color: themeColors.textSecondary }]}>{formatListDate(list.created_at)}</Text>
        <Text style={[styles.moveoutItemCount, { color: themeColors.textMuted }]}>{itemCount} items</Text>
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
  themeColors,
}: {
  events: CalendarEvent[];
  selectedDate: Date;
  onAddEvent: () => void;
  showAddButton: boolean;
  themeColors: DesignColors;
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
    <View style={[
      styles.calendarCard, 
      { 
        backgroundColor: themeColors.cardBackground,
        shadowColor: themeColors.shadowColor,
        shadowOpacity: themeColors.shadowOpacity,
        shadowRadius: themeColors.shadowRadius,
        shadowOffset: themeColors.shadowOffset,
        elevation: themeColors.elevation,
        borderWidth: themeColors.elevation === 0 ? 0 : 1,
        borderColor: themeColors.border,
      }
    ]}>
      {/* Header */}
      <View style={styles.calendarHeader}>
        <View>
          <Text style={[styles.calendarTitle, { color: themeColors.textPrimary }]}>Calendar & Events</Text>
          <Text style={[styles.calendarSubtitle, { color: themeColors.textSecondary }]}>Upcoming events and reminders</Text>
        </View>
        {showAddButton && (
          <TouchableOpacity style={[styles.addEventButton, { backgroundColor: themeColors.primaryRed }]} onPress={onAddEvent}>
            <Icon name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addEventText}>Add Event</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Month Navigation */}
      <View style={[styles.monthNav, { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderWidth: 1 }]}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton}>
          <Icon name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: themeColors.textPrimary }]}>{monthNames[month]} {year}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Icon name="chevron-right" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
      </View>
      
      {/* Day Names */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((day) => (
          <Text key={day} style={[styles.dayName, { color: themeColors.textSecondary }]}>{day}</Text>
        ))}
      </View>
      
      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {calendarDays.map((day, index) => (
          <View key={index} style={styles.dayCell}>
            {day !== null && (
              <View style={[
                styles.dayCellContent,
                isCurrentMonth && day === todayDay && { backgroundColor: themeColors.primaryRed }
              ]}>
                <Text style={[
                  styles.dayText,
                  { color: themeColors.textPrimary },
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
      <View style={[styles.upcomingEvents, { borderTopColor: themeColors.border }]}>
        <Text style={[styles.upcomingTitle, { color: themeColors.textPrimary }]}>Upcoming Events</Text>
        {events.length === 0 ? (
          <Text style={[styles.noEventsText, { color: themeColors.textSecondary }]}>No upcoming events</Text>
        ) : (
          events.slice(0, 5).map((event) => (
            <Text key={event.id} style={[styles.eventItem, { color: themeColors.textPrimary }]}>• {event.title}</Text>
          ))
        )}
      </View>
    </View>
  );
};

// Main Dashboard Screen
const DashboardScreen = ({ navigation }: any) => {
  const { profile } = useAuthStore();
  const { colors, isDark, designColors } = useTheme();

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

  const [swedishTime, setSwedishTime] = useState(formatSwedishTime(new Date()));
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const todayDate = formatDate(new Date());

  useEffect(() => {
    // Update time every second
    timeIntervalRef.current = setInterval(() => {
      setSwedishTime(formatSwedishTime(new Date()));
    }, 1000);
    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    };
  }, []);

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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Dashboard Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: designColors.textPrimary }]}>Dashboard</Text>
            <Text style={[styles.headerSubtitle, { color: designColors.textSecondary }]}>
              Welcome back, {userName}! Here's what's happening with your inventory.
            </Text>
            <View style={styles.dateRow}>
              <Icon name="today" size={16} color={designColors.textSecondary} />
              <Text style={[styles.dateText, { color: designColors.textSecondary }]}>Today: {todayDate}</Text>
              <Icon name="access-time" size={16} color={designColors.textSecondary} style={{ marginLeft: 12 }} />
              <Text style={[styles.dateText, { color: designColors.textSecondary, marginLeft: 4 }]}>{swedishTime}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleRefresh} style={[styles.refreshButton, { backgroundColor: designColors.surface, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isDark ? 0 : 0.1, shadowRadius: 4, elevation: isDark ? 0 : 2 }]}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={designColors.textPrimary} />
            ) : (
              <Icon name="refresh" size={24} color={designColors.textPrimary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Staff quick actions (Staff sees a different dashboard) */}
        {isStaff && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('StockOut')}
              style={[styles.staffButton, { backgroundColor: designColors.primaryRed, marginRight: 8 }]}
            >
              <Text style={styles.staffButtonText}>Stock Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('StockIn')}
              style={[styles.staffButton, { backgroundColor: designColors.primaryRed, marginLeft: 8 }]}
            >
              <Text style={styles.staffButtonText}>Record Stock In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Grid - 2x2 (Non-staff only) */}
        {showStatsGrid && (
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="Total Items"
                value={stats.totalItems}
                subtitle="Items in inventory"
                icon="inventory"
                iconColor={"#E6002A"}
                themeColors={designColors}
              />
              <StatCard
                title="Below Threshold"
                value={stats.thresholdStockItems}
                subtitle="Below threshold"
                icon="warning"
                iconColor={designColors.warningOrange}
                themeColors={designColors}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="Low Stock"
                value={stats.lowStockItems}
                subtitle="Need restocking"
                icon="trending-down"
                iconColor={designColors.deepOrange}
                themeColors={designColors}
              />
              <StatCard
                title="Critical Stock"
                value={stats.criticalStockItems}
                subtitle="Urgent action"
                icon="priority-high"
                iconColor={designColors.errorRed}
                themeColors={designColors}
              />
            </View>
          </View>
        )}

        {/* Weather Widget */}
        <WeatherWidget weather={weather} themeColors={designColors} />

        {/* Generated Moveout Lists Section */}
        <View style={[
          styles.moveoutSection,
          {
            backgroundColor: designColors.cardBackground,
            shadowColor: designColors.shadowColor,
            shadowOpacity: designColors.shadowOpacity,
            shadowRadius: designColors.shadowRadius,
            shadowOffset: designColors.shadowOffset,
            elevation: designColors.elevation,
            borderWidth: designColors.elevation === 0 ? 0 : 1,
            borderColor: designColors.border,
          }
        ]}>
          <View style={styles.moveoutHeader}>
            <View>
              <Text style={[styles.moveoutTitle, { color: designColors.textPrimary }]}>Generated Moveout Lists</Text>
              <Text style={[styles.moveoutSubtitle, { color: designColors.textSecondary }]}>
                {showHistory ? 'Generated and completed moveout lists' : 'Generated moveout lists'}
              </Text>
            </View>
            <View style={styles.moveoutActions}>
              {showGenerateButton && (
                <TouchableOpacity 
                  style={[styles.generateButton, { backgroundColor: designColors.primaryRed }]}
                  onPress={() => setShowGenerateModal(true)}
                >
                  <Icon name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.generateButtonText}>Generate</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={toggleHistory} style={[styles.historyButton, { backgroundColor: designColors.surface, borderWidth: 1, borderColor: designColors.border }]}>
                <Icon name="history" size={24} color={designColors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Moveout Lists */}
          {moveoutLists.length === 0 ? (
            <View style={styles.emptyMoveout}>
              <Icon name="assignment" size={48} color={designColors.textMuted} />
              <Text style={[styles.emptyMoveoutText, { color: designColors.textSecondary }]}>No active moveout lists generated yet</Text>
              <Text style={[styles.emptyMoveoutHint, { color: designColors.textMuted }]}>Click "Generate" to create your first list</Text>
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
                themeColors={designColors}
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
            themeColors={designColors}
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
    backgroundColor: "#121212",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: "#B3B3B3",
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
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 8,
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    color: "#B3B3B3",
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
    backgroundColor: "#1A1A1A",
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
    color: "#B3B3B3",
    flex: 1,
  },
  statsCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsCardSubtitle: {
    fontSize: 12,
    color: "#B3B3B3",
  },
  // Weather Card
  weatherCard: {
    backgroundColor: "#1A1A1A",
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
    color: "#FFFFFF",
    marginLeft: 8,
  },
  weatherMain: {
    alignItems: 'center',
    marginBottom: 16,
  },
  weatherTemp: {
    fontSize: 48,
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  weatherCondition: {
    fontSize: 14,
    color: "#B3B3B3",
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
    color: "#FFFFFF",
    marginTop: 4,
  },
  weatherMessage: {
    fontSize: 13,
    color: "#B3B3B3",
    textAlign: 'center',
  },
  // Moveout Section
  moveoutSection: {
    backgroundColor: "#1A1A1A",
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
    color: "#FFFFFF",
    marginBottom: 4,
  },
  moveoutSubtitle: {
    fontSize: 12,
    color: "#B3B3B3",
  },
  moveoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#E6002A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  generateButtonText: {
    fontSize: 12,
    color: "#FFFFFF",
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
    borderBottomColor: "#1E1E1E",
  },
  moveoutItemContent: {
    flex: 1,
  },
  moveoutItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
    marginBottom: 2,
  },
  moveoutItemDate: {
    fontSize: 12,
    color: "#B3B3B3",
    marginBottom: 2,
  },
  moveoutItemCount: {
    fontSize: 12,
    color: "#808080",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: "#E6002A",
  },
  statusCompleted: {
    backgroundColor: '#00C851',
  },
  statusText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: '500',
  },
  emptyMoveout: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyMoveoutText: {
    fontSize: 14,
    color: "#B3B3B3",
    marginTop: 12,
  },
  emptyMoveoutHint: {
    fontSize: 12,
    color: "#808080",
    marginTop: 4,
  },
  // Calendar Section
  calendarCard: {
    backgroundColor: "#1A1A1A",
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
    color: "#FFFFFF",
    marginBottom: 4,
  },
  calendarSubtitle: {
    fontSize: 12,
    color: "#B3B3B3",
  },
  addEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#E6002A",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addEventText: {
    fontSize: 12,
    color: "#FFFFFF",
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
    color: "#FFFFFF",
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
    color: "#B3B3B3",
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
    backgroundColor: "#E6002A",
  },
  dayText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  todayText: {
    fontWeight: 'bold',
    color: "#FFFFFF",
  },
  staffButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffButtonText: {
    color: "#FFFFFF",
    fontWeight: '600',
    fontSize: 14,
  },
  upcomingEvents: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1E1E1E",
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
    marginBottom: 12,
  },
  noEventsText: {
    fontSize: 13,
    color: "#B3B3B3",
  },
  eventItem: {
    fontSize: 13,
    color: "#FFFFFF",
    marginBottom: 4,
  },
});

export default DashboardScreen;
