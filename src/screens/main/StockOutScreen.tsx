import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { StockItem } from '../../models';
import { useTheme } from '../../theme/ThemeContext';

// Design colors matching Kotlin app
const designColors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  cardDark: '#1E1E1E',
  surfaceVariant: '#2D2D2D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  warningOrange: '#FF8800',
  criticalRed: '#E53E3E',
  successGreen: '#00C851',
  infoBlue: '#3B82F6',
};

// Toast helper using react-native-toast-message
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  Toast.show({
    type,
    text1: message,
    position: 'bottom',
    visibilityTime: 2500,
  });
};

const StockOutScreen = () => {
  const { colors } = useTheme();

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'low' | 'critical'>('all');
  const [categorySearchTerms, setCategorySearchTerms] = useState<Record<string, string>>({});
  
  // Remove Stock Dialog states
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitType, setUnitType] = useState<'base' | 'packaging'>('base');
  const [reason, setReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Quick action states
  const [quickActionItem, setQuickActionItem] = useState<StockItem | null>(null);
  const [quickQuantity, setQuickQuantity] = useState('');
  const [quickUnitType, setQuickUnitType] = useState<'base' | 'packaging'>('base');
  const [isQuickActionLoading, setIsQuickActionLoading] = useState(false);

  const loadStockData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    try {
      const data = await apiClient.getStockData();
      setStockItems(data);
      
      if (data.length === 0) {
        // Try to initialize
        try {
          const initResult = await apiClient.initializeStock();
          if (initResult.initialized > 0) {
            showToast(`Initialized stock for ${initResult.initialized} items`);
            loadStockData(true);
          }
        } catch (e) {
          console.log('Initialize error:', e);
        }
      }
    } catch (error) {
      console.log('Load stock error:', error);
      showToast('Failed to load stock data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStockData();
  }, [loadStockData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStockData(true);
  };

  // Calculated values
  const criticalStockItems = useMemo(() => {
    return stockItems.filter((item) => {
      const threshold = item.items?.threshold_level || 0;
      return item.current_quantity <= threshold * 0.5;
    });
  }, [stockItems]);

  const lowStockItems = useMemo(() => {
    return stockItems.filter((item) => {
      const threshold = item.items?.threshold_level || 0;
      return item.current_quantity > threshold * 0.5 && item.current_quantity <= threshold;
    });
  }, [stockItems]);

  const displayItems = useMemo(() => {
    switch (filterType) {
      case 'low':
        return lowStockItems;
      case 'critical':
        return criticalStockItems;
      default:
        return stockItems;
    }
  }, [filterType, stockItems, lowStockItems, criticalStockItems]);

  const filteredStockItems = useMemo(() => {
    return displayItems.filter((item) => {
      const name = item.items?.name || '';
      const category = item.items?.category || '';
      return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             category.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [displayItems, searchTerm]);

  // Group by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, StockItem[]> = {};
    filteredStockItems.forEach((item) => {
      const category = item.items?.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      const categorySearch = categorySearchTerms[category] || '';
      if (categorySearch === '' || item.items?.name?.toLowerCase().includes(categorySearch.toLowerCase())) {
        groups[category].push(item);
      }
    });
    // Remove empty categories
    Object.keys(groups).forEach((key) => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });
    return groups;
  }, [filteredStockItems, categorySearchTerms]);

  // Quick action handlers
  const handleQuickStockOut = async (item: StockItem) => {
    if (quickQuantity.trim() === '') {
      showToast('Please enter a quantity');
      return;
    }
    
    const qty = parseInt(quickQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid quantity');
      return;
    }
    
    setIsQuickActionLoading(true);
    
    let quantityInBaseUnits = qty;
    if (quickUnitType === 'packaging' && item.items?.units_per_package) {
      quantityInBaseUnits = qty * item.items.units_per_package;
    }
    
    if (quantityInBaseUnits > item.current_quantity) {
      showToast('Insufficient stock!');
      setIsQuickActionLoading(false);
      return;
    }
    
    const unitLabel = quickUnitType === 'packaging' 
      ? (item.items?.packaging_unit || 'package')
      : (item.items?.base_unit || 'piece');
    
    try {
      await apiClient.updateStockQuantity(
        item.item_id,
        'out',
        quantityInBaseUnits,
        'Quick stock out',
        quickUnitType,
        qty,
        unitLabel
      );
      showToast(`Removed ${qty} ${unitLabel}`);
      setQuickActionItem(null);
      setQuickQuantity('');
      setQuickUnitType('base');
      loadStockData(true);
    } catch (error: any) {
      showToast(`Error: ${error.message}`);
    } finally {
      setIsQuickActionLoading(false);
    }
  };

  // Remove dialog confirm
  const handleRemoveConfirm = async () => {
    if (!selectedItem || quantity.trim() === '') {
      showToast('Please select an item and enter quantity');
      return;
    }
    
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid quantity');
      return;
    }
    
    setIsRemoving(true);
    
    const unitsPerPackage = selectedItem.items?.units_per_package || 1;
    const quantityInBaseUnits = unitType === 'packaging' && unitsPerPackage > 1
      ? qty * unitsPerPackage
      : qty;
    
    if (quantityInBaseUnits > selectedItem.current_quantity) {
      showToast('Insufficient stock!');
      setIsRemoving(false);
      return;
    }
    
    const unitLabel = unitType === 'packaging'
      ? (selectedItem.items?.packaging_unit || 'package')
      : (selectedItem.items?.base_unit || 'piece');
    
    try {
      await apiClient.updateStockQuantity(
        selectedItem.item_id,
        'out',
        quantityInBaseUnits,
        reason.trim() || undefined,
        unitType,
        qty,
        unitLabel
      );
      showToast(`Removed ${qty} ${unitLabel}`);
      setShowRemoveDialog(false);
      setSelectedItem(null);
      setQuantity('');
      setUnitType('base');
      setReason('');
      loadStockData(true);
    } catch (error: any) {
      showToast(`Error: ${error.message}`);
    } finally {
      setIsRemoving(false);
    }
  };

  const getStockStatus = (item: StockItem) => {
    const threshold = item.items?.threshold_level || 0;
    const current = item.current_quantity;
    if (current <= threshold * 0.5) {
      return { color: designColors.criticalRed, label: 'Critical' };
    }
    if (current <= threshold) {
      return { color: designColors.warningOrange, label: 'Low' };
    }
    return { color: designColors.successGreen, label: 'Adequate' };
  };

  // Get image source - handle base64 data
  const getImageSource = (item: StockItem) => {
    const imageUrl = item.items?.image_url || item.items?.photo_url;
    if (!imageUrl) return null;
    
    if (imageUrl.startsWith('data:')) {
      return { uri: imageUrl };
    }
    if (imageUrl.length > 200) {
      // Likely base64 without prefix
      return { uri: `data:image/jpeg;base64,${imageUrl}` };
    }
    return { uri: imageUrl };
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: designColors.backgroundDark }]}>
        <ActivityIndicator size="large" color={designColors.primaryRed} />
        <Text style={[styles.loadingText, { color: designColors.textSecondary }]}>
          Loading inventory...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: designColors.backgroundDark }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[designColors.primaryRed]}
            tintColor={designColors.primaryRed}
          />
        }
      >
        {/* Header with Remove Stock button */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: designColors.textPrimary }]}>
            Stock Out
          </Text>
          <TouchableOpacity
            style={styles.removeStockButton}
            onPress={() => setShowRemoveDialog(true)}
          >
            <Icon name="remove" size={18} color="#FFFFFF" />
            <Text style={styles.removeStockButtonText}>Remove Stock</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryCardsRow}>
          <TouchableOpacity
            style={[styles.summaryCard, { backgroundColor: designColors.cardDark }]}
            onPress={() => setFilterType('all')}
          >
            <Icon name="inventory" size={24} color={designColors.primaryRed} />
            <Text style={[styles.summaryCardCount, { color: designColors.primaryRed }]}>
              {stockItems.length}
            </Text>
            <Text style={[styles.summaryCardLabel, { color: designColors.textSecondary }]}>
              Total Items
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.summaryCard, { backgroundColor: designColors.cardDark }]}
            onPress={() => setFilterType('low')}
          >
            <Icon name="warning" size={24} color={designColors.warningOrange} />
            <Text style={[styles.summaryCardCount, { color: designColors.warningOrange }]}>
              {lowStockItems.length}
            </Text>
            <Text style={[styles.summaryCardLabel, { color: designColors.textSecondary }]}>
              Low Stock
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.summaryCard, { backgroundColor: designColors.cardDark }]}
            onPress={() => setFilterType('critical')}
          >
            <Icon name="error" size={24} color={designColors.criticalRed} />
            <Text style={[styles.summaryCardCount, { color: designColors.criticalRed }]}>
              {criticalStockItems.length}
            </Text>
            <Text style={[styles.summaryCardLabel, { color: designColors.textSecondary }]}>
              Critical
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Card */}
        <View style={[styles.searchCard, { backgroundColor: designColors.cardDark }]}>
          <Text style={[styles.searchCardTitle, { color: designColors.textPrimary }]}>
            {filterType === 'low' ? 'Low Stock Items' : 
             filterType === 'critical' ? 'Critical Stock Items' : 
             'Current Stock Levels'}
          </Text>
          <View style={[styles.searchInputContainer, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.textSecondary }]}>
            <Icon name="search" size={20} color={designColors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: designColors.textPrimary }]}
              placeholder="Search items by name or category..."
              placeholderTextColor={designColors.textSecondary}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm !== '' && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Icon name="close" size={20} color={designColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Sections */}
        {Object.entries(groupedItems).map(([category, items]) => (
          <CategorySection
            key={category}
            category={category}
            items={items}
            searchTerm={categorySearchTerms[category] || ''}
            onSearchChange={(value) => {
              setCategorySearchTerms((prev) => ({ ...prev, [category]: value }));
            }}
            quickActionItem={quickActionItem}
            quickQuantity={quickQuantity}
            quickUnitType={quickUnitType}
            isQuickActionLoading={isQuickActionLoading}
            onQuickQuantityChange={setQuickQuantity}
            onQuickUnitTypeChange={setQuickUnitType}
            onQuickActionClick={(item) => {
              setQuickActionItem(item);
              setQuickQuantity('');
              setQuickUnitType('base');
            }}
            onQuickActionCancel={() => {
              setQuickActionItem(null);
              setQuickQuantity('');
              setQuickUnitType('base');
            }}
            onQuickStockOut={handleQuickStockOut}
            getImageSource={getImageSource}
            getStockStatus={getStockStatus}
          />
        ))}

        {/* Empty State */}
        {Object.keys(groupedItems).length === 0 && !isLoading && (
          <View style={[styles.emptyCard, { backgroundColor: designColors.cardDark }]}>
            <Text style={[styles.emptyText, { color: designColors.textSecondary }]}>
              {filterType === 'low' ? 'No low stock items' :
               filterType === 'critical' ? 'No critical stock items' :
               'No stock items found'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Remove Stock Dialog */}
      <RemoveStockDialog
        visible={showRemoveDialog}
        stockItems={stockItems}
        selectedItem={selectedItem}
        quantity={quantity}
        unitType={unitType}
        reason={reason}
        isRemoving={isRemoving}
        onSelectItem={(item) => {
          setSelectedItem(item);
          setQuantity('');
          setUnitType('base');
        }}
        onQuantityChange={setQuantity}
        onUnitTypeChange={setUnitType}
        onReasonChange={setReason}
        onDismiss={() => {
          setShowRemoveDialog(false);
          setSelectedItem(null);
          setQuantity('');
          setUnitType('base');
          setReason('');
        }}
        onConfirm={handleRemoveConfirm}
        getImageSource={getImageSource}
      />
    </View>
  );
};

