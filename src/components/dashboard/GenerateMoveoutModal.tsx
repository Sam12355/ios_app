import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { StockItem } from '../../models';

// Design System Colors
const colors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardBackground: '#2D2D2D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  errorRed: '#EF4444',
  borderColor: '#404040',
  inputBorder: '#E6002A',
  disabledGray: '#4A4A4A',
};

interface MoveoutListItemData {
  itemId: string;
  itemName: string;
  category: string;
  currentQuantity: number;
  requestingQuantity: number;
}

interface GenerateMoveoutModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GenerateMoveoutModal: React.FC<GenerateMoveoutModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  // State
  const [availableStock, setAvailableStock] = useState<StockItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<StockItem[]>([]);
  const [tableItems, setTableItems] = useState<MoveoutListItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Load stock data when modal opens
  useEffect(() => {
    if (visible) {
      loadStockData();
    } else {
      // Reset state when modal closes
      setSelectedItems([]);
      setTableItems([]);
      setSearchText('');
      setShowDropdown(false);
      setErrorMsg(null);
    }
  }, [visible]);

  const loadStockData = async () => {
    setIsLoading(true);
    try {
      const stocks = await apiClient.getStockData();
      // Filter stocks with quantity > 0
      const availableStocks = stocks.filter(
        (stock) => (stock.current_quantity ?? 0) > 0
      );
      setAvailableStock(availableStocks);
      console.log('Loaded stock items:', availableStocks.length);
    } catch (error) {
      console.log('Failed to load stock:', error);
      setErrorMsg('Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter items based on search text
  const filteredItems = useCallback(() => {
    if (!searchText.trim()) {
      return [];
    }

    const addedIds = new Set(tableItems.map((item) => item.itemId));
    const selectedIds = new Set(selectedItems.map((item) => item.item_id || ''));

    return availableStock.filter((stock) => {
      const itemName = stock.items?.name || '';
      const matchesSearch = itemName.toLowerCase().includes(searchText.toLowerCase());
      const notAdded = !addedIds.has(stock.item_id || '');
      const notSelected = !selectedIds.has(stock.item_id || '');
      return matchesSearch && notAdded && notSelected;
    });
  }, [searchText, availableStock, tableItems, selectedItems]);

  // Handle item selection from dropdown
  const handleSelectItem = (stock: StockItem) => {
    setSelectedItems((prev) => [...prev, stock]);
    setSearchText('');
    setShowDropdown(false);
    Keyboard.dismiss();
  };

  // Remove selected chip
  const handleRemoveSelectedItem = (stock: StockItem) => {
    setSelectedItems((prev) => prev.filter((item) => item.item_id !== stock.item_id));
  };

  // Add selected items to table
  const handleAddToList = () => {
    const newTableItems = selectedItems.map((stock) => ({
      itemId: stock.item_id || '',
      itemName: stock.items?.name || '',
      category: stock.items?.category || 'General',
      currentQuantity: stock.current_quantity ?? 0,
      requestingQuantity: 1,
    }));

    setTableItems((prev) => [...prev, ...newTableItems]);
    setSelectedItems([]);
    setSearchText('');
  };

  // Remove item from table
  const handleRemoveTableItem = (index: number) => {
    setTableItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update requesting quantity
  const handleQuantityChange = (index: number, value: string) => {
    const qty = parseInt(value, 10) || 0;
    setTableItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, requestingQuantity: qty } : item
      )
    );
  };

  // Validate and generate list
  const handleGenerate = async () => {
    if (tableItems.length === 0) {
      setErrorMsg('Please add items to the list');
      return;
    }

    // Validate quantities
    const hasErrors = tableItems.some(
      (item) =>
        item.requestingQuantity > item.currentQuantity ||
        item.requestingQuantity < 1
    );

    if (hasErrors) {
      setErrorMsg('Please fix quantity errors');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await apiClient.createMoveoutList({
        title: 'Moveout List',
        description: 'Generated from mobile app',
        items: tableItems.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          availableAmount: item.currentQuantity,
          requestAmount: item.requestingQuantity,
          category: item.category,
        })),
      });

      console.log('✅ Moveout list created successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.log('Failed to create moveout list:', error);
      setErrorMsg('Failed to create moveout list');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = filteredItems();
  const canGenerate = tableItems.length > 0 && !isSaving;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Generate Moveout List</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primaryRed} />
              <Text style={styles.loadingText}>Loading stock data...</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Select Items Section */}
              <Text style={styles.sectionLabel}>Select Items</Text>

              {/* Search Input with Red Border */}
              <View style={styles.searchContainer}>
                <Icon name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search Items"
                  placeholderTextColor={colors.textMuted}
                  value={searchText}
                  onChangeText={(text) => {
                    setSearchText(text);
                    setShowDropdown(text.length > 0);
                  }}
                  onFocus={() => setShowDropdown(searchText.length > 0)}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchText('');
                      setShowDropdown(false);
                    }}
                  >
                    <Icon name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Dropdown Results */}
              {showDropdown && filtered.length > 0 && (
                <View style={styles.dropdown}>
                  {filtered.slice(0, 5).map((stock) => (
                    <TouchableOpacity
                      key={stock.item_id}
                      style={styles.dropdownItem}
                      onPress={() => handleSelectItem(stock)}
                    >
                      <Text style={styles.dropdownItemText}>
                        {stock.items?.name} (Current: {stock.current_quantity})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected Chips */}
              {selectedItems.length > 0 && (
                <View style={styles.chipsContainer}>
                  {selectedItems.map((stock) => (
                    <View key={stock.item_id} style={styles.chip}>
                      <Text style={styles.chipText}>
                        {stock.items?.name} ({stock.current_quantity})
                      </Text>
                      <TouchableOpacity onPress={() => handleRemoveSelectedItem(stock)}>
                        <Icon name="close" size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add to List Button */}
              <TouchableOpacity
                style={[
                  styles.addButton,
                  selectedItems.length === 0 && styles.addButtonDisabled,
                ]}
                onPress={handleAddToList}
                disabled={selectedItems.length === 0}
              >
                <Icon name="add" size={18} color={colors.textPrimary} />
                <Text style={styles.addButtonText}>Add to List</Text>
              </TouchableOpacity>

              {/* Moveout List Items Table */}
              {tableItems.length > 0 && (
                <View style={styles.tableSection}>
                  <Text style={styles.sectionLabel}>Moveout List Items</Text>

                  {tableItems.map((item, index) => (
                    <View key={`${item.itemId}-${index}`} style={styles.tableItem}>
                      {/* Item Header with Name and Delete */}
                      <View style={styles.tableItemHeader}>
                        <Text style={styles.tableItemName}>{item.itemName}</Text>
                        <TouchableOpacity onPress={() => handleRemoveTableItem(index)}>
                          <Icon name="delete-outline" size={24} color={colors.errorRed} />
                        </TouchableOpacity>
                      </View>

                      {/* Quantities Row */}
                      <View style={styles.quantitiesRow}>
                        {/* Current Quantity */}
                        <View style={styles.quantityColumn}>
                          <Text style={styles.quantityLabel}>Current Quantity</Text>
                          <Text style={styles.quantityValue}>{item.currentQuantity}</Text>
                        </View>

                        {/* Requesting Quantity */}
                        <View style={styles.quantityColumn}>
                          <Text style={styles.quantityLabel}>Requesting Quantity</Text>
                          <TextInput
                            style={[
                              styles.quantityInput,
                              item.requestingQuantity > item.currentQuantity && styles.quantityInputError,
                            ]}
                            value={item.requestingQuantity.toString()}
                            onChangeText={(value) => handleQuantityChange(index, value)}
                            keyboardType="number-pad"
                            selectTextOnFocus
                          />
                          {item.requestingQuantity > item.currentQuantity && (
                            <Text style={styles.quantityError}>
                              Max: {item.currentQuantity}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Error Message */}
              {errorMsg && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer Buttons */}
          {!isLoading && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.generateButton,
                  !canGenerate && styles.generateButtonDisabled,
                ]}
                onPress={handleGenerate}
                disabled={!canGenerate}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={styles.generateButtonText}>Generate</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 0,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
  },
  dropdown: {
    backgroundColor: colors.surfaceDark,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.borderColor,
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
  },
  dropdownItemText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryRed,
    borderRadius: 24,
    paddingVertical: 12,
    marginTop: 16,
    gap: 8,
  },
  addButtonDisabled: {
    backgroundColor: colors.disabledGray,
  },
  addButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  tableSection: {
    marginTop: 24,
  },
  tableItem: {
    backgroundColor: colors.surfaceDark,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  tableItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tableItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
  },
  quantitiesRow: {
    flexDirection: 'row',
    gap: 16,
  },
  quantityColumn: {
    flex: 1,
  },
  quantityLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  quantityInput: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 16,
  },
  quantityInputError: {
    borderColor: colors.errorRed,
  },
  quantityError: {
    fontSize: 11,
    color: colors.errorRed,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: colors.errorRed,
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  cancelButtonText: {
    color: colors.primaryRed,
    fontSize: 15,
    fontWeight: '600',
  },
  generateButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: colors.primaryRed,
  },
  generateButtonDisabled: {
    backgroundColor: colors.disabledGray,
  },
  generateButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default GenerateMoveoutModal;
