import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { Item } from '../../models';
import { MainStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface StockEntry {
  item: Item;
  quantity: number;
  notes: string;
}

const RecordStockInScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { profile } = useAuthStore();

  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Item picker modal
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Receipt data
  const [receiptNumber, setReceiptNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getItems();
      setItems(data);
    } catch (error) {
      console.log('Load items error:', error);
      Alert.alert('Error', 'Failed to load items');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Exclude already added items
    const isAlreadyAdded = stockEntries.some((entry) => entry.item.id === item.id);
    
    return matchesSearch && !isAlreadyAdded;
  });

  const handleAddItem = (item: Item) => {
    setStockEntries((prev) => [
      ...prev,
      { item, quantity: 1, notes: '' },
    ]);
    setItemPickerVisible(false);
    setSearchQuery('');
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    setStockEntries((prev) =>
      prev.map((entry) =>
        entry.item.id === itemId ? { ...entry, quantity: Math.max(1, quantity) } : entry
      )
    );
  };

  const handleUpdateNotes = (itemId: string, notes: string) => {
    setStockEntries((prev) =>
      prev.map((entry) =>
        entry.item.id === itemId ? { ...entry, notes } : entry
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setStockEntries((prev) => prev.filter((entry) => entry.item.id !== itemId));
  };

  const handleSubmit = async () => {
    if (stockEntries.length === 0) {
      Alert.alert('No Items', 'Please add at least one item');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create receipt
      const receiptItems = stockEntries.map((entry) => ({
        item_id: entry.item.id!,
        quantity: entry.quantity,
        notes: entry.notes,
      }));
      
      await apiClient.createReceipt({
        receiptNumber: receiptNumber || undefined,
        supplier: supplier || undefined,
        notes: notes || undefined,
        items: receiptItems,
      });
      
      // Update stock quantities
      for (const entry of stockEntries) {
        await apiClient.updateStockQuantity(entry.item.id!, 'in', entry.quantity, 'Receipt stock in');
      }
      
      Alert.alert('Success', 'Stock recorded successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.log('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to record stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTotalItems = () => {
    return stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading items...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Receipt Info Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="receipt" size={20} color={Colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Receipt Information</Text>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Receipt Number (Optional)
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
              value={receiptNumber}
              onChangeText={setReceiptNumber}
              placeholder="e.g., REC-2024-001"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Supplier (Optional)
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
              value={supplier}
              onChangeText={setSupplier}
              placeholder="e.g., ABC Supplies"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Notes (Optional)
            </Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textArea,
                { backgroundColor: colors.surfaceVariant, color: colors.text },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Items Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <Icon name="inventory" size={20} color={Colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Items</Text>
            <TouchableOpacity
              style={[styles.addItemButton, { backgroundColor: Colors.primary }]}
              onPress={() => setItemPickerVisible(true)}
            >
              <Icon name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addItemButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
          
          {stockEntries.length === 0 ? (
            <View style={styles.emptyItems}>
              <Icon name="add-shopping-cart" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyItemsText, { color: colors.textSecondary }]}>
                No items added yet
              </Text>
              <Text style={[styles.emptyItemsSubtext, { color: colors.textSecondary }]}>
                Tap "Add Item" to start adding stock
              </Text>
            </View>
          ) : (
            stockEntries.map((entry) => (
              <View
                key={entry.item.id}
                style={[styles.entryCard, { backgroundColor: colors.surfaceVariant }]}
              >
                <View style={styles.entryHeader}>
                  {entry.item.photo_url ? (
                    <Image source={{ uri: entry.item.photo_url }} style={styles.entryImage} />
                  ) : (
                    <View style={[styles.entryImagePlaceholder, { backgroundColor: colors.background }]}>
                      <Icon name="inventory" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                  
                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryName, { color: colors.text }]} numberOfLines={1}>
                      {entry.item.name}
                    </Text>
                    <Text style={[styles.entrySku, { color: colors.textSecondary }]}>
                      SKU: {entry.item.sku}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveItem(entry.item.id!)}
                  >
                    <Icon name="close" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.entryQuantity}>
                  <Text style={[styles.quantityLabel, { color: colors.textSecondary }]}>Quantity:</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={[styles.quantityButton, { backgroundColor: colors.background }]}
                      onPress={() => handleUpdateQuantity(entry.item.id!, entry.quantity - 1)}
                    >
                      <Icon name="remove" size={20} color={colors.text} />
                    </TouchableOpacity>
                    
                    <TextInput
                      style={[styles.quantityInput, { backgroundColor: colors.background, color: colors.text }]}
                      value={entry.quantity.toString()}
                      onChangeText={(text) => handleUpdateQuantity(entry.item.id!, parseInt(text, 10) || 0)}
                      keyboardType="numeric"
                      textAlign="center"
                    />
                    
                    <TouchableOpacity
                      style={[styles.quantityButton, { backgroundColor: colors.background }]}
                      onPress={() => handleUpdateQuantity(entry.item.id!, entry.quantity + 1)}
                    >
                      <Icon name="add" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TextInput
                  style={[styles.entryNotes, { backgroundColor: colors.background, color: colors.text }]}
                  value={entry.notes}
                  onChangeText={(text) => handleUpdateNotes(entry.item.id!, text)}
                  placeholder="Item notes (optional)"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      {stockEntries.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.card }]}>
          <View style={styles.footerInfo}>
            <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>
              Total Items
            </Text>
            <Text style={[styles.footerValue, { color: colors.text }]}>
              {getTotalItems()} items
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: Colors.primary }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Icon name="check" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Record Stock In</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Item Picker Modal */}
      <Modal
        visible={itemPickerVisible}
        animationType="slide"
        onRequestClose={() => setItemPickerVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: Colors.primary }]}>
            <TouchableOpacity onPress={() => setItemPickerVisible(false)}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Item</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={[styles.modalSearch, { backgroundColor: colors.card }]}>
            <Icon name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.modalSearchInput, { color: colors.text }]}
              placeholder="Search items..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id!}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.itemPickerItem, { backgroundColor: colors.card }]}
                onPress={() => handleAddItem(item)}
              >
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.itemPickerImage} />
                ) : (
                  <View style={[styles.itemPickerImagePlaceholder, { backgroundColor: colors.surfaceVariant }]}>
                    <Icon name="inventory" size={24} color={colors.textSecondary} />
                  </View>
                )}
                
                <View style={styles.itemPickerInfo}>
                  <Text style={[styles.itemPickerName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemPickerSku, { color: colors.textSecondary }]}>
                    SKU: {item.sku}
                  </Text>
                </View>
                
                <Icon name="add-circle" size={24} color={Colors.success} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <Icon name="search-off" size={48} color={colors.textSecondary} />
                <Text style={[styles.modalEmptyText, { color: colors.textSecondary }]}>
                  No items found
                </Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  section: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  textInput: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyItemsText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  emptyItemsSubtext: {
    marginTop: Spacing.xs,
    fontSize: FontSizes.sm,
  },
  entryCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryImage: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  entryImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entryInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  entryName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  entrySku: {
    fontSize: FontSizes.sm,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  entryQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  quantityLabel: {
    fontSize: FontSizes.sm,
    marginRight: Spacing.md,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 60,
    height: 36,
    borderRadius: BorderRadius.sm,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  entryNotes: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  footerInfo: {
    flex: 1,
  },
  footerLabel: {
    fontSize: FontSizes.sm,
  },
  footerValue: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingTop: Spacing.xl + Spacing.md,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: FontSizes.md,
  },
  modalList: {
    padding: Spacing.md,
  },
  itemPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  itemPickerImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  itemPickerImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemPickerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemPickerName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  itemPickerSku: {
    fontSize: FontSizes.sm,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  modalEmptyText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
});

export default RecordStockInScreen;
