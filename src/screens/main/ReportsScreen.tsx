import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { MovementReportItem, StockReportItem } from '../../models';

type ReportType = 'stock' | 'movements' | 'softdrinks';

interface SoftDrinksWeekItem {
  item_name: string;
  stock_in: number;
  stock_out: number;
  trend: string;
}

interface SoftDrinksWeekData {
  week_start: string;
  week_end: string;
  total_stock_in: number;
  total_stock_out: number;
  total_net_change: number;
  overall_trend: string;
  items: SoftDrinksWeekItem[];
}

interface SoftDrinksSummary {
  total_stock_in: number;
  total_stock_out: number;
  total_net_change: number;
}

interface SoftDrinksReportResponse {
  data: SoftDrinksWeekData[];
  summary?: SoftDrinksSummary;
}

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
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  borderLight: 'rgba(255, 255, 255, 0.1)',
};

const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({ type, text1, text2, position: 'bottom', visibilityTime: 3000 });
};

const ReportsScreen: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>('stock');
  const [showReportDropdown, setShowReportDropdown] = useState(false);
  
  // Report data
  const [stockReport, setStockReport] = useState<StockReportItem[]>([]);
  const [movementsReport, setMovementsReport] = useState<MovementReportItem[]>([]);
  const [softDrinksReport, setSoftDrinksReport] = useState<SoftDrinksReportResponse | null>(null);
  
  // Loading states
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [isLoadingSoftDrinks, setIsLoadingSoftDrinks] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Loaded flags to cache data
  const [stockLoaded, setStockLoaded] = useState(false);
  const [movementsLoaded, setMovementsLoaded] = useState(false);
  
  // Filters
  const [selectedWeeks, setSelectedWeeks] = useState(4);
  const [showWeeksDropdown, setShowWeeksDropdown] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  // Load stock report
  const loadStockReport = useCallback(async (force = false) => {
    if (stockLoaded && !force) return;
    setIsLoadingStock(true);
    try {
      const data = await apiClient.getStockReport();
      setStockReport(data);
      setStockLoaded(true);
    } catch (error) {
      console.error('Load stock report error:', error);
      showToast('error', 'Error', 'Failed to load stock report');
    } finally {
      setIsLoadingStock(false);
    }
  }, [stockLoaded]);

  // Load movements report
  const loadMovementsReport = useCallback(async (force = false) => {
    if (movementsLoaded && !force) return;
    setIsLoadingMovements(true);
    try {
      const data = await apiClient.getMovementsReport();
      setMovementsReport(data);
      setMovementsLoaded(true);
    } catch (error) {
      console.error('Load movements report error:', error);
      showToast('error', 'Error', 'Failed to load movements report');
    } finally {
      setIsLoadingMovements(false);
    }
  }, [movementsLoaded]);

  // Load soft drinks report
  const loadSoftDrinksReport = useCallback(async () => {
    setIsLoadingSoftDrinks(true);
    try {
      const data = await apiClient.getSoftDrinksReport(selectedWeeks);
      setSoftDrinksReport(data as any);
    } catch (error) {
      console.error('Load soft drinks report error:', error);
      showToast('error', 'Error', 'Failed to load soft drinks report');
    } finally {
      setIsLoadingSoftDrinks(false);
    }
  }, [selectedWeeks]);

  // Load data based on selected report
  useEffect(() => {
    switch (selectedReport) {
      case 'stock':
        loadStockReport();
        break;
      case 'movements':
        loadMovementsReport();
        break;
      case 'softdrinks':
        loadSoftDrinksReport();
        break;
    }
  }, [selectedReport, loadStockReport, loadMovementsReport, loadSoftDrinksReport]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    switch (selectedReport) {
      case 'stock':
        await loadStockReport(true);
        break;
      case 'movements':
        await loadMovementsReport(true);
        break;
      case 'softdrinks':
        await loadSoftDrinksReport();
        break;
    }
    setRefreshing(false);
  }, [selectedReport, loadStockReport, loadMovementsReport, loadSoftDrinksReport]);

  // Filter movements by selected month
  const filteredMovements = useMemo(() => {
    return movementsReport.filter((movement) => {
      try {
        const movementDate = new Date(movement.created_at);
        return (
          movementDate.getFullYear() === selectedMonth.getFullYear() &&
          movementDate.getMonth() === selectedMonth.getMonth()
        );
      } catch {
        return false;
      }
    });
  }, [movementsReport, selectedMonth]);

  // Calculate totals
  const totalStockIn = useMemo(() => 
    filteredMovements.filter(m => m.movement_type === 'in').reduce((sum, m) => sum + m.quantity, 0),
    [filteredMovements]
  );
  const totalStockOut = useMemo(() => 
    filteredMovements.filter(m => m.movement_type === 'out').reduce((sum, m) => sum + m.quantity, 0),
    [filteredMovements]
  );

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options: Date[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      options.push(date);
    }
    return options;
  }, []);

  // Format month
  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr.substring(0, 10);
    }
  };

  // Get report type label
  const getReportLabel = (type: ReportType) => {
    switch (type) {
      case 'stock': return 'Stock Levels Report';
      case 'movements': return 'Stock Movements Report';
      case 'softdrinks': return 'Soft Drinks Weekly Report';
    }
  };

  // Get report icon
  const getReportIcon = (type: ReportType) => {
    switch (type) {
      case 'stock': return 'inventory';
      case 'movements': return 'swap-vert';
      case 'softdrinks': return 'local-drink';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'critical': return designColors.dangerRed;
      case 'low': return designColors.warningOrange;
      default: return designColors.successGreen;
    }
  };

  // Generate CSV content for Stock Report
  const generateStockCSV = (): string => {
    let csv = 'Name,Category,Current Quantity,Threshold,Status\n';
    stockReport.forEach(item => {
      csv += `"${item.name}","${item.category}",${item.current_quantity},${item.threshold_level},"${item.status}"\n`;
    });
    return csv;
  };

  // Generate CSV content for Movements Report  
  const generateMovementsCSV = (): string => {
    let csv = 'Date,Item Name,Movement Type,Quantity,User,Reason\n';
    filteredMovements.forEach(item => {
      csv += `"${item.created_at}","${item.item_name}","${item.movement_type}",${item.quantity},"${item.user_name || ''}","${item.reason || ''}"\n`;
    });
    return csv;
  };

  // Generate CSV content for Soft Drinks Report
  const generateSoftDrinksCSV = (): string => {
    if (!softDrinksReport?.data) return '';
    let csv = 'Week,Start Date,End Date,Total In,Total Out,Net Change,Trend\n';
    softDrinksReport.data.forEach((week, index) => {
      csv += `Week ${index + 1},"${week.week_start?.substring(0, 10) || ''}","${week.week_end?.substring(0, 10) || ''}",${week.total_stock_in},${week.total_stock_out},${week.total_net_change},"${week.overall_trend}"\n`;
    });
    return csv;
  };

  // Export handlers
  const handleExportPDF = async () => {
    try {
      // For PDF we'll share as text since generating actual PDF requires additional libraries
      let content = '';
      const timestamp = new Date().toLocaleString();
      
      if (selectedReport === 'stock') {
        content = `STOCK LEVELS REPORT\nGenerated: ${timestamp}\n\n`;
        stockReport.forEach(item => {
          content += `${item.name}\n  Category: ${item.category}\n  Quantity: ${item.current_quantity}\n  Status: ${item.status}\n\n`;
        });
      } else if (selectedReport === 'movements') {
        content = `STOCK MOVEMENTS REPORT - ${formatMonth(selectedMonth)}\nGenerated: ${timestamp}\n\nTotal In: ${totalStockIn}\nTotal Out: ${totalStockOut}\n\n`;
        filteredMovements.forEach(item => {
          content += `${item.item_name}\n  Date: ${formatDate(item.created_at)}\n  Type: ${item.movement_type}\n  Quantity: ${item.quantity}\n  User: ${item.user_name || 'N/A'}\n\n`;
        });
      } else if (selectedReport === 'softdrinks' && softDrinksReport) {
        content = `SOFT DRINKS WEEKLY REPORT (${selectedWeeks} weeks)\nGenerated: ${timestamp}\n\n`;
        if (softDrinksReport.summary) {
          content += `Summary:\n  Total In: ${softDrinksReport.summary.total_stock_in}\n  Total Out: ${softDrinksReport.summary.total_stock_out}\n  Net Change: ${softDrinksReport.summary.total_net_change}\n\n`;
        }
        softDrinksReport.data?.forEach((week, index) => {
          content += `Week ${index + 1} (${week.week_start?.substring(0, 10)} to ${week.week_end?.substring(0, 10)})\n  In: ${week.total_stock_in}, Out: ${week.total_stock_out}, Net: ${week.total_net_change}\n\n`;
        });
      }

      await Share.share({
        message: content,
        title: `${getReportLabel(selectedReport)} - ${timestamp}`,
      });
      showToast('success', 'Success', 'Report shared successfully');
    } catch (error) {
      console.error('Export PDF error:', error);
      showToast('error', 'Error', 'Failed to export report');
    }
  };

  const handleExportExcel = async () => {
    // Share as CSV which can be opened in Excel
    try {
      let csv = '';
      if (selectedReport === 'stock') {
        csv = generateStockCSV();
      } else if (selectedReport === 'movements') {
        csv = generateMovementsCSV();
      } else if (selectedReport === 'softdrinks') {
        csv = generateSoftDrinksCSV();
      }

      await Share.share({
        message: csv,
        title: `${getReportLabel(selectedReport)}.csv`,
      });
      showToast('success', 'Success', 'Excel data exported - open in spreadsheet app');
    } catch (error) {
      console.error('Export Excel error:', error);
      showToast('error', 'Error', 'Failed to export Excel data');
    }
  };

  const handleExportCSV = async () => {
    try {
      let csv = '';
      if (selectedReport === 'stock') {
        csv = generateStockCSV();
      } else if (selectedReport === 'movements') {
        csv = generateMovementsCSV();
      } else if (selectedReport === 'softdrinks') {
        csv = generateSoftDrinksCSV();
      }

      await Share.share({
        message: csv,
        title: `${getReportLabel(selectedReport)}.csv`,
      });
      showToast('success', 'Success', 'CSV exported successfully');
    } catch (error) {
      console.error('Export CSV error:', error);
      showToast('error', 'Error', 'Failed to export CSV');
    }
  };

  // Render Report Type Dropdown
  const renderReportTypeDropdown = () => (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setShowReportDropdown(true)}
      >
        <Icon name={getReportIcon(selectedReport)} size={20} color={designColors.textPrimary} />
        <Text style={styles.dropdownButtonText}>{getReportLabel(selectedReport)}</Text>
        <Icon name="arrow-drop-down" size={24} color={designColors.textPrimary} />
      </TouchableOpacity>

      <Modal
        visible={showReportDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportDropdown(false)}
        >
          <View style={styles.dropdownMenu}>
            {(['stock', 'movements', 'softdrinks'] as ReportType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dropdownMenuItem,
                  selectedReport === type && styles.dropdownMenuItemSelected,
                ]}
                onPress={() => {
                  setSelectedReport(type);
                  setShowReportDropdown(false);
                }}
              >
                <Icon name={getReportIcon(type)} size={20} color={designColors.textPrimary} />
                <Text style={styles.dropdownMenuItemText}>{getReportLabel(type)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  // Render Filters Section
  const renderFiltersSection = () => {
    if (selectedReport !== 'movements' && selectedReport !== 'softdrinks') return null;

    return (
      <View style={styles.filtersCard}>
        {selectedReport === 'movements' && (
          <View>
            <Text style={styles.filterLabel}>Filter by Month</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowMonthDropdown(true)}
            >
              <Icon name="calendar-today" size={18} color={designColors.textSecondary} />
              <Text style={styles.filterButtonText}>{formatMonth(selectedMonth)}</Text>
              <Icon name="arrow-drop-down" size={24} color={designColors.textSecondary} />
            </TouchableOpacity>

            <Modal
              visible={showMonthDropdown}
              transparent
              animationType="fade"
              onRequestClose={() => setShowMonthDropdown(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowMonthDropdown(false)}
              >
                <View style={styles.dropdownMenu}>
                  <ScrollView style={{ maxHeight: 300 }}>
                    {monthOptions.map((date, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.dropdownMenuItem,
                          formatMonth(selectedMonth) === formatMonth(date) && styles.dropdownMenuItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedMonth(date);
                          setShowMonthDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownMenuItemText}>{formatMonth(date)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        )}

        {selectedReport === 'softdrinks' && (
          <View>
            <Text style={styles.filterLabel}>Time Period</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowWeeksDropdown(true)}
            >
              <Icon name="date-range" size={18} color={designColors.textSecondary} />
              <Text style={styles.filterButtonText}>{selectedWeeks} weeks</Text>
              <Icon name="arrow-drop-down" size={24} color={designColors.textSecondary} />
            </TouchableOpacity>

            <Modal
              visible={showWeeksDropdown}
              transparent
              animationType="fade"
              onRequestClose={() => setShowWeeksDropdown(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowWeeksDropdown(false)}
              >
                <View style={styles.dropdownMenu}>
                  {[2, 4, 8, 12].map((weeks) => (
                    <TouchableOpacity
                      key={weeks}
                      style={[
                        styles.dropdownMenuItem,
                        selectedWeeks === weeks && styles.dropdownMenuItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedWeeks(weeks);
                        setShowWeeksDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownMenuItemText}>{weeks} weeks</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        )}
      </View>
    );
  };

  // Render Export Buttons
  const renderExportButtons = () => (
    <View style={styles.exportButtonsRow}>
      <TouchableOpacity style={[styles.exportButton, { backgroundColor: designColors.primaryRed }]} onPress={handleExportPDF}>
        <Icon name="picture-as-pdf" size={16} color="#FFFFFF" />
        <Text style={styles.exportButtonText}>PDF</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.exportButton, { backgroundColor: designColors.successGreen }]} onPress={handleExportExcel}>
        <Icon name="table-chart" size={16} color="#FFFFFF" />
        <Text style={styles.exportButtonText}>Excel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.exportButton, { backgroundColor: designColors.blueAccent }]} onPress={handleExportCSV}>
        <Icon name="description" size={16} color="#FFFFFF" />
        <Text style={styles.exportButtonText}>CSV</Text>
      </TouchableOpacity>
    </View>
  );

  // Render Stock Report Content
  const renderStockReport = () => {
    if (isLoadingStock && !stockLoaded) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={designColors.primaryRed} />
        </View>
      );
    }

    if (stockReport.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="inventory" size={48} color={designColors.textSecondary} />
          <Text style={styles.emptyText}>No stock data found</Text>
        </View>
      );
    }

    return (
      <View>
        {stockReport.map((item, index) => (
          <View key={item.id || index} style={styles.reportCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusBadgeText}>
                  {(item.status || 'normal').charAt(0).toUpperCase() + (item.status || 'normal').slice(1)}
                </Text>
              </View>
            </View>
            
            <View style={styles.cardDivider} />
            
            <View style={styles.cardDetailsRow}>
              <View>
                <Text style={styles.cardDetailLabel}>Category</Text>
                <Text style={styles.cardDetailValue}>
                  {(item.category || '').replace('_', ' ').charAt(0).toUpperCase() + (item.category || '').replace('_', ' ').slice(1)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardDetailLabel}>Current Stock</Text>
                <Text style={[styles.cardDetailValue, { fontWeight: 'bold' }]}>{item.current_quantity}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Render Movements Report Content
  const renderMovementsReport = () => {
    if (isLoadingMovements && !movementsLoaded) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={designColors.primaryRed} />
        </View>
      );
    }

    if (filteredMovements.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="swap-vert" size={48} color={designColors.textSecondary} />
          <Text style={styles.emptyText}>No movement data for {formatMonth(selectedMonth)}</Text>
        </View>
      );
    }

    return (
      <View>
        {/* Summary Badges */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBadge, { backgroundColor: designColors.successGreen }]}>
            <Text style={styles.summaryBadgeText}>Total In: {totalStockIn}</Text>
          </View>
          <View style={[styles.summaryBadge, { backgroundColor: designColors.dangerRed }]}>
            <Text style={styles.summaryBadgeText}>Total Out: {totalStockOut}</Text>
          </View>
        </View>

        {filteredMovements.map((movement, index) => (
          <View key={movement.id || index} style={styles.reportCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{movement.item_name}</Text>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: movement.movement_type === 'in' ? designColors.successGreen : designColors.dangerRed }
              ]}>
                <Text style={styles.statusBadgeText}>
                  {movement.movement_type === 'in' ? 'Stock In' : 'Stock Out'}
                </Text>
              </View>
            </View>
            
            <View style={styles.cardDivider} />
            
            <View style={styles.cardDetailsRow}>
              <View>
                <Text style={styles.cardDetailLabel}>Date</Text>
                <Text style={styles.cardDetailValue}>{formatDate(movement.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardDetailLabel}>Quantity</Text>
                <Text style={[styles.cardDetailValue, { fontWeight: 'bold' }]}>{movement.quantity}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // Render Soft Drinks Report Content
  const renderSoftDrinksReport = () => {
    if (isLoadingSoftDrinks) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={designColors.primaryRed} />
        </View>
      );
    }

    if (!softDrinksReport || !softDrinksReport.data || softDrinksReport.data.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="local-drink" size={48} color={designColors.textSecondary} />
          <Text style={styles.emptyText}>No soft drinks data available</Text>
        </View>
      );
    }

    return (
      <View>
        {/* Summary Card */}
        {softDrinksReport.summary && (
          <View style={[styles.reportCard, { backgroundColor: designColors.primaryRed + '20' }]}>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Summary ({selectedWeeks} weeks)</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryGridItem}>
                <Text style={styles.cardDetailLabel}>Total In</Text>
                <Text style={[styles.summaryGridValue, { color: designColors.successGreen }]}>
                  {softDrinksReport.summary.total_stock_in}
                </Text>
              </View>
              <View style={styles.summaryGridItem}>
                <Text style={styles.cardDetailLabel}>Total Out</Text>
                <Text style={[styles.summaryGridValue, { color: designColors.dangerRed }]}>
                  {softDrinksReport.summary.total_stock_out}
                </Text>
              </View>
              <View style={styles.summaryGridItem}>
                <Text style={styles.cardDetailLabel}>Net Change</Text>
                <Text style={[
                  styles.summaryGridValue, 
                  { color: softDrinksReport.summary.total_net_change >= 0 ? designColors.successGreen : designColors.dangerRed }
                ]}>
                  {softDrinksReport.summary.total_net_change}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Weekly Data */}
        {softDrinksReport.data.map((week, index) => (
          <View key={index} style={styles.reportCard}>
            <Text style={styles.cardTitle}>Week {index + 1}</Text>
            <Text style={styles.weekDateRange}>
              {week.week_start?.substring(0, 10)} to {week.week_end?.substring(0, 10)}
            </Text>

            <View style={styles.weekSummaryRow}>
              <Text style={[styles.weekSummaryText, { color: designColors.successGreen }]}>
                In: {week.total_stock_in}
              </Text>
              <Text style={[styles.weekSummaryText, { color: designColors.dangerRed }]}>
                Out: {week.total_stock_out}
              </Text>
              <Text style={styles.weekSummaryText}>Net: {week.total_net_change}</Text>
              <Text style={[styles.weekSummaryText, { fontWeight: 'bold' }]}>
                Trend: {(week.overall_trend || '').toUpperCase()}
              </Text>
            </View>

            {week.items && week.items.length > 0 && (
              <>
                <View style={styles.cardDivider} />
                {week.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.weekItemRow}>
                    <Text style={styles.weekItemName} numberOfLines={1}>{item.item_name}</Text>
                    <Text style={[styles.weekItemStat, { color: designColors.successGreen }]}>
                      In: {item.stock_in}
                    </Text>
                    <Text style={[styles.weekItemStat, { color: designColors.dangerRed }]}>
                      Out: {item.stock_out}
                    </Text>
                    <Text style={[styles.weekItemTrend, { fontWeight: 'bold' }]}>
                      {(item.trend || '').toUpperCase()}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        ))}
      </View>
    );
  };

  // Render Report Content based on selection
  const renderReportContent = () => {
    switch (selectedReport) {
      case 'stock':
        return renderStockReport();
      case 'movements':
        return renderMovementsReport();
      case 'softdrinks':
        return renderSoftDrinksReport();
    }
  };

  // Get report title
  const getReportTitle = () => {
    switch (selectedReport) {
      case 'stock': return 'Current Stock Levels';
      case 'movements': return 'Stock Movement History';
      case 'softdrinks': return 'Soft Drinks Weekly Comparison';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={designColors.primaryRed} />
        }
      >
        {/* Header */}
        <Text style={styles.headerTitle}>Reports</Text>

        {/* Report Type Dropdown */}
        {renderReportTypeDropdown()}

        {/* Filters Section */}
        {renderFiltersSection()}

        {/* Report Content Card */}
        <View style={styles.reportContentCard}>
          <Text style={styles.reportContentTitle}>{getReportTitle()}</Text>
          
          {/* Export Buttons */}
          {renderExportButtons()}

          {/* Report Content */}
          <View style={styles.reportContentBody}>
            {renderReportContent()}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designColors.backgroundDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },

  // Dropdown
  dropdownContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColors.surfaceDark,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: designColors.borderLight,
    gap: 8,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: 14,
    color: designColors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  dropdownMenu: {
    backgroundColor: designColors.surfaceDark,
    borderRadius: 8,
    width: '100%',
    maxWidth: 350,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dropdownMenuItemSelected: {
    backgroundColor: designColors.primaryRed + '30',
  },
  dropdownMenuItemText: {
    fontSize: 14,
    color: designColors.textPrimary,
  },

  // Filters
  filtersCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: designColors.surfaceDark,
    borderRadius: 8,
    padding: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: designColors.borderLight,
    gap: 8,
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    color: designColors.textPrimary,
  },

  // Export Buttons
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // Report Content Card
  reportContentCard: {
    marginHorizontal: 16,
    backgroundColor: designColors.surfaceDark,
    borderRadius: 12,
    padding: 16,
  },
  reportContentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 12,
  },
  reportContentBody: {
    minHeight: 200,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: designColors.textSecondary,
    textAlign: 'center',
  },

  // Report Cards
  reportCard: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardDivider: {
    height: 1,
    backgroundColor: designColors.borderLight,
    marginVertical: 8,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardDetailLabel: {
    fontSize: 11,
    color: designColors.textSecondary,
    marginBottom: 2,
  },
  cardDetailValue: {
    fontSize: 14,
    color: designColors.textPrimary,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryBadge: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryGridItem: {
    alignItems: 'center',
  },
  summaryGridValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginTop: 4,
  },

  // Week Data
  weekDateRange: {
    fontSize: 12,
    color: designColors.textSecondary,
    marginBottom: 8,
  },
  weekSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekSummaryText: {
    fontSize: 12,
    color: designColors.textSecondary,
  },
  weekItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekItemName: {
    flex: 2,
    fontSize: 12,
    color: designColors.textPrimary,
  },
  weekItemStat: {
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  weekItemTrend: {
    width: 50,
    fontSize: 10,
    color: designColors.textPrimary,
    textAlign: 'right',
  },
});

export default ReportsScreen;
