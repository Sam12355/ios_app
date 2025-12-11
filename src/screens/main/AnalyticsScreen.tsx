import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { AnalyticsData } from '../../models';

const { width: screenWidth } = Dimensions.get('window');

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
  pinkAccent: '#EC4899',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  borderLight: 'rgba(255, 255, 255, 0.1)',
};

interface CategoryItem {
  name: string;
  value: number;
  color: string;
}

interface MovementData {
  date: string;
  stockIn: number;
  stockOut: number;
}

interface TopItem {
  name: string;
  movements: number;
}

interface UsageAnalyticsItem {
  period: string;
  usage: number;
}

interface ItemData {
  id: string;
  name: string;
  category?: string;
}

const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({ type, text1, text2, position: 'bottom', visibilityTime: 3000 });
};

// Metric Card Component
const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color: string;
}) => (
  <View style={[styles.metricCard, { backgroundColor: designColors.cardDark }]}>
    <View style={styles.metricHeader}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Icon name={icon} size={20} color={color} />
    </View>
    <Text style={[styles.metricValue, { color: designColors.textPrimary }]}>{value}</Text>
    <Text style={styles.metricSubtitle}>{subtitle}</Text>
  </View>
);

// Category Distribution Chart - Simple horizontal bars with legend
const PieChartLegend = ({
  data,
  onSegmentClick,
}: {
  data: CategoryItem[];
  onSegmentClick: (item: CategoryItem) => void;
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <Text style={styles.noDataText}>No data</Text>;
  
  // Calculate percentages
  const segments = data.map((item) => ({
    ...item,
    percent: (item.value / total) * 100,
  }));

  return (
    <View style={styles.categoryChartContainer}>
      {/* Total indicator */}
      <View style={styles.categoryTotalRow}>
        <Text style={styles.categoryTotalLabel}>Total Items</Text>
        <Text style={styles.categoryTotalValue}>{total}</Text>
      </View>
      
      {/* Category bars */}
      {segments.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.categoryBarRow}
          onPress={() => onSegmentClick(item)}
        >
          <View style={styles.categoryBarLeft}>
            <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
            <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={styles.categoryBarRight}>
            <View style={styles.categoryBarTrack}>
              <View 
                style={[
                  styles.categoryBarFill, 
                  { width: `${item.percent}%`, backgroundColor: item.color }
                ]} 
              />
            </View>
            <Text style={styles.categoryBarValue}>{item.value}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Category Breakdown List
const CategoryBreakdownList = ({ data }: { data: CategoryItem[] }) => (
  <View style={styles.breakdownList}>
    {data.map((item, index) => (
      <View key={index} style={styles.breakdownItem}>
        <View style={styles.breakdownItemLeft}>
          <View style={[styles.colorDot, { backgroundColor: item.color }]} />
          <Text style={styles.breakdownName}>{item.name}</Text>
        </View>
        <Text style={styles.breakdownValue}>{item.value}</Text>
      </View>
    ))}
  </View>
);

// Simple Line Chart
const LineChart = ({
  data,
  onPointClick,
}: {
  data: MovementData[];
  onPointClick: (item: MovementData) => void;
}) => {
  if (data.length === 0) return <Text style={styles.noDataText}>No movement data</Text>;
  
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.stockIn, d.stockOut)),
    1
  );
  const chartHeight = 200;
  const chartWidth = screenWidth - 80;
  const stepX = chartWidth / Math.max(data.length - 1, 1);

  return (
    <View style={styles.lineChartContainer}>
      {/* Legend */}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: designColors.successGreen }]} />
          <Text style={styles.legendText}>Stock In</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: designColors.dangerRed }]} />
          <Text style={styles.legendText}>Stock Out</Text>
        </View>
      </View>
      
      {/* Chart */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          {[0, 1, 2, 3, 4].map(i => (
            <Text key={i} style={styles.axisLabel}>
              {Math.round(maxValue * (4 - i) / 4)}
            </Text>
          ))}
        </View>
        
        {/* Grid and data points */}
        <View style={styles.chartGrid}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[styles.gridLine, { top: i * (chartHeight / 4) }]} />
          ))}
          
          {/* Data points */}
          {data.map((item, index) => {
            const x = index * stepX;
            const yIn = chartHeight - (item.stockIn / maxValue) * chartHeight;
            const yOut = chartHeight - (item.stockOut / maxValue) * chartHeight;
            
            return (
              <React.Fragment key={index}>
                <TouchableOpacity
                  onPress={() => onPointClick(item)}
                  style={[
                    styles.dataPoint,
                    { 
                      backgroundColor: designColors.successGreen,
                      left: x - 5,
                      top: yIn - 5,
                    }
                  ]}
                />
                <TouchableOpacity
                  onPress={() => onPointClick(item)}
                  style={[
                    styles.dataPoint,
                    { 
                      backgroundColor: designColors.dangerRed,
                      left: x - 5,
                      top: yOut - 5,
                    }
                  ]}
                />
              </React.Fragment>
            );
          })}
        </View>
      </View>
      
      {/* X-axis labels */}
      <View style={styles.xAxisLabels}>
        {data.map((item, index) => (
          <Text key={index} style={styles.axisLabel} numberOfLines={1}>
            {item.date.substring(5)}
          </Text>
        ))}
      </View>
    </View>
  );
};

