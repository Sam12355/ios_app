import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../api/ApiClient';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../theme/ThemeContext';

interface SearchResultItem {
  id: string;
  name: string;
  category: string;
  currentQuantity: number;
  thresholdLevel: number;
  lowLevel?: number;
  criticalLevel?: number;
  imageUrl?: string;
  baseUnit?: string;
  packagingUnit?: string;
  unitsPerPackage?: number;
  enablePackaging?: boolean;
  branchId?: string;
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose }) => {
  const { isDark } = useTheme();
  const { profile } = useAuthStore();
  const [query, setQuery] = useState('');
  const [allItems, setAllItems] = useState<SearchResultItem[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Load all stock data when modal opens
  const loadStockData = useCallback(async () => {
    if (initialLoadDone) return;
    
    setIsLoading(true);
    try {
      const stockData = await apiClient.getStockData();
      
      const mapped = (stockData || []).map((item: any) => {
        const itemDetails = item.items || item;
        return {
          id: item.item_id || item.id || '',
          name: itemDetails?.name || item?.name || '',
          category: itemDetails?.category || item?.category || '',
          currentQuantity: item.current_quantity ?? item.currentQuantity ?? 0,
          thresholdLevel: itemDetails?.threshold_level ?? item?.thresholdLevel ?? 0,
          lowLevel: itemDetails?.low_level ?? item?.lowLevel,
          criticalLevel: itemDetails?.critical_level ?? item?.criticalLevel,
          imageUrl: itemDetails?.image_url ?? item?.imageUrl,
          baseUnit: itemDetails?.base_unit ?? item?.baseUnit,
          packagingUnit: itemDetails?.packaging_unit ?? item?.packagingUnit,
          unitsPerPackage: itemDetails?.units_per_package ?? item?.unitsPerPackage,
          enablePackaging: itemDetails?.enable_packaging ?? item?.enablePackaging,
          branchId: itemDetails?.branch_id ?? item?.branchId,
        };
      });
      
      setAllItems(mapped);
      setInitialLoadDone(true);
    } catch (error) {
      console.log('Error loading stock data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [initialLoadDone]);

  // Load data when modal opens
  useEffect(() => {
    if (visible && !initialLoadDone) {
      loadStockData();
    }
  }, [visible, initialLoadDone, loadStockData]);

  // Filter items instantly when query changes (no delay since data is already loaded)
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const branchId = profile?.branchId;
    const filtered = allItems
      .filter((item) => {
        const matchesBranch = !branchId || item.branchId === branchId;
        const matchesSearch = 
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase());
        return matchesSearch && matchesBranch;
      })
      .slice(0, 5);

    setResults(filtered);
  }, [query, allItems, profile?.branchId]);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSelectedItem(null);
    }
  }, [visible]);

  const getStockStatus = (item: SearchResultItem) => {
    if (item.criticalLevel && item.currentQuantity <= item.criticalLevel) {
      return { color: '#DC2626', label: 'Critical', icon: 'error' };
    }
    if (item.lowLevel && item.currentQuantity <= item.lowLevel) {
      return { color: '#F59E0B', label: 'Low', icon: 'warning' };
    }
    if (item.currentQuantity <= item.thresholdLevel) {
      return { color: '#F97316', label: 'Warning', icon: 'warning' };
    }
    return { color: '#22C55E', label: 'Adequate', icon: 'check-circle' };
  };

  const renderItemImage = (imageUrl?: string, size: number = 64) => {
    if (imageUrl && (imageUrl.startsWith('data:image') || imageUrl.startsWith('http'))) {
      return (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.itemImage, { width: size, height: size }]}
          resizeMode="cover"
        />
      );
    }
    return (
      <View style={[styles.itemImagePlaceholder, { width: size, height: size }]}>
        <Icon name="inventory-2" size={size / 2} color="#666" />
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: SearchResultItem }) => {
    const status = getStockStatus(item);
    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => setSelectedItem(item)}
        activeOpacity={0.7}
      >
        {renderItemImage(item.imageUrl, 64)}
        <View style={styles.resultInfo}>
          <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.resultCategory}>
            {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
          </Text>
          <View style={styles.statusRow}>
            <Icon name={status.icon} size={16} color={status.color} />
            <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
              <Text style={styles.statusText}>{status.label}</Text>
            </View>
            <Text style={styles.unitsText}>{item.currentQuantity} units</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItemDetail = () => {
    if (!selectedItem) return null;
    const status = getStockStatus(selectedItem);
    
    // Calculate packaging info
    const packages = selectedItem.enablePackaging && selectedItem.unitsPerPackage && selectedItem.unitsPerPackage > 0
      ? Math.floor(selectedItem.currentQuantity / selectedItem.unitsPerPackage)
      : 0;
    const remainder = selectedItem.enablePackaging && selectedItem.unitsPerPackage && selectedItem.unitsPerPackage > 0
      ? selectedItem.currentQuantity % selectedItem.unitsPerPackage
      : 0;

    return (
      <ScrollView 
        style={styles.detailContainer}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        <View style={styles.detailHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedItem(null)}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>Item Details</Text>
        </View>

        <View style={styles.detailContent}>
          {/* Header with image and basic info - side by side like Kotlin */}
          <View style={styles.itemHeader}>
            {renderItemImage(selectedItem.imageUrl, 80)}
            <View style={styles.itemHeaderInfo}>
              <Text style={styles.detailName}>{selectedItem.name}</Text>
              <Text style={styles.detailCategory}>
                {selectedItem.category.charAt(0).toUpperCase() + selectedItem.category.slice(1)}
              </Text>
            </View>
          </View>

          {/* Stock Information Card */}
          <View style={styles.stockInfoCard}>
            <Text style={styles.stockInfoTitle}>Stock Information</Text>
            
            {/* Current Stock and Threshold row */}
            <View style={styles.stockRow}>
              <View style={[styles.stockInfoItem, { backgroundColor: 'rgba(230, 0, 42, 0.15)' }]}>
                <Text style={[styles.stockInfoLabel, { color: '#E6002A' }]}>Current Stock</Text>
                <Text style={[styles.stockInfoValue, { color: '#E6002A' }]}>
                  {selectedItem.currentQuantity}
                </Text>
                <Text style={[styles.stockInfoUnit, { color: '#E6002A' }]}>
                  {selectedItem.baseUnit || 'units'}
                </Text>
              </View>
              <View style={[styles.stockInfoItem, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                <Text style={styles.stockInfoLabel}>Threshold</Text>
                <Text style={styles.stockInfoValue}>{selectedItem.thresholdLevel}</Text>
                <Text style={styles.stockInfoUnit}></Text>
              </View>
            </View>

            {/* Packaging info if enabled */}
            {selectedItem.enablePackaging && selectedItem.packagingUnit && selectedItem.unitsPerPackage && selectedItem.unitsPerPackage > 0 && (
              <View style={styles.packagingCard}>
                <Text style={styles.packagingLabel}>Packaging</Text>
                <Text style={styles.packagingValue}>
                  {packages} {selectedItem.packagingUnit || 'packages'}
                </Text>
                {remainder > 0 && (
                  <Text style={styles.packagingRemainder}>
                    + {remainder} {selectedItem.baseUnit || 'units'}
                  </Text>
                )}
              </View>
            )}

            {/* Low and Critical Alerts */}
            {(selectedItem.lowLevel !== undefined || selectedItem.criticalLevel !== undefined) && (
              <View style={styles.stockRow}>
                {selectedItem.lowLevel !== undefined && (
                  <View style={[styles.stockInfoItem, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                    <Text style={[styles.stockInfoLabel, { color: '#EAB308' }]}>Low Alert</Text>
                    <Text style={[styles.stockInfoValue, { color: '#EAB308' }]}>
                      {selectedItem.lowLevel}
                    </Text>
                  </View>
                )}
                {selectedItem.criticalLevel !== undefined && (
                  <View style={[styles.stockInfoItem, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Text style={[styles.stockInfoLabel, { color: '#EF4444' }]}>Critical Alert</Text>
                    <Text style={[styles.stockInfoValue, { color: '#EF4444' }]}>
                      {selectedItem.criticalLevel}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Stock Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.stockInfoTitle}>Stock Status</Text>
              <Icon name={status.icon} size={20} color={status.color} />
            </View>
            <View style={styles.statusContent}>
              <View style={[styles.statusBadgeLarge, { backgroundColor: status.color }]}>
                <Text style={styles.statusBadgeText}>{status.label}</Text>
              </View>
              <Text style={styles.statusDescription}>
                {status.label === 'Critical' 
                  ? 'Stock is critically low. Immediate restocking required!'
                  : status.label === 'Low'
                  ? 'Stock is running low. Consider restocking soon.'
                  : status.label === 'Warning'
                  ? 'Stock is below threshold level.'
                  : 'Stock level is adequate.'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {selectedItem ? (
            renderItemDetail()
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Search Inventory</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                  <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search inventory..."
                    placeholderTextColor="#666"
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
                      <Icon name="clear" size={20} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Results */}
              <View style={styles.resultsContainer}>
                {query.length < 2 ? (
                  <View style={styles.centerContainer}>
                    <Icon name="search" size={64} color="#333" />
                    <Text style={styles.hintText}>Type at least 2 characters to search</Text>
                  </View>
                ) : results.length === 0 ? (
                  <View style={styles.centerContainer}>
                    <Icon name="search-off" size={64} color="#333" />
                    <Text style={styles.hintText}>No items found</Text>
                  </View>
                ) : (
                  <FlatList
                    data={results}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.resultsList}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialog: {
    width: width * 0.95,
    maxHeight: height * 0.9,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#fff',
  },
  clearButton: {
    padding: 4,
  },
  resultsContainer: {
    minHeight: 200,
    maxHeight: 400,
  },
  centerContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  resultsList: {
    padding: 16,
    paddingTop: 0,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemImage: {
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    borderRadius: 8,
    backgroundColor: 'rgba(230, 0, 42, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  resultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  resultCategory: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  unitsText: {
    fontSize: 13,
    color: '#888',
  },
  // Detail view styles
  detailContainer: {
    maxHeight: height * 0.8,
  },
  detailScrollContent: {
    paddingBottom: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  detailHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  backButton: {
    padding: 8,
  },
  detailContent: {
    padding: 16,
    gap: 16,
    backgroundColor: '#1A1A1A',
  },
  itemHeader: {
    flexDirection: 'row',
    gap: 16,
  },
  itemHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  detailName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  detailCategory: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  stockInfoCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  stockInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  stockRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stockInfoItem: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
  stockInfoLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  stockInfoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  stockInfoUnit: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  packagingCard: {
    backgroundColor: 'rgba(30, 64, 175, 0.2)',
    borderRadius: 8,
    padding: 12,
  },
  packagingLabel: {
    fontSize: 12,
    color: '#1E40AF',
    marginBottom: 4,
  },
  packagingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  packagingRemainder: {
    fontSize: 12,
    color: 'rgba(30, 64, 175, 0.8)',
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  statusDescription: {
    flex: 1,
    fontSize: 13,
    color: '#888',
  },
});

export default SearchModal;