// CategorySection Component
interface CategorySectionProps {
  category: string;
  items: StockItem[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  quickActionItem: StockItem | null;
  quickQuantity: string;
  quickUnitType: 'base' | 'packaging';
  isQuickActionLoading: boolean;
  onQuickQuantityChange: (value: string) => void;
  onQuickUnitTypeChange: (value: 'base' | 'packaging') => void;
  onQuickActionClick: (item: StockItem) => void;
  onQuickActionCancel: () => void;
  onQuickStockOut: (item: StockItem) => void;
  getImageSource: (item: StockItem) => { uri: string } | null;
  getStockStatus: (item: StockItem) => { color: string; label: string };
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  items,
  searchTerm,
  onSearchChange,
  quickActionItem,
  quickQuantity,
  quickUnitType,
  isQuickActionLoading,
  onQuickQuantityChange,
  onQuickUnitTypeChange,
  onQuickActionClick,
  onQuickActionCancel,
  onQuickStockOut,
  getImageSource,
  getStockStatus,
}) => {
  return (
    <View style={[styles.categoryCard, { backgroundColor: designColors.cardDark }]}>
      {/* Category Header */}
      <View style={styles.categoryHeader}>
        <View>
          <Text style={[styles.categoryTitle, { color: designColors.textPrimary }]}>
            {category}
          </Text>
          <Text style={[styles.categoryCount, { color: designColors.textSecondary }]}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[styles.categorySearchContainer, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.textSecondary }]}>
          <TextInput
            style={[styles.categorySearchInput, { color: designColors.textPrimary }]}
            placeholder={`Search in ${category}`}
            placeholderTextColor={designColors.textSecondary}
            value={searchTerm}
            onChangeText={onSearchChange}
          />
        </View>
      </View>

      {/* Items */}
      {items.map((item) => (
        <StockItemRow
          key={item.item_id || item.id}
          item={item}
          isQuickAction={quickActionItem?.item_id === item.item_id}
          quickQuantity={quickQuantity}
          quickUnitType={quickUnitType}
          isLoading={isQuickActionLoading}
          onQuickQuantityChange={onQuickQuantityChange}
          onQuickUnitTypeChange={onQuickUnitTypeChange}
          onQuickActionClick={() => onQuickActionClick(item)}
          onQuickActionCancel={onQuickActionCancel}
          onQuickStockOut={() => onQuickStockOut(item)}
          getImageSource={getImageSource}
          getStockStatus={getStockStatus}
        />
      ))}
    </View>
  );
};