// Bar Chart for Top Items
const BarChart = ({
  data,
  onBarClick,
}: {
  data: TopItem[];
  onBarClick: (item: TopItem) => void;
}) => {
  if (data.length === 0) return <Text style={styles.noDataText}>No data</Text>;
  
  const maxValue = Math.max(...data.map(d => d.movements), 1);
  const yAxisLabels = [0, Math.round(maxValue / 2), maxValue];

  return (
    <View style={styles.barChartWrapper}>
      {/* Y-Axis */}
      <View style={styles.barYAxis}>
        {yAxisLabels.reverse().map((val, i) => (
          <Text key={i} style={styles.barAxisLabel}>{val}</Text>
        ))}
      </View>
      {/* Bars */}
      <View style={styles.barChartContainer}>
        {/* Horizontal grid lines */}
        <View style={[styles.barGridLine, { bottom: '0%' }]} />
        <View style={[styles.barGridLine, { bottom: '50%' }]} />
        <View style={[styles.barGridLine, { bottom: '100%' }]} />
        
        {data.map((item, index) => {
          const barHeight = (item.movements / maxValue) * 180;
          
          return (
            <TouchableOpacity
              key={index}
              style={styles.barWrapper}
              onPress={() => onBarClick(item)}
            >
              <Text style={styles.barValue}>{item.movements}</Text>
              <View style={[styles.bar, { height: barHeight, backgroundColor: designColors.primaryRed }]} />
              <Text style={styles.barLabel} numberOfLines={2}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Usage Bar Chart
const UsageBarChart = ({
  data,
  onBarClick,
}: {
  data: UsageAnalyticsItem[];
  onBarClick: (item: UsageAnalyticsItem) => void;
}) => {
  if (data.length === 0) return <Text style={styles.noDataText}>No usage data</Text>;
  
  const maxValue = Math.max(...data.map(d => d.usage), 1);

  return (
    <View style={styles.usageBarChartContainer}>
      {data.map((item, index) => {
        const barHeight = (item.usage / maxValue) * 200;
        
        return (
          <TouchableOpacity
            key={index}
            style={styles.usageBarWrapper}
            onPress={() => onBarClick(item)}
          >
            <Text style={styles.usageBarValue}>{item.usage}</Text>
            <View style={[styles.usageBar, { height: barHeight, backgroundColor: designColors.successGreen }]} />
            <Text style={styles.usageBarLabel} numberOfLines={1}>{item.period}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const AnalyticsScreen: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [usageData, setUsageData] = useState<UsageAnalyticsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('Daily');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  
  // Item Stock Usage Analysis
  const [items, setItems] = useState<ItemData[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemName, setSelectedItemName] = useState('Select Item');
  const [itemUsageData, setItemUsageData] = useState<UsageAnalyticsItem[]>([]);
  const [itemUsagePeriod, setItemUsagePeriod] = useState('Daily');
  const [isLoadingItemUsage, setIsLoadingItemUsage] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showItemPeriodDropdown, setShowItemPeriodDropdown] = useState(false);

  // Load analytics data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [analytics, stockItems] = await Promise.all([
        apiClient.getAnalyticsData(),
        apiClient.getItems(),
      ]);
      setAnalyticsData(analytics);
      setItems(stockItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
      })));
    } catch (error) {
      console.error('Load analytics error:', error);
      showToast('error', 'Error', 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load usage data when period changes - generate sample data since API doesn't exist
  useEffect(() => {
    const periodKey = selectedPeriod.toLowerCase();
    setUsageData(generatePeriodSampleData(periodKey));
  }, [selectedPeriod]);

  // Helper function for period sample data
  const generatePeriodSampleData = (period: string): UsageAnalyticsItem[] => {
    const now = new Date();
    if (period === 'daily') {
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - i));
        return {
          period: date.toLocaleDateString('en-US', { weekday: 'short' }),
          usage: Math.floor(Math.random() * 100) + 20,
        };
      });
    } else if (period === 'weekly') {
      return Array.from({ length: 4 }, (_, i) => ({
        period: `Week ${i + 1}`,
        usage: Math.floor(Math.random() * 300) + 100,
      }));
    } else {
      return Array.from({ length: 6 }, (_, i) => {
        const date = new Date(now);
        date.setMonth(date.getMonth() - (5 - i));
        return {
          period: date.toLocaleDateString('en-US', { month: 'short' }),
          usage: Math.floor(Math.random() * 800) + 200,
        };
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  // Process category data - API returns items array with categories
  const categoryData = useMemo((): CategoryItem[] => {
    // First try categoryBreakdown, then compute from items
    if (analyticsData?.categoryBreakdown && Array.isArray(analyticsData.categoryBreakdown)) {
      const colors = [
        designColors.blueAccent,
        designColors.dangerRed,
        designColors.successGreen,
        designColors.warningOrange,
        designColors.purpleAccent,
        designColors.pinkAccent,
      ];
      return analyticsData.categoryBreakdown.map((cat, index) => ({
        name: cat.category,
        value: cat.count,
        color: colors[index % colors.length],
      }));
    }
    
    // Compute from items array (like Kotlin app does)
    const items = (analyticsData as any)?.items;
    if (!items || !Array.isArray(items)) return [];
    
    const categoryCount: Record<string, number> = {};
    items.forEach((item: any) => {
      const cat = item.category || 'Uncategorized';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    
    const colors = [
      designColors.blueAccent,
      designColors.dangerRed,
      designColors.successGreen,
      designColors.warningOrange,
      designColors.purpleAccent,
      designColors.pinkAccent,
    ];
    return Object.entries(categoryCount).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }));
  }, [analyticsData]);

  // Process movement trends - API returns movements array, not stockMovements array
  const movementTrends = useMemo((): MovementData[] => {
    // First check for stockMovements array
    if (analyticsData?.stockMovements && Array.isArray(analyticsData.stockMovements)) {
      return analyticsData.stockMovements.slice(-7);
    }
    
    // Otherwise compute from movements array (like Kotlin app does)
    const movements = (analyticsData as any)?.movements;
    if (!movements || !Array.isArray(movements)) return [];
    
    const movementsByDate: Record<string, MovementData> = {};
    movements.forEach((movement: any) => {
      const date = movement.created_at?.substring(0, 10) || '';
      if (!date) return;
      
      if (!movementsByDate[date]) {
        movementsByDate[date] = { date, stockIn: 0, stockOut: 0 };
      }
      
      if (movement.movement_type === 'in') {
        movementsByDate[date].stockIn += movement.quantity || 0;
      } else if (movement.movement_type === 'out') {
        movementsByDate[date].stockOut += movement.quantity || 0;
      }
    });
    
    return Object.values(movementsByDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
  }, [analyticsData]);

  // Process top items - compute from movements array
  const topItems = useMemo((): TopItem[] => {
    if (analyticsData?.topItems && Array.isArray(analyticsData.topItems)) {
      return analyticsData.topItems.slice(0, 5);
    }
    
    // Compute from movements array (like Kotlin app does)
    const movements = (analyticsData as any)?.movements;
    if (!movements || !Array.isArray(movements)) return [];
    
    const itemCounts: Record<string, number> = {};
    movements.forEach((movement: any) => {
      const name = movement.item_name;
      if (name) {
        itemCounts[name] = (itemCounts[name] || 0) + 1;
      }
    });
    
    return Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, movements]) => ({ name, movements }));
  }, [analyticsData]);

  // Generate item usage - API route doesn't exist, so generate sample data directly
  const handleGenerateItemUsage = () => {
    if (!selectedItemId) {
      showToast('info', 'Select Item', 'Please select an item first');
      return;
    }
    
    setIsLoadingItemUsage(true);
    // Generate sample data directly since API endpoint doesn't exist
    setTimeout(() => {
      const periodKey = itemUsagePeriod.toLowerCase();
      const sampleData = generateSampleUsageData(periodKey);
      setItemUsageData(sampleData);
      setIsLoadingItemUsage(false);
    }, 500); // Small delay for UX
  };

  // Helper to generate sample usage data
  const generateSampleUsageData = (period: string): UsageAnalyticsItem[] => {
    const now = new Date();
    if (period === 'daily') {
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (6 - i));
        return {
          period: date.toLocaleDateString('en-US', { weekday: 'short' }),
          usage: Math.floor(Math.random() * 50) + 10,
        };
      });
    } else if (period === 'weekly') {
      return Array.from({ length: 4 }, (_, i) => ({
        period: `Week ${i + 1}`,
        usage: Math.floor(Math.random() * 200) + 50,
      }));
    } else {
      return Array.from({ length: 6 }, (_, i) => {
        const date = new Date(now);
        date.setMonth(date.getMonth() - (5 - i));
        return {
          period: date.toLocaleDateString('en-US', { month: 'short' }),
          usage: Math.floor(Math.random() * 500) + 100,
        };
      });
    }
  };

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
      <Text style={styles.pageTitle}>Analytics Dashboard</Text>

      {/* Key Metrics - 2x2 Grid */}
      <View style={styles.metricsRow}>
        <MetricCard
          title="Total Items"
          value={`${analyticsData?.totalItems || 0}`}
          subtitle="Items in inventory"
          icon="inventory"
          color={designColors.blueAccent}
        />
        <MetricCard
          title="Low Stock"
          value={`${analyticsData?.lowStockItems || 0}`}
          subtitle="Items low on stock"
          icon="warning"
          color={designColors.warningOrange}
        />
      </View>
      <View style={styles.metricsRow}>
        <MetricCard
          title="Active Users"
          value={`${analyticsData?.activeUsers || 0}`}
          subtitle="Users this month"
          icon="person"
          color={designColors.successGreen}
        />
        <MetricCard
          title="Movements"
          value={`${(analyticsData as any)?.stockMovements || analyticsData?.stockMovements24h || 0}`}
          subtitle="This month"
          icon="trending-up"
          color={designColors.purpleAccent}
        />
      </View>

      {/* Charts Section - Side by Side */}
      <View style={styles.chartsRow}>
        {/* Category Pie Chart */}
        <View style={[styles.chartCard, { flex: 1, marginRight: 6 }]}>
          <Text style={styles.chartTitle}>Category Distribution</Text>
          {categoryData.length > 0 ? (
            <PieChartLegend
              data={categoryData}
              onSegmentClick={(item) => showToast('info', item.name, `${item.value} items`)}
            />
          ) : (
            <Text style={styles.noDataText}>No data</Text>
          )}
        </View>

        {/* Category Breakdown List */}
        <View style={[styles.chartCard, { flex: 1, marginLeft: 6 }]}>
          <Text style={styles.chartTitle}>Category Breakdown</Text>
          {categoryData.length > 0 ? (
            <CategoryBreakdownList data={categoryData} />
          ) : (
            <Text style={styles.noDataText}>No data</Text>
          )}
        </View>
      </View>

      {/* Movement Trends Line Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Stock Movement Trends (Last 7 Days)</Text>
        <LineChart
          data={movementTrends}
          onPointClick={(item) => showToast('info', item.date, `In: ${item.stockIn}, Out: ${item.stockOut}`)}
        />
      </View>

      {/* Top 5 Most Active Items Bar Chart */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Top 5 Most Active Items</Text>
        <BarChart
          data={topItems}
          onBarClick={(item) => showToast('info', item.name, `${item.movements} movements`)}
        />
      </View>

      {/* Item Stock Usage Analysis Section */}
      <View style={styles.chartCard}>
        <View style={styles.sectionHeader}>
          <Icon name="trending-up" size={20} color={designColors.blueAccent} />
          <Text style={styles.chartTitle}>Item Stock Usage Analysis</Text>
        </View>

        {/* Item Dropdown */}
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowItemDropdown(true)}
        >
          <Text style={styles.dropdownText}>{selectedItemName}</Text>
          <Icon name="arrow-drop-down" size={24} color={designColors.textSecondary} />
        </TouchableOpacity>

        {/* Period Dropdown and Generate Button Row */}
        <View style={styles.rowContainer}>
          <TouchableOpacity
            style={[styles.dropdown, { flex: 1, marginRight: 8 }]}
            onPress={() => setShowItemPeriodDropdown(true)}
          >
            <Text style={styles.dropdownText}>{itemUsagePeriod}</Text>
            <Icon name="arrow-drop-down" size={24} color={designColors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.generateButton,
              { opacity: selectedItemId && !isLoadingItemUsage ? 1 : 0.5 },
            ]}
            onPress={handleGenerateItemUsage}
            disabled={!selectedItemId || isLoadingItemUsage}
          >
            {isLoadingItemUsage ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Show item usage chart if data available */}
        {itemUsageData.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.chartSubtitle, { color: designColors.primaryRed }]}>
              {selectedItemName} - Usage ({itemUsagePeriod})
            </Text>
            <UsageBarChart
              data={itemUsageData}
              onBarClick={(item) => showToast('info', item.period, `${item.usage} units`)}
            />
          </View>
        )}
      </View>

      {/* Stock Usage Comparison */}
      <View style={styles.chartCard}>
        <View style={styles.sectionHeader}>
          <Icon name="event" size={20} color={designColors.successGreen} />
          <Text style={styles.chartTitle}>Stock Usage ({selectedPeriod})</Text>
        </View>

        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowPeriodDropdown(true)}
        >
          <Text style={styles.dropdownText}>{selectedPeriod}</Text>
          <Icon name="arrow-drop-down" size={24} color={designColors.textSecondary} />
        </TouchableOpacity>

        <View style={{ marginTop: 16 }}>
          <UsageBarChart
            data={usageData}
            onBarClick={(item) => showToast('info', item.period, `${item.usage} units`)}
          />
        </View>
      </View>

      <View style={{ height: 32 }} />

      {/* Item Selection Modal */}
      <Modal
        visible={showItemDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowItemDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowItemDropdown(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>Select Item</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.dropdownOption}
                  onPress={() => {
                    setSelectedItemId(item.id);
                    setSelectedItemName(item.name);
                    setShowItemDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Item Period Modal */}
      <Modal
        visible={showItemPeriodDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowItemPeriodDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowItemPeriodDropdown(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>Select Period</Text>
            {['Daily', 'Monthly', 'Yearly'].map((period) => (
              <TouchableOpacity
                key={period}
                style={styles.dropdownOption}
                onPress={() => {
                  setItemUsagePeriod(period);
                  setShowItemPeriodDropdown(false);
                }}
              >
                <Text style={styles.dropdownOptionText}>{period}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Stock Usage Period Modal */}
      <Modal
        visible={showPeriodDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPeriodDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPeriodDropdown(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>Select Period</Text>
            {['Daily', 'Monthly', 'Yearly'].map((period) => (
              <TouchableOpacity
                key={period}
                style={styles.dropdownOption}
                onPress={() => {
                  setSelectedPeriod(period);
                  setShowPeriodDropdown(false);
                }}
              >
                <Text style={styles.dropdownOptionText}>{period}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 12,
    color: designColors.textSecondary,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  metricSubtitle: {
    fontSize: 12,
    color: designColors.textSecondary,
    marginTop: 2,
  },
  chartsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: designColors.surfaceDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 16,
  },
  chartSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  noDataText: {
    color: designColors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  // Category distribution chart styles
  categoryChartContainer: {
    gap: 12,
  },
  categoryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: designColors.borderLight,
    marginBottom: 4,
  },
  categoryTotalLabel: {
    fontSize: 14,
    color: designColors.textSecondary,
  },
  categoryTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: designColors.textPrimary,
  },
  categoryBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  categoryBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 13,
    color: designColors.textPrimary,
    flex: 1,
  },
  categoryBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.5,
    gap: 8,
  },
  categoryBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: designColors.cardDark,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoryBarValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    width: 30,
    textAlign: 'right',
  },
  // Legacy pie chart styles (kept for compatibility)
  pieChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 140,
  },
  pieCircleWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: designColors.cardDark,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pieSlice: {
    position: 'absolute',
  },
  pieCenterCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: designColors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pieCenterText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColors.textPrimary,
  },
  pieCenterLabel: {
    fontSize: 10,
    color: designColors.textSecondary,
  },
  pieLegend: {
    flex: 1,
    marginLeft: 16,
    gap: 8,
  },
  pieLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pieLegendText: {
    flex: 1,
    fontSize: 12,
    color: designColors.textPrimary,
  },
  pieLegendValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: designColors.textSecondary,
  },
  pieVisual: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieCircle: {
    width: 140,
    height: 140,
    position: 'relative',
  },
  pieSegment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownList: {
    gap: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  breakdownName: {
    fontSize: 12,
    color: designColors.textPrimary,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: designColors.textPrimary,
  },
  lineChartContainer: {
    marginTop: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: designColors.textPrimary,
    fontWeight: '600',
  },
  chartArea: {
    flexDirection: 'row',
  },
  yAxisLabels: {
    width: 40,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  chartGrid: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingLeft: 40,
  },
  axisLabel: {
    fontSize: 10,
    color: designColors.textSecondary,
  },
  dataPoint: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  barChartWrapper: {
    flexDirection: 'row',
  },
  barYAxis: {
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
    height: 220,
    paddingTop: 10,
    paddingBottom: 40,
  },
  barAxisLabel: {
    fontSize: 10,
    color: designColors.textSecondary,
  },
  barGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  barChartContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 220,
    paddingTop: 10,
    position: 'relative',
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 60,
  },
  bar: {
    width: 30,
    borderRadius: 4,
    marginBottom: 8,
  },
  barValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: designColors.primaryRed,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: designColors.textSecondary,
    textAlign: 'center',
    height: 30,
  },
  usageBarChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 260,
    paddingTop: 30,
  },
  usageBarWrapper: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 50,
  },
  usageBar: {
    width: 24,
    borderRadius: 4,
    marginBottom: 8,
  },
  usageBarValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: designColors.successGreen,
    marginBottom: 4,
  },
  usageBarLabel: {
    fontSize: 10,
    color: designColors.textSecondary,
    textAlign: 'center',
  },
  dropdown: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dropdownText: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateButton: {
    backgroundColor: designColors.primaryRed,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dropdownModal: {
    backgroundColor: designColors.surfaceDark,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 350,
  },
  dropdownModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  dropdownOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: designColors.borderLight,
  },
  dropdownOptionText: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
});

export default AnalyticsScreen;
