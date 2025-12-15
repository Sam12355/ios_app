import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    GestureHandlerRootView,
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
    PinchGestureHandler,
    PinchGestureHandlerGestureEvent,
    State,
} from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { StockItem, StockReceipt } from '../../models';
import { DrawerParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

type NavigationProp = DrawerNavigationProp<DrawerParamList>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Static design colors for StyleSheet (dynamic colors applied inline)
const staticDesignColors = {
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardDark: '#252525',
  documentViewerBg: '#1F1F1F',
  primaryRed: '#E6002A',
  successGreen: '#00C851',
  warningOrange: '#FF8800',
  dangerRed: '#EF4444',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  blueAccent: '#3B82F6',
};

const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({ type, text1, text2, position: 'bottom', visibilityTime: 3000 });
};

const StockInScreen = () => {
  const { colors, designColors, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuthStore();

  // Stock data
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Search states
  const [generalSearchTerm, setGeneralSearchTerm] = useState('');
  const [showGeneralSearch, setShowGeneralSearch] = useState(false);
  const [categorySearchTerms, setCategorySearchTerms] = useState<Record<string, string>>({});
  const [showCategorySearch, setShowCategorySearch] = useState<Record<string, boolean>>({});
  
  // Filter
  const [filterType, setFilterType] = useState<'all' | 'low' | 'critical'>('all');
  
  // Quick action
  const [quickActionItem, setQuickActionItem] = useState<StockItem | null>(null);
  const [quickQuantity, setQuickQuantity] = useState('');
  const [quickUnitType, setQuickUnitType] = useState<'base' | 'packaging'>('base');
  const [isQuickActionLoading, setIsQuickActionLoading] = useState(false);
  
  // Receipts
  const [showItemReceipts, setShowItemReceipts] = useState(false);
  const [itemReceipts, setItemReceipts] = useState<StockReceipt[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  
  // View receipt dialog (popup modal with zoom controls)
  const [viewDialogReceipt, setViewDialogReceipt] = useState<StockReceipt | null>(null);
  const [viewDialogZoom, setViewDialogZoom] = useState(100);
  const [viewDialogOffset, setViewDialogOffset] = useState({ x: 0, y: 0 });
  
  // Full screen receipt (split-screen view)
  const [fullScreenReceipt, setFullScreenReceipt] = useState<StockReceipt | null>(null);
  const [documentZoom, setDocumentZoom] = useState(100);
  const [documentOffset, setDocumentOffset] = useState({ x: 0, y: 0 });
  
  // Loading states for approve/reject
  const [approvingReceiptId, setApprovingReceiptId] = useState<string | null>(null);
  const [rejectingReceiptId, setRejectingReceiptId] = useState<string | null>(null);
  
  // Animated values for pinch-zoom
  const viewDialogScale = useRef(new Animated.Value(1)).current;
  const viewDialogTranslateX = useRef(new Animated.Value(0)).current;
  const viewDialogTranslateY = useRef(new Animated.Value(0)).current;
  const documentScale = useRef(new Animated.Value(1)).current;
  const documentTranslateX = useRef(new Animated.Value(0)).current;
  const documentTranslateY = useRef(new Animated.Value(0)).current;
  
  // Base values for gesture tracking
  const viewDialogBaseScale = useRef(1);
  const viewDialogBaseTranslateX = useRef(0);
  const viewDialogBaseTranslateY = useRef(0);
  const documentBaseScale = useRef(1);
  const documentBaseTranslateX = useRef(0);
  const documentBaseTranslateY = useRef(0);

  // Approve/Reject receipt handlers
  const handleApproveReceipt = async (receipt: StockReceipt) => {
    setApprovingReceiptId(receipt.id);
    try {
      await apiClient.updateReceiptStatus(receipt.id, 'approved');
      showToast('success', 'Success', `Receipt from ${getSupplierName(receipt)} approved`);
      loadReceipts(); // Refresh the list
    } catch (error) {
      console.error('Approve error:', error);
      showToast('error', 'Error', 'Failed to approve receipt');
    } finally {
      setApprovingReceiptId(null);
    }
  };

  const handleRejectReceipt = async (receipt: StockReceipt) => {
    setRejectingReceiptId(receipt.id);
    try {
      await apiClient.updateReceiptStatus(receipt.id, 'rejected');
      showToast('success', 'Success', `Receipt from ${getSupplierName(receipt)} rejected`);
      loadReceipts(); // Refresh the list
    } catch (error) {
      console.error('Reject error:', error);
      showToast('error', 'Error', 'Failed to reject receipt');
    } finally {
      setRejectingReceiptId(null);
    }
  };

  // Load stock data
  const loadStockData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    try {
      const data = await apiClient.getStockData();
      setStockItems(data);
    } catch (error) {
      console.log('Load stock error:', error);
      showToast('error', 'Error', 'Failed to load stock data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load receipts
  const loadReceipts = useCallback(async () => {
    setIsLoadingReceipts(true);
    try {
      const data = await apiClient.getReceipts();
      setItemReceipts(data);
    } catch (error) {
      console.log('Load receipts error:', error);
      showToast('error', 'Error', 'Failed to load receipts');
    } finally {
      setIsLoadingReceipts(false);
    }
  }, []);

  useEffect(() => {
    loadStockData();
  }, [loadStockData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStockData(true);
  };

  const toggleReceipts = () => {
    if (!showItemReceipts && itemReceipts.length === 0) {
      loadReceipts();
    }
    setShowItemReceipts(!showItemReceipts);
  };

  // Filter and group items
  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      // General search
      const matchesGeneralSearch = generalSearchTerm === '' ||
        item.items?.name?.toLowerCase().includes(generalSearchTerm.toLowerCase()) ||
        item.items?.category?.toLowerCase().includes(generalSearchTerm.toLowerCase());
      
      // Category search
      const category = item.items?.category || 'Uncategorized';
      const categorySearch = categorySearchTerms[category] || '';
      const matchesCategorySearch = categorySearch === '' ||
        item.items?.name?.toLowerCase().includes(categorySearch.toLowerCase());
      
      // Filter by stock level
      const lowLevel = item.items?.low_level || item.items?.threshold_level || 0;
      const criticalLevel = item.items?.critical_level || Math.floor((item.items?.threshold_level || 0) / 2);
      
      let matchesFilter = true;
      if (filterType === 'low') {
        matchesFilter = item.current_quantity <= lowLevel;
      } else if (filterType === 'critical') {
        matchesFilter = item.current_quantity <= criticalLevel;
      }
      
      return matchesGeneralSearch && matchesCategorySearch && matchesFilter;
    });
  }, [stockItems, generalSearchTerm, categorySearchTerms, filterType]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, StockItem[]> = {};
    filteredItems.forEach((item) => {
      const category = item.items?.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Stats
  const stats = useMemo(() => {
    let totalItems = stockItems.length;
    let lowStockCount = 0;
    let criticalStockCount = 0;
    
    stockItems.forEach((item) => {
      const lowLevel = item.items?.low_level || item.items?.threshold_level || 0;
      const criticalLevel = item.items?.critical_level || Math.floor((item.items?.threshold_level || 0) / 2);
      
      if (item.current_quantity <= criticalLevel) {
        criticalStockCount++;
      } else if (item.current_quantity <= lowLevel) {
        lowStockCount++;
      }
    });
    
    return { totalItems, lowStockCount, criticalStockCount };
  }, [stockItems]);

  // Quick add stock
  const handleQuickAdd = async () => {
    if (!quickActionItem) return;
    
    const qty = parseInt(quickQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Invalid Quantity', 'Please enter a valid quantity');
      return;
    }
    
    setIsQuickActionLoading(true);
    
    try {
      const unitsPerPackage = quickActionItem.items?.units_per_package || 1;
      const qtyInBase = quickUnitType === 'packaging' && unitsPerPackage > 0
        ? qty * unitsPerPackage
        : qty;
      
      await apiClient.updateStockQuantity(
        quickActionItem.item_id,
        'in',
        qtyInBase,
        undefined,
        quickUnitType,
        qty
      );
      
      showToast('success', 'Success', 'Stock added successfully');
      setQuickActionItem(null);
      setQuickQuantity('');
      setQuickUnitType('base');
      loadStockData(true);
    } catch (error: any) {
      console.log('Quick add error:', error);
      showToast('error', 'Error', error.message || 'Failed to add stock');
    } finally {
      setIsQuickActionLoading(false);
    }
  };

  const handleQuickCancel = () => {
    setQuickActionItem(null);
    setQuickQuantity('');
    setQuickUnitType('base');
  };

  const getStockStatus = (item: StockItem) => {
    const lowLevel = item.items?.low_level || item.items?.threshold_level || 0;
    const criticalLevel = item.items?.critical_level || Math.floor((item.items?.threshold_level || 0) / 2);
    
    if (item.current_quantity <= criticalLevel) {
      return { color: designColors.dangerRed, label: 'Critical' };
    }
    if (item.current_quantity <= lowLevel) {
      return { color: designColors.warningOrange, label: 'Low Stock' };
    }
    return { color: designColors.successGreen, label: 'In Stock' };
  };

  const getReceiptImageUrl = (receipt: StockReceipt) => {
    // Try receipt_file_name first (Kotlin app format), then fall back to file_url
    const fileName = receipt.receipt_file_name || receipt.file_url || '';
    
    if (fileName.startsWith('http') && !fileName.startsWith('blob:')) {
      return fileName;
    }
    
    // If we have receipt_file_path, use that
    if (receipt.receipt_file_path) {
      const filename = receipt.receipt_file_path.split('/').pop() || '';
      return `https://stock-nexus-84-main-2-1.onrender.com/uploads/receipts/${filename}`;
    }
    
    // Extract filename and build URL
    const filename = fileName.split('/').pop() || fileName;
    return `https://stock-nexus-84-main-2-1.onrender.com/uploads/receipts/${filename}`;
  };
  
  // Get supplier name with fallbacks
  const getSupplierName = (receipt: StockReceipt) => {
    return receipt.supplier_name || receipt.supplier || 'Unknown Supplier';
  };
  
  // Get submitted by name with fallbacks
  const getSubmittedByName = (receipt: StockReceipt) => {
    return receipt.submitted_by_name || receipt.profiles?.name || 'Unknown';
  };
  
  // Get receipt file name
  const getReceiptFileName = (receipt: StockReceipt) => {
    return receipt.receipt_file_name || receipt.file_url?.split('/').pop() || 'receipt.jpg';
  };

  // Render summary card
  const renderSummaryCard = (
    title: string,
    value: number,
    iconName: string,
    color: string,
    filterKey: 'all' | 'low' | 'critical'
  ) => (
    <TouchableOpacity
      style={[
        styles.summaryCard,
        { backgroundColor: designColors.cardBackground },
        filterType === filterKey && filterKey !== 'all' && { borderColor: color, borderWidth: 2 },
        !isDark && { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 }
      ]}
      onPress={() => setFilterType(filterType === filterKey ? 'all' : filterKey)}
    >
      <View style={styles.summaryCardRow}>
        <Icon name={iconName} size={20} color={color} />
        <Text style={[styles.summaryCardValue, { color }]}>{value}</Text>
      </View>
      <Text style={[styles.summaryCardTitle, { color: designColors.textSecondary }]}>{title}</Text>
    </TouchableOpacity>
  );

  // Render receipt card
  const renderReceiptCard = (receipt: StockReceipt) => {
    const isExpanded = expandedReceiptId === receipt.id;
    const statusColor = receipt.status === 'approved' 
      ? designColors.successGreen 
      : receipt.status === 'rejected'
        ? designColors.dangerRed
        : designColors.warningOrange;
    
    const statusIcon = receipt.status === 'approved'
      ? 'check-circle'
      : receipt.status === 'rejected'
        ? 'cancel'
        : 'schedule';

    return (
      <View key={receipt.id} style={[styles.receiptCard, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight }, !isDark && { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }]}>
        {/* Header */}
        <TouchableOpacity
          style={styles.receiptHeader}
          onPress={() => setExpandedReceiptId(isExpanded ? null : receipt.id)}
        >
          <View style={styles.receiptHeaderLeft}>
            <Icon name={statusIcon} size={20} color={statusColor} />
            <View style={styles.receiptHeaderInfo}>
              <Text style={[styles.receiptSupplier, { color: designColors.textPrimary }]}>{getSupplierName(receipt)}</Text>
              <Text style={[styles.receiptSubmittedBy, { color: designColors.textSecondary }]}>
                Submitted by {getSubmittedByName(receipt)}
              </Text>
            </View>
          </View>
          <View style={styles.receiptHeaderRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusBadgeText}>
                {(receipt.status || 'pending').charAt(0).toUpperCase() + (receipt.status || 'pending').slice(1)}
              </Text>
            </View>
            <Icon 
              name={isExpanded ? 'expand-less' : 'expand-more'} 
              size={24} 
              color={designColors.textPrimary} 
            />
          </View>
        </TouchableOpacity>
        
        {/* Expanded Content */}
        {isExpanded && (
          <View style={styles.receiptContent}>
            {/* Receipt File */}
            <View style={styles.receiptSection}>
              <Text style={[styles.receiptSectionLabel, { color: designColors.textPrimary }]}>Receipt File</Text>
              <View style={styles.receiptFileRow}>
                <Icon name="description" size={16} color={designColors.textSecondary} />
                <Text style={[styles.receiptFileName, { color: designColors.textSecondary }]} numberOfLines={1}>
                  {getReceiptFileName(receipt)}
                </Text>
              </View>
              <View style={styles.receiptActions}>
                <TouchableOpacity
                  style={[styles.receiptActionButton, { backgroundColor: designColors.surfaceVariant }]}
                  onPress={() => {
                    setViewDialogZoom(100);
                    viewDialogScale.setValue(1);
                    viewDialogTranslateX.setValue(0);
                    viewDialogTranslateY.setValue(0);
                    viewDialogBaseScale.current = 1;
                    viewDialogBaseTranslateX.current = 0;
                    viewDialogBaseTranslateY.current = 0;
                    setViewDialogReceipt(receipt);
                  }}
                >
                  <Icon name="visibility" size={20} color={designColors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.receiptActionButton, { backgroundColor: designColors.surfaceVariant }]}
                  onPress={() => {
                    const url = getReceiptImageUrl(receipt);
                    Linking.openURL(url);
                  }}
                >
                  <Icon name="download" size={20} color={designColors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.receiptActionButton, { backgroundColor: designColors.primaryRed + '20' }]}
                  onPress={() => {
                    setDocumentZoom(100);
                    documentScale.setValue(1);
                    documentTranslateX.setValue(0);
                    documentTranslateY.setValue(0);
                    documentBaseScale.current = 1;
                    documentBaseTranslateX.current = 0;
                    documentBaseTranslateY.current = 0;
                    setFullScreenReceipt(receipt);
                  }}
                >
                  <Icon name="fullscreen" size={20} color={designColors.primaryRed} />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Remarks */}
            <View style={styles.receiptSection}>
              <Text style={styles.receiptSectionLabel}>Remarks</Text>
              <Text style={styles.receiptRemarks}>
                {receipt.remarks || 'No remarks provided'}
              </Text>
            </View>
            
            {/* Approve/Reject buttons for pending */}
            {receipt.status === 'pending' && (
              <View style={styles.receiptButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.receiptButton, 
                    { backgroundColor: designColors.successGreen },
                    approvingReceiptId === receipt.id && { opacity: 0.7 }
                  ]}
                  onPress={() => handleApproveReceipt(receipt)}
                  disabled={approvingReceiptId === receipt.id || rejectingReceiptId === receipt.id}
                >
                  {approvingReceiptId === receipt.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Icon name="check-circle" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.receiptButtonText}>
                    {approvingReceiptId === receipt.id ? 'Approving...' : 'Approve'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.receiptButton, 
                    { backgroundColor: designColors.dangerRed },
                    rejectingReceiptId === receipt.id && { opacity: 0.7 }
                  ]}
                  onPress={() => handleRejectReceipt(receipt)}
                  disabled={approvingReceiptId === receipt.id || rejectingReceiptId === receipt.id}
                >
                  {rejectingReceiptId === receipt.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Icon name="cancel" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.receiptButtonText}>
                    {rejectingReceiptId === receipt.id ? 'Rejecting...' : 'Reject'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Render stock item card
  const renderStockItemCard = (item: StockItem) => {
    const status = getStockStatus(item);
    const isQuickAction = quickActionItem?.id === item.id;
    const hasPackaging = item.items?.enable_packaging && (item.items?.units_per_package || 0) > 0;
    
    return (
      <View key={item.id} style={[styles.stockItemCard, { backgroundColor: designColors.cardBackground, ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }) }]}>
        <View style={styles.stockItemRow}>
          {/* Image */}
          {item.items?.image_url ? (
            <Image source={{ uri: item.items.image_url }} style={styles.stockItemImage} />
          ) : (
            <View style={styles.stockItemImagePlaceholder}>
              <Icon name="inventory" size={24} color={designColors.textSecondary} />
            </View>
          )}
          
          {/* Details */}
          <View style={styles.stockItemDetails}>
            <Text style={[styles.stockItemName, { color: designColors.textPrimary }]} numberOfLines={1}>
              {item.items?.name || 'Unknown Item'}
            </Text>
            <Text style={[styles.stockItemCategory, { color: designColors.textSecondary }]}>
              {item.items?.category || 'Uncategorized'}
            </Text>
          </View>
          
          {/* Quantity and Status */}
          <View style={styles.stockItemRight}>
            <Text style={[styles.stockItemQty, { color: designColors.textPrimary }]}>
              Qty: {item.current_quantity} {item.items?.base_unit || 'piece'}{item.current_quantity !== 1 ? 's' : ''}
            </Text>
            <Text style={[styles.stockItemThreshold, { color: designColors.textSecondary }]}>
              Threshold: {item.items?.threshold_level || 0} {item.items?.base_unit || 'piece'}{(item.items?.threshold_level || 0) !== 1 ? 's' : ''}
            </Text>
            <View style={[styles.stockStatusBadge, { backgroundColor: status.color + '33' }]}>
              <Text style={[styles.stockStatusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>
        </View>
        
        {/* Quick Action Form */}
        {isQuickAction ? (
          <View style={styles.quickActionForm}>
            {/* Unit Selection */}
            {hasPackaging && (
              <View style={styles.unitSelectionRow}>
                <Text style={[styles.unitLabel, { color: designColors.textPrimary }]}>Unit:</Text>
                <View style={styles.unitChips}>
                  <TouchableOpacity
                    style={[
                      styles.unitChip,
                      { borderColor: designColors.borderLight },
                      quickUnitType === 'base' && styles.unitChipSelected
                    ]}
                    onPress={() => setQuickUnitType('base')}
                  >
                    <Text style={[
                      styles.unitChipText,
                      { color: quickUnitType === 'base' ? '#FFFFFF' : designColors.textSecondary },
                      quickUnitType === 'base' && styles.unitChipTextSelected
                    ]}>
                      {item.items?.base_unit || 'piece'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.unitChip,
                      { borderColor: designColors.borderLight },
                      quickUnitType === 'packaging' && styles.unitChipSelected
                    ]}
                    onPress={() => setQuickUnitType('packaging')}
                  >
                    <Text style={[
                      styles.unitChipText,
                      { color: quickUnitType === 'packaging' ? '#FFFFFF' : designColors.textSecondary },
                      quickUnitType === 'packaging' && styles.unitChipTextSelected
                    ]}>
                      {item.items?.packaging_unit || 'carton'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Quantity and Actions */}
            <View style={styles.quickActionRow}>
              <TextInput
                style={[styles.quickQuantityInput, { backgroundColor: designColors.surfaceVariant, color: designColors.textPrimary }]}
                placeholder="Qty"
                placeholderTextColor={designColors.textSecondary}
                value={quickQuantity}
                onChangeText={setQuickQuantity}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[
                  styles.quickAddButton,
                  (!quickQuantity || isQuickActionLoading) && styles.quickAddButtonDisabled
                ]}
                onPress={handleQuickAdd}
                disabled={!quickQuantity || isQuickActionLoading}
              >
                {isQuickActionLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.quickAddButtonText}>Add Stock</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickCancelButton}
                onPress={handleQuickCancel}
                disabled={isQuickActionLoading}
              >
                <Icon name="close" size={24} color={designColors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.plusButtonRow}>
            <TouchableOpacity
              style={styles.plusButton}
              onPress={() => {
                setQuickActionItem(item);
                setQuickQuantity('');
                setQuickUnitType('base');
              }}
            >
              <Icon name="add" size={20} color={designColors.successGreen} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: designColors.background }]}>
        <ActivityIndicator size="large" color={designColors.primaryRed} />
        <Text style={[styles.loadingText, { color: designColors.textSecondary }]}>Loading inventory...</Text>
      </View>
    );
  }

  // Full Screen Receipt View (Split-Screen: Document on top, Stock list on bottom)
  if (fullScreenReceipt) {
    return (
      <View style={styles.container}>
        {/* Top Section: Document Viewer (50% of screen) */}
        <View style={[styles.documentViewerContainer, { backgroundColor: designColors.surfaceVariant }]}>
          {/* Document Header */}
          <View style={[styles.documentHeader, { borderBottomColor: designColors.borderLight }]}>
            <View style={styles.documentHeaderLeft}>
              <TouchableOpacity 
                onPress={() => setFullScreenReceipt(null)}
                style={[styles.documentCloseButton, { backgroundColor: designColors.cardBackground }]}
              >
                <Icon name="close" size={24} color={designColors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.documentHeaderInfo}>
                <Text style={[styles.documentSupplierName, { color: designColors.textPrimary }]} numberOfLines={1}>
                  {getSupplierName(fullScreenReceipt)}
                </Text>
                <Text style={[styles.documentFileName, { color: designColors.textSecondary }]} numberOfLines={1}>
                  {getReceiptFileName(fullScreenReceipt)}
                </Text>
              </View>
            </View>
            
            {/* Zoom Controls */}
            <View style={styles.zoomControls}>
              <TouchableOpacity
                onPress={() => {
                  const newZoom = Math.max(50, documentZoom - 50);
                  setDocumentZoom(newZoom);
                  documentScale.setValue(newZoom / 100);
                  documentBaseScale.current = newZoom / 100;
                }}
                style={[styles.zoomButton, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight }]}
              >
                <Icon name="remove" size={20} color={designColors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.zoomText, { color: designColors.textPrimary }]}>{documentZoom}%</Text>
              <TouchableOpacity
                onPress={() => {
                  const newZoom = Math.min(1000, documentZoom + 50);
                  setDocumentZoom(newZoom);
                  documentScale.setValue(newZoom / 100);
                  documentBaseScale.current = newZoom / 100;
                }}
                style={[styles.zoomButton, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight }]}
              >
                <Icon name="add" size={20} color={designColors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.documentDivider} />
          
          {/* Document Image with Pinch Zoom and Pan */}
          <GestureHandlerRootView style={styles.documentImageScroll}>
            <PanGestureHandler
              onGestureEvent={(event: PanGestureHandlerGestureEvent) => {
                documentTranslateX.setValue(documentBaseTranslateX.current + event.nativeEvent.translationX);
                documentTranslateY.setValue(documentBaseTranslateY.current + event.nativeEvent.translationY);
              }}
              onHandlerStateChange={(event) => {
                if (event.nativeEvent.oldState === State.ACTIVE) {
                  documentBaseTranslateX.current += event.nativeEvent.translationX;
                  documentBaseTranslateY.current += event.nativeEvent.translationY;
                  // Clamp values
                  documentBaseTranslateX.current = Math.max(-500, Math.min(500, documentBaseTranslateX.current));
                  documentBaseTranslateY.current = Math.max(-500, Math.min(500, documentBaseTranslateY.current));
                }
              }}
            >
              <Animated.View style={{ flex: 1 }}>
                <PinchGestureHandler
                  onGestureEvent={(event: PinchGestureHandlerGestureEvent) => {
                    const newScale = documentBaseScale.current * event.nativeEvent.scale;
                    documentScale.setValue(Math.max(0.5, Math.min(10, newScale)));
                    setDocumentZoom(Math.round(Math.max(0.5, Math.min(10, newScale)) * 100));
                  }}
                  onHandlerStateChange={(event) => {
                    if (event.nativeEvent.oldState === State.ACTIVE) {
                      documentBaseScale.current *= event.nativeEvent.scale;
                      documentBaseScale.current = Math.max(0.5, Math.min(10, documentBaseScale.current));
                    }
                  }}
                >
                  <Animated.View style={styles.documentImageContent}>
                    <Animated.Image
                      source={{ uri: getReceiptImageUrl(fullScreenReceipt) }}
                      style={[
                        styles.documentImage,
                        {
                          transform: [
                            { scale: documentScale },
                            { translateX: documentTranslateX },
                            { translateY: documentTranslateY },
                          ]
                        }
                      ]}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </PinchGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </GestureHandlerRootView>
        </View>
        
        <View style={[styles.documentDivider, { backgroundColor: designColors.primaryRed, height: 2 }]} />
        
        {/* Bottom Section: Stock List (50% of screen) */}
        <View style={[styles.bottomStockContainer, { backgroundColor: designColors.background }]}>
          {/* Current Stock Levels Header */}
          <View style={styles.stockLevelsHeader}>
            <Text style={[styles.stockLevelsTitle, { color: designColors.textPrimary }]}>Current Stock Levels</Text>
            {!showGeneralSearch && (
              <TouchableOpacity onPress={() => setShowGeneralSearch(true)}>
                <Icon name="search" size={24} color={designColors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* General Search */}
          {showGeneralSearch && (
            <View style={[styles.searchInputContainer, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight }]}>
              <Icon name="search" size={20} color={designColors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: designColors.textPrimary }]}
                placeholder="Search for items by name or category..."
                placeholderTextColor={designColors.textSecondary}
                value={generalSearchTerm}
                onChangeText={setGeneralSearchTerm}
              />
              <TouchableOpacity onPress={() => {
                setShowGeneralSearch(false);
                setGeneralSearchTerm('');
              }}>
                <Icon name="close" size={20} color={designColors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Stock Items List */}
          <ScrollView style={styles.bottomStockScroll}>
            {Object.entries(groupedItems).map(([category, items]) => (
              <View key={category} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={[styles.categoryTitle, { color: designColors.textPrimary }]}>{category}</Text>
                  {!showCategorySearch[category] && (
                    <TouchableOpacity
                      onPress={() => setShowCategorySearch({ ...showCategorySearch, [category]: true })}
                    >
                      <Icon name="search" size={18} color={designColors.textPrimary} />
                    </TouchableOpacity>
                  )}
                </View>
                
                {showCategorySearch[category] && (
                  <View style={[styles.categorySearchContainer, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight }]}>
                    <Icon name="search" size={18} color={designColors.textSecondary} />
                    <TextInput
                      style={[styles.categorySearchInput, { color: designColors.textPrimary }]}
                      placeholder={`Search in ${category}...`}
                      placeholderTextColor={designColors.textSecondary}
                      value={categorySearchTerms[category] || ''}
                      onChangeText={(text) => setCategorySearchTerms({ ...categorySearchTerms, [category]: text })}
                    />
                    <TouchableOpacity onPress={() => {
                      setShowCategorySearch({ ...showCategorySearch, [category]: false });
                      setCategorySearchTerms({ ...categorySearchTerms, [category]: '' });
                    }}>
                      <Icon name="close" size={18} color={designColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
                
                {items.map(renderStockItemCard)}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: designColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={designColors.primaryRed}
            colors={[designColors.primaryRed]}
          />
        }
      >
        {/* Header */}
        <Text style={[styles.headerTitle, { color: designColors.textPrimary }]}>Stock In</Text>
        
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          {renderSummaryCard('Total Items', stats.totalItems, 'inventory', designColors.blueAccent, 'all')}
          {renderSummaryCard('Low Stock', stats.lowStockCount, 'warning', designColors.warningOrange, 'low')}
          {renderSummaryCard('Critical', stats.criticalStockCount, 'error', designColors.dangerRed, 'critical')}
        </View>
        
        {/* Item Receipts Section */}
        <View style={[styles.receiptsSection, { backgroundColor: designColors.cardBackground }, !isDark && { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 }]}>
          <TouchableOpacity
            style={styles.receiptsSectionHeader}
            onPress={toggleReceipts}
            disabled={isLoadingReceipts}
          >
            <Text style={[styles.receiptsSectionTitle, { color: designColors.textPrimary }]}>Item Receipts</Text>
            {isLoadingReceipts ? (
              <ActivityIndicator size="small" color={designColors.textPrimary} />
            ) : (
              <Icon
                name={showItemReceipts ? 'expand-less' : 'expand-more'}
                size={24}
                color={designColors.textPrimary}
              />
            )}
          </TouchableOpacity>
          
          {showItemReceipts && (
            <View style={styles.receiptsContent}>
              {isLoadingReceipts ? (
                <ActivityIndicator size="large" color={designColors.primaryRed} style={{ padding: 20 }} />
              ) : itemReceipts.length === 0 ? (
                <Text style={styles.noReceiptsText}>No receipts found</Text>
              ) : (
                itemReceipts.slice(0, 10).map(renderReceiptCard)
              )}
              {itemReceipts.length > 10 && (
                <Text style={styles.moreReceiptsText}>
                  Showing 10 of {itemReceipts.length} receipts
                </Text>
              )}
            </View>
          )}
        </View>
        
        {/* Current Stock Levels Header */}
        <View style={styles.stockLevelsHeader}>
          <Text style={styles.stockLevelsTitle}>
            {filterType === 'low' ? 'Low Stock Items' : filterType === 'critical' ? 'Critical Stock Items' : 'Current Stock Levels'}
          </Text>
          {!showGeneralSearch && (
            <TouchableOpacity onPress={() => setShowGeneralSearch(true)}>
              <Icon name="search" size={24} color={designColors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* General Search */}
        {showGeneralSearch && (
          <View style={[styles.searchInputContainer, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight }]}>
            <Icon name="search" size={20} color={designColors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: designColors.textPrimary }]}
              placeholder="Search for items by name or category..."
              placeholderTextColor={designColors.textSecondary}
              value={generalSearchTerm}
              onChangeText={setGeneralSearchTerm}
            />
            <TouchableOpacity onPress={() => {
              setShowGeneralSearch(false);
              setGeneralSearchTerm('');
            }}>
              <Icon name="close" size={20} color={designColors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Stock Items by Category */}
        {Object.entries(groupedItems).map(([category, items]) => (
          <View key={category} style={styles.categorySection}>
            {/* Category Header */}
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {!showCategorySearch[category] && (
                <TouchableOpacity
                  onPress={() => setShowCategorySearch({ ...showCategorySearch, [category]: true })}
                >
                  <Icon name="search" size={18} color={designColors.textPrimary} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Category Search */}
            {showCategorySearch[category] && (
              <View style={[styles.categorySearchContainer, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight }]}>
                <Icon name="search" size={18} color={designColors.textSecondary} />
                <TextInput
                  style={[styles.categorySearchInput, { color: designColors.textPrimary }]}
                  placeholder={`Search in ${category}...`}
                  placeholderTextColor={designColors.textSecondary}
                  value={categorySearchTerms[category] || ''}
                  onChangeText={(text) => setCategorySearchTerms({ ...categorySearchTerms, [category]: text })}
                />
                <TouchableOpacity onPress={() => {
                  setShowCategorySearch({ ...showCategorySearch, [category]: false });
                  setCategorySearchTerms({ ...categorySearchTerms, [category]: '' });
                }}>
                  <Icon name="close" size={18} color={designColors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            
            {/* Items */}
            {items.map(renderStockItemCard)}
          </View>
        ))}
        
        {/* Empty State */}
        {Object.keys(groupedItems).length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="inventory-2" size={64} color={designColors.textSecondary} />
            <Text style={styles.emptyText}>
              {filterType !== 'all' ? `No ${filterType} stock items` : 'No items found'}
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* View Receipt Dialog Modal (with zoom controls) */}
      <Modal
        visible={viewDialogReceipt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewDialogReceipt(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.viewDialogModal}>
            {/* Header with close button */}
            <View style={styles.viewDialogHeader}>
              <View style={styles.viewDialogHeaderInfo}>
                <Text style={styles.viewDialogSupplier}>
                  {viewDialogReceipt ? getSupplierName(viewDialogReceipt) : 'Unknown Supplier'}
                </Text>
                <Text style={styles.viewDialogFileName}>
                  {viewDialogReceipt ? getReceiptFileName(viewDialogReceipt) : 'receipt.jpg'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setViewDialogReceipt(null)}>
                <Icon name="close" size={24} color={designColors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.viewDialogDivider} />
            
            {/* Zoom Controls */}
            <View style={styles.viewDialogZoomRow}>
              <TouchableOpacity
                onPress={() => {
                  const newZoom = Math.max(50, viewDialogZoom - 50);
                  setViewDialogZoom(newZoom);
                  viewDialogScale.setValue(newZoom / 100);
                  viewDialogBaseScale.current = newZoom / 100;
                }}
                style={[styles.viewDialogZoomButton, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight }]}
              >
                <Icon name="zoom-out" size={24} color={designColors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.viewDialogZoomText}>{viewDialogZoom}%</Text>
              <TouchableOpacity
                onPress={() => {
                  const newZoom = Math.min(1000, viewDialogZoom + 50);
                  setViewDialogZoom(newZoom);
                  viewDialogScale.setValue(newZoom / 100);
                  viewDialogBaseScale.current = newZoom / 100;
                }}
                style={[styles.viewDialogZoomButton, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight }]}
              >
                <Icon name="zoom-in" size={24} color={designColors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.viewDialogDivider} />
            
            {/* Image with Pinch Zoom and Pan */}
            <GestureHandlerRootView style={styles.viewDialogImageScroll}>
              <PanGestureHandler
                onGestureEvent={(event: PanGestureHandlerGestureEvent) => {
                  viewDialogTranslateX.setValue(viewDialogBaseTranslateX.current + event.nativeEvent.translationX);
                  viewDialogTranslateY.setValue(viewDialogBaseTranslateY.current + event.nativeEvent.translationY);
                }}
                onHandlerStateChange={(event) => {
                  if (event.nativeEvent.oldState === State.ACTIVE) {
                    viewDialogBaseTranslateX.current += event.nativeEvent.translationX;
                    viewDialogBaseTranslateY.current += event.nativeEvent.translationY;
                    // Clamp values
                    viewDialogBaseTranslateX.current = Math.max(-500, Math.min(500, viewDialogBaseTranslateX.current));
                    viewDialogBaseTranslateY.current = Math.max(-500, Math.min(500, viewDialogBaseTranslateY.current));
                  }
                }}
              >
                <Animated.View style={{ flex: 1 }}>
                  <PinchGestureHandler
                    onGestureEvent={(event: PinchGestureHandlerGestureEvent) => {
                      const newScale = viewDialogBaseScale.current * event.nativeEvent.scale;
                      viewDialogScale.setValue(Math.max(0.5, Math.min(10, newScale)));
                      setViewDialogZoom(Math.round(Math.max(0.5, Math.min(10, newScale)) * 100));
                    }}
                    onHandlerStateChange={(event) => {
                      if (event.nativeEvent.oldState === State.ACTIVE) {
                        viewDialogBaseScale.current *= event.nativeEvent.scale;
                        viewDialogBaseScale.current = Math.max(0.5, Math.min(10, viewDialogBaseScale.current));
                      }
                    }}
                  >
                    <Animated.View style={styles.viewDialogImageContent}>
                      {viewDialogReceipt && (
                        <Animated.Image
                          source={{ uri: getReceiptImageUrl(viewDialogReceipt) }}
                          style={[
                            styles.viewDialogImage,
                            {
                              transform: [
                                { scale: viewDialogScale },
                                { translateX: viewDialogTranslateX },
                                { translateY: viewDialogTranslateY },
                              ]
                            }
                          ]}
                          resizeMode="contain"
                        />
                      )}
                    </Animated.View>
                  </PinchGestureHandler>
                </Animated.View>
              </PanGestureHandler>
            </GestureHandlerRootView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticDesignColors.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: staticDesignColors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: staticDesignColors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  
  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 12,
    padding: 12,
  },
  summaryCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryCardTitle: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginTop: 4,
  },
  
  // Receipts Section
  receiptsSection: {
    backgroundColor: staticDesignColors.surfaceDark,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  receiptsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  receiptsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptsContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  noReceiptsText: {
    color: staticDesignColors.textSecondary,
    fontSize: 14,
    paddingVertical: 12,
  },
  moreReceiptsText: {
    color: staticDesignColors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  
  // Receipt Card
  receiptCard: {
    backgroundColor: staticDesignColors.cardDark,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  receiptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  receiptHeaderInfo: {
    marginLeft: 8,
    flex: 1,
  },
  receiptSupplier: {
    fontSize: 14,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
  },
  receiptSubmittedBy: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
  },
  receiptHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  receiptContent: {
    borderTopWidth: 1,
    borderTopColor: staticDesignColors.borderLight,
    padding: 12,
  },
  receiptSection: {
    marginBottom: 12,
  },
  receiptSectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
    marginBottom: 4,
  },
  receiptFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptFileName: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    flex: 1,
  },
  receiptActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  receiptActionButton: {
    flex: 1,
    height: 40,
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptRemarks: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
  },
  receiptButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  receiptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  
  // Stock Levels Header
  stockLevelsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  stockLevelsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Search
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: staticDesignColors.surfaceDark,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  
  // Category Section
  categorySection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categorySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: staticDesignColors.surfaceDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  
  // Stock Item Card
  stockItemCard: {
    backgroundColor: staticDesignColors.cardDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  stockItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stockItemImage: {
    width: 48,
    height: 48,
    borderRadius: 4,
  },
  stockItemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: staticDesignColors.surfaceDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockItemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  stockItemName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stockItemCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  stockItemRight: {
    alignItems: 'flex-end',
  },
  stockItemQty: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockItemThreshold: {
    fontSize: 12,
    marginTop: 2,
  },
  stockStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  stockStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Quick Action Form
  quickActionForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: staticDesignColors.borderLight,
  },
  unitSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  unitChips: {
    flexDirection: 'row',
    gap: 8,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  unitChipSelected: {
    backgroundColor: staticDesignColors.primaryRed,
    borderColor: staticDesignColors.primaryRed,
  },
  unitChipText: {
    fontSize: 12,
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickQuantityInput: {
    flex: 1,
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: staticDesignColors.textPrimary,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  quickAddButton: {
    backgroundColor: staticDesignColors.successGreen,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  quickAddButtonDisabled: {
    opacity: 0.5,
  },
  quickAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickCancelButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Plus Button
  plusButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 200, 81, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: staticDesignColors.textSecondary,
  },
  
  // View Receipt Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewReceiptModal: {
    width: '95%',
    height: '90%',
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 16,
    overflow: 'hidden',
  },
  viewReceiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: staticDesignColors.borderLight,
  },
  viewReceiptHeaderInfo: {
    flex: 1,
  },
  viewReceiptSupplier: {
    fontSize: 18,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
  },
  viewReceiptFileName: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginTop: 2,
  },
  viewReceiptImageContainer: {
    flex: 1,
    padding: 8,
  },
  viewReceiptImage: {
    width: '100%',
    height: '100%',
  },
  
  // View Dialog Modal
  viewDialogModal: {
    width: '95%',
    height: '90%',
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 16,
    overflow: 'hidden',
  },
  viewDialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  viewDialogHeaderInfo: {
    flex: 1,
  },
  viewDialogSupplier: {
    fontSize: 18,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
  },
  viewDialogFileName: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginTop: 2,
  },
  viewDialogDivider: {
    height: 1,
    backgroundColor: staticDesignColors.borderLight,
  },
  viewDialogZoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  viewDialogZoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: staticDesignColors.cardDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  viewDialogZoomText: {
    fontSize: 16,
    fontWeight: '600',
    color: staticDesignColors.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
  viewDialogImageScroll: {
    flex: 1,
  },
  viewDialogImageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  viewDialogImage: {
    width: 300,
    height: 400,
  },
  
  // Full Screen Document Viewer
  fullScreenContainer: {
    flex: 1,
    backgroundColor: staticDesignColors.backgroundDark,
  },
  documentViewerContainer: {
    flex: 1,
    backgroundColor: staticDesignColors.surfaceDark,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: staticDesignColors.borderLight,
  },
  documentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  documentCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: staticDesignColors.cardDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentHeaderInfo: {
    flex: 1,
  },
  documentSupplierName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
  },
  documentFileName: {
    fontSize: 11,
    color: staticDesignColors.textSecondary,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: staticDesignColors.cardDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  zoomText: {
    fontSize: 12,
    fontWeight: '600',
    color: staticDesignColors.textPrimary,
    minWidth: 45,
    textAlign: 'center',
  },
  documentDivider: {
    height: 1,
    backgroundColor: staticDesignColors.borderLight,
  },
  documentImageScroll: {
    flex: 1,
  },
  documentImageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  bottomStockContainer: {
    flex: 1,
    backgroundColor: staticDesignColors.backgroundDark,
    paddingTop: 16,
  },
  bottomStockScroll: {
    flex: 1,
  },
  stockListSection: {
    height: '50%',
  },
});

export default StockInScreen;