// StockItemRow Component
interface StockItemRowProps {
  item: StockItem;
  isQuickAction: boolean;
  quickQuantity: string;
  quickUnitType: 'base' | 'packaging';
  isLoading: boolean;
  onQuickQuantityChange: (value: string) => void;
  onQuickUnitTypeChange: (value: 'base' | 'packaging') => void;
  onQuickActionClick: () => void;
  onQuickActionCancel: () => void;
  onQuickStockOut: () => void;
  getImageSource: (item: StockItem) => { uri: string } | null;
  getStockStatus: (item: StockItem) => { color: string; label: string };
}

const StockItemRow: React.FC<StockItemRowProps> = ({
  item,
  isQuickAction,
  quickQuantity,
  quickUnitType,
  isLoading,
  onQuickQuantityChange,
  onQuickUnitTypeChange,
  onQuickActionClick,
  onQuickActionCancel,
  onQuickStockOut,
  getImageSource,
  getStockStatus,
}) => {
  const status = getStockStatus(item);
  const imageSource = getImageSource(item);
  const threshold = item.items?.threshold_level || 0;
  
  return (
    <View style={[styles.stockItemRow, { backgroundColor: designColors.surfaceVariant + '4D' }]}>
      {/* Main Row: Image, Info, Right side with Qty/Status/Button */}
      <View style={styles.stockItemContent}>
        {/* Image */}
        <View style={[styles.stockItemImage, { backgroundColor: imageSource ? designColors.primaryRed + '33' : designColors.surfaceVariant }]}>
          {imageSource ? (
            <Image source={imageSource} style={styles.stockItemImageInner} />
          ) : (
            <Icon name="inventory" size={24} color={designColors.textSecondary} />
          )}
        </View>
        
        {/* Item Info */}
        <View style={styles.stockItemInfo}>
          <Text style={[styles.stockItemName, { color: designColors.textPrimary }]} numberOfLines={1}>
            {item.items?.name || 'Unknown'}
          </Text>
          <Text style={[styles.stockItemCategory, { color: designColors.textSecondary }]}>
            {item.items?.category || 'Uncategorized'}
          </Text>
        </View>
        
        {/* Right side: Qty info, status, and minus button */}
        <View style={styles.stockItemRight}>
          <Text style={[styles.stockItemQtyRight, { color: designColors.textPrimary }]}>
            Qty: {item.current_quantity} {item.items?.base_unit || 'pieces'}
          </Text>
          <Text style={[styles.stockItemThresholdRight, { color: designColors.textSecondary }]}>
            Threshold: {threshold} {item.items?.base_unit || 'pieces'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '1A' }]}>
            <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
          </View>
          
          {/* Quick Action Button - Below the status badge */}
          {!isQuickAction && (
            <TouchableOpacity
              style={[styles.quickActionButtonInline, { backgroundColor: designColors.criticalRed + '33' }]}
              onPress={onQuickActionClick}
            >
              <Icon name="remove" size={20} color={designColors.criticalRed} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Quick Action Expanded - Shows on new line below item info */}
      {isQuickAction && (
        <View style={styles.quickActionExpandedRow}>
          {/* Unit type selection if packaging enabled */}
          {item.items?.enable_packaging && item.items?.packaging_unit ? (
            <View style={styles.unitTypeSection}>
              <Text style={[styles.unitLabel, { color: designColors.textSecondary }]}>Unit:</Text>
              <TouchableOpacity
                style={[
                  styles.unitTypeChip,
                  quickUnitType === 'base' && styles.unitTypeChipSelected,
                ]}
                onPress={() => onQuickUnitTypeChange('base')}
              >
                <Text style={[
                  styles.unitTypeChipText,
                  quickUnitType === 'base' && styles.unitTypeChipTextSelected,
                ]}>
                  {item.items?.base_unit || 'piece'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitTypeChip,
                  quickUnitType === 'packaging' && styles.unitTypeChipSelected,
                ]}
                onPress={() => onQuickUnitTypeChange('packaging')}
              >
                <Text style={[
                  styles.unitTypeChipText,
                  quickUnitType === 'packaging' && styles.unitTypeChipTextSelected,
                ]}>
                  {item.items?.packaging_unit}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
          
          {/* Qty input, Remove button, Cancel button */}
          <View style={styles.quickActionControls}>
            <TextInput
              style={[styles.quickQuantityInput, { backgroundColor: designColors.surfaceVariant, color: designColors.textPrimary, borderColor: designColors.textSecondary }]}
              value={quickQuantity}
              onChangeText={onQuickQuantityChange}
              placeholder="Qty"
              placeholderTextColor={designColors.textSecondary}
              keyboardType="numeric"
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.quickRemoveButton, { backgroundColor: designColors.surfaceVariant }]}
              onPress={onQuickStockOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={designColors.textSecondary} />
              ) : (
                <Text style={[styles.removeButtonText, { color: designColors.textSecondary }]}>Remove</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickCancelButton}
              onPress={onQuickActionCancel}
              disabled={isLoading}
            >
              <Icon name="close" size={24} color={designColors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// RemoveStockDialog Component
interface RemoveStockDialogProps {
  visible: boolean;
  stockItems: StockItem[];
  selectedItem: StockItem | null;
  quantity: string;
  unitType: 'base' | 'packaging';
  reason: string;
  isRemoving: boolean;
  onSelectItem: (item: StockItem) => void;
  onQuantityChange: (value: string) => void;
  onUnitTypeChange: (value: 'base' | 'packaging') => void;
  onReasonChange: (value: string) => void;
  onDismiss: () => void;
  onConfirm: () => void;
  getImageSource: (item: StockItem) => { uri: string } | null;
}

const RemoveStockDialog: React.FC<RemoveStockDialogProps> = ({
  visible,
  stockItems,
  selectedItem,
  quantity,
  unitType,
  reason,
  isRemoving,
  onSelectItem,
  onQuantityChange,
  onUnitTypeChange,
  onReasonChange,
  onDismiss,
  onConfirm,
  getImageSource,
}) => {
  const [dropdownExpanded, setDropdownExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      const name = item.items?.name || '';
      const category = item.items?.category || '';
      return searchQuery === '' || 
             name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             category.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [stockItems, searchQuery]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.dialogContent, { backgroundColor: designColors.cardDark }]}>
          <Text style={[styles.dialogTitle, { color: designColors.textPrimary }]}>
            Remove Stock
          </Text>

          {/* Item Selector */}
          <TouchableOpacity
            style={[styles.dropdownTrigger, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.textSecondary }]}
            onPress={() => setDropdownExpanded(!dropdownExpanded)}
          >
            <Text style={[styles.dropdownTriggerText, { color: selectedItem ? designColors.textPrimary : designColors.textSecondary }]}>
              {selectedItem?.items?.name || 'Select an item'}
            </Text>
            <Icon name={dropdownExpanded ? 'expand-less' : 'expand-more'} size={24} color={designColors.textSecondary} />
          </TouchableOpacity>

          {dropdownExpanded && (
            <View style={[styles.dropdownMenu, { backgroundColor: designColors.surfaceVariant }]}>
              <TextInput
                style={[styles.dropdownSearch, { backgroundColor: designColors.cardDark, color: designColors.textPrimary, borderColor: designColors.textSecondary }]}
                placeholder="Search..."
                placeholderTextColor={designColors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {filteredItems.map((item) => {
                  const imageSource = getImageSource(item);
                  return (
                    <TouchableOpacity
                      key={item.item_id || item.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        onSelectItem(item);
                        setDropdownExpanded(false);
                        setSearchQuery('');
                      }}
                    >
                      {imageSource ? (
                        <Image source={imageSource} style={styles.dropdownItemImage} />
                      ) : (
                        <View style={[styles.dropdownItemImagePlaceholder, { backgroundColor: designColors.cardDark }]}>
                          <Icon name="inventory" size={20} color={designColors.textSecondary} />
                        </View>
                      )}
                      <Text style={[styles.dropdownItemText, { color: designColors.textPrimary }]} numberOfLines={1}>
                        {item.items?.name} ({item.current_quantity} {item.items?.base_unit})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {selectedItem && (
            <>
              {/* Unit Type Selection */}
              {selectedItem.items?.enable_packaging && selectedItem.items?.packaging_unit && (
                <View style={styles.dialogSection}>
                  <Text style={[styles.dialogLabel, { color: designColors.textSecondary }]}>Remove By:</Text>
                  <View style={styles.unitTypeButtonsRow}>
                    <TouchableOpacity
                      style={[
                        styles.unitTypeButton,
                        { backgroundColor: unitType === 'base' ? designColors.primaryRed : designColors.surfaceVariant },
                      ]}
                      onPress={() => onUnitTypeChange('base')}
                    >
                      <Text style={[styles.unitTypeButtonText, { color: unitType === 'base' ? '#FFFFFF' : designColors.textPrimary }]}>
                        {selectedItem.items?.base_unit || 'piece'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.unitTypeButton,
                        { backgroundColor: unitType === 'packaging' ? designColors.primaryRed : designColors.surfaceVariant },
                      ]}
                      onPress={() => onUnitTypeChange('packaging')}
                    >
                      <Text style={[styles.unitTypeButtonText, { color: unitType === 'packaging' ? '#FFFFFF' : designColors.textPrimary }]}>
                        {selectedItem.items?.packaging_unit}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Quantity Input */}
              <View style={styles.dialogSection}>
                <Text style={[styles.dialogLabel, { color: designColors.textSecondary }]}>Quantity to Remove</Text>
                <TextInput
                  style={[styles.dialogInput, { backgroundColor: designColors.surfaceVariant, color: designColors.textPrimary, borderColor: designColors.textSecondary }]}
                  value={quantity}
                  onChangeText={onQuantityChange}
                  keyboardType="numeric"
                  placeholder="Enter quantity"
                  placeholderTextColor={designColors.textSecondary}
                />
              </View>

              {/* Conversion Display */}
              {unitType === 'packaging' && quantity !== '' && !isNaN(parseInt(quantity, 10)) && selectedItem.items?.units_per_package && (
                <View style={[styles.conversionCard, { backgroundColor: designColors.infoBlue + '1A' }]}>
                  <Text style={[styles.conversionText, { color: designColors.infoBlue }]}>
                    {quantity} {selectedItem.items?.packaging_unit} = {parseInt(quantity, 10) * selectedItem.items.units_per_package} {selectedItem.items?.base_unit}
                  </Text>
                </View>
              )}

              {/* Reason Input */}
              <View style={styles.dialogSection}>
                <Text style={[styles.dialogLabel, { color: designColors.textSecondary }]}>Reason (Optional)</Text>
                <TextInput
                  style={[styles.dialogInputMultiline, { backgroundColor: designColors.surfaceVariant, color: designColors.textPrimary, borderColor: designColors.textSecondary }]}
                  value={reason}
                  onChangeText={onReasonChange}
                  placeholder="Enter reason"
                  placeholderTextColor={designColors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </>
          )}

          {/* Dialog Actions */}
          <View style={styles.dialogActions}>
            <TouchableOpacity
              style={[styles.dialogButton, { backgroundColor: designColors.surfaceVariant }]}
              onPress={onDismiss}
              disabled={isRemoving}
            >
              <Text style={[styles.dialogButtonText, { color: designColors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dialogButton,
                { backgroundColor: (!selectedItem || quantity === '') ? designColors.surfaceVariant : designColors.primaryRed },
              ]}
              onPress={onConfirm}
              disabled={isRemoving || !selectedItem || quantity === ''}
            >
              {isRemoving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.dialogButtonText, { color: (!selectedItem || quantity === '') ? designColors.textSecondary : '#FFFFFF' }]}>
                  Remove Stock
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  removeStockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF0000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  removeStockButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Summary Cards
  summaryCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryCardCount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  summaryCardLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  // Search Card
  searchCard: {
    borderRadius: 12,
    padding: 16,
  },
  searchCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  // Category Section
  categoryCard: {
    borderRadius: 12,
    padding: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryCount: {
    fontSize: 12,
  },
  categorySearchContainer: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 180,
  },
  categorySearchInput: {
    fontSize: 13,
    padding: 0,
  },
  // Stock Item Row
  stockItemRow: {
    borderRadius: 8,
    marginBottom: 8,
  },
  stockItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  stockItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockItemImageInner: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  stockItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  stockItemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  stockItemQty: {
    fontSize: 12,
    marginTop: 2,
  },
  stockItemThreshold: {
    fontSize: 12,
  },
  stockItemCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  stockItemRight: {
    alignItems: 'flex-end',
  },
  stockItemQtyRight: {
    fontSize: 14,
    fontWeight: '500',
  },
  stockItemThresholdRight: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // Quick Action Button (inline, below status badge)
  quickActionButtonInline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  // Quick Action Expanded Row (new line below item info)
  quickActionExpandedRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3D3D3D',
  },
  unitTypeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  unitLabel: {
    fontSize: 14,
  },
  quickActionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Quick Action (kept for backwards compatibility)
  quickActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionExpanded: {
    alignItems: 'flex-end',
  },
  unitTypeRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  unitTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#2D2D2D',
    borderWidth: 1,
    borderColor: '#5D5D5D',
  },
  unitTypeChipSelected: {
    backgroundColor: '#4D4D4D',
    borderColor: '#808080',
  },
  unitTypeChipText: {
    fontSize: 13,
    color: '#B0B0B0',
  },
  unitTypeChipTextSelected: {
    color: '#FFFFFF',
  },
  quickActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickQuantityInput: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  quickRemoveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickCancelButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty State
  emptyCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  // Modal / Dialog
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownTriggerText: {
    fontSize: 14,
  },
  dropdownMenu: {
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 250,
    overflow: 'hidden',
  },
  dropdownSearch: {
    margin: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  dropdownItemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  dropdownItemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 14,
  },
  dialogSection: {
    marginTop: 16,
  },
  dialogLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  dialogInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  dialogInputMultiline: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  unitTypeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  unitTypeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  conversionCard: {
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  conversionText: {
    fontSize: 13,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 24,
  },
  dialogButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  dialogButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StockOutScreen;
