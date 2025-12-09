import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    PermissionsAndroid,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

import apiClient from '../../api/ApiClient';
import { Item } from '../../models';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

// Toast helper function using react-native-toast-message
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  Toast.show({
    type,
    text1: message,
    position: 'bottom',
    visibilityTime: 2500,
  });
};

// Design Colors matching Android
const designColors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardDark: '#2D2D2D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  editBlue: '#0EA5E9',
  deleteRed: '#EF4444',
  warningOrange: '#F59E0B',
  infoCyan: '#0EA5E9',
  divider: '#3D3D3D',
};

const CATEGORIES = [
  'Gronsakshuset',
  'Kvalitetsfisk', 
  'Spendrups',
  'Tingstad',
  'Other',
];

const ItemsScreen = () => {
  const { colors, isDarkMode } = useTheme();
  const { profile } = useAuthStore();
  const isManager = profile?.role === 'manager' || profile?.role === 'assistant_manager' || profile?.role === 'admin';

  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  
  // Modal states
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  
  // Form fields - matching Kotlin AddEditItemDialog
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    photo_url: '',
    storage_temperature: '',
    base_unit: 'piece',
    enable_packaging: false,
    packaging_unit: '',
    units_per_package: '',
    threshold_level: '',
    low_level: '',
    critical_level: '',
  });
  
  // Dropdown visibility states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showBaseUnitDropdown, setShowBaseUnitDropdown] = useState(false);
  const [showPackagingUnitDropdown, setShowPackagingUnitDropdown] = useState(false);
  
  // Validation errors
  const [formErrors, setFormErrors] = useState({
    name: '',
    category: '',
    threshold_level: '',
  });
  
  const BASE_UNITS = ['piece', 'kg', 'gram', 'liter', 'ml'];
  const PACKAGING_UNITS = ['box', 'carton', 'case', 'packet', 'bag', 'crate'];

  const loadItems = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    try {
      const data = await apiClient.getItems();
      setItems(data);
    } catch (error) {
      console.log('Load items error:', error);
      Alert.alert('Error', 'Failed to load items');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadItems(true);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [items, searchQuery]);

  const handleAddItem = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: '',
      description: '',
      photo_url: '',
      storage_temperature: '',
      base_unit: 'piece',
      enable_packaging: false,
      packaging_unit: '',
      units_per_package: '',
      threshold_level: '',
      low_level: '',
      critical_level: '',
    });
    setFormErrors({ name: '', category: '', threshold_level: '' });
    setItemModalVisible(true);
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || '',
      description: item.description || '',
      photo_url: item.photo_url || item.image_url || '',
      storage_temperature: item.storage_temperature?.toString() || '',
      base_unit: item.base_unit || item.unit || 'piece',
      enable_packaging: item.enable_packaging || false,
      packaging_unit: item.packaging_unit || '',
      units_per_package: item.units_per_package?.toString() || '',
      threshold_level: item.threshold_level?.toString() || '',
      low_level: item.low_level?.toString() || '',
      critical_level: item.critical_level?.toString() || '',
    });
    setFormErrors({ name: '', category: '', threshold_level: '' });
    setItemModalVisible(true);
  };

  const handleDeleteItem = (item: Item) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    
    try {
      await apiClient.deleteItem(itemToDelete.id!);
      setShowDeleteDialog(false);
      setItemToDelete(null);
      showToast('Item deleted successfully');
      loadItems(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete item');
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleDeleteItemLegacy = (item: Item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteItem(item.id!);
              loadItems(true);
              Alert.alert('Success', 'Item deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handlePickImage = async () => {
    // Show action sheet to choose camera or library
    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => openCamera(),
        },
        {
          text: 'Choose from Library',
          onPress: () => openImageLibrary(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCamera = async () => {
    try {
      // Request camera permission on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'StockNexus needs access to your camera to take photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.6,
        maxWidth: 400,
        maxHeight: 400,
        includeBase64: true,
        saveToPhotos: false,
      });

      handleImageResult(result);
    } catch (error: any) {
      console.log('Camera error:', error);
      Alert.alert('Error', error.message || 'Failed to open camera');
    }
  };

  const openImageLibrary = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.6,
        maxWidth: 400,
        maxHeight: 400,
        includeBase64: true,
        selectionLimit: 1,
      });

      handleImageResult(result);
    } catch (error: any) {
      console.log('Image library error:', error);
      // If permission issue on iOS, guide user to settings
      if (Platform.OS === 'ios') {
        Alert.alert(
          'Photo Access Required',
          'Please allow StockNexus to access your photos in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to open photo library');
      }
    }
  };

  const handleImageResult = (result: any) => {
    // User cancelled
    if (result.didCancel) {
      return;
    }

    // Handle error
    if (result.errorCode) {
      console.log('Image picker error code:', result.errorCode, result.errorMessage);
      if (result.errorCode === 'permission') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to pick images.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else if (result.errorCode === 'camera_unavailable') {
        Alert.alert('Error', 'Camera is not available on this device.');
      } else {
        Alert.alert('Error', result.errorMessage || 'Could not pick image');
      }
      return;
    }

    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        // Create data URL from base64
        const mimeType = asset.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${asset.base64}`;
        setFormData((prev) => ({ ...prev, photo_url: dataUrl }));
        showToast('Image selected');
      } else if (asset.uri) {
        // Fallback to URI if base64 not available
        setFormData((prev) => ({ ...prev, photo_url: asset.uri! }));
        showToast('Image selected');
      }
    }
  };

  const handleSubmit = async () => {
    // Validation matching Kotlin
    let hasError = false;
    const errors = { name: '', category: '', threshold_level: '' };
    
    if (!formData.name.trim()) {
      errors.name = 'Required';
      hasError = true;
    }
    if (!formData.category) {
      errors.category = 'Required';
      hasError = true;
    }
    if (!formData.threshold_level.trim()) {
      errors.threshold_level = 'Required';
      hasError = true;
    }
    
    setFormErrors(errors);
    if (hasError) return;
    
    setIsSubmitting(true);
    
    try {
      // Match exact payload format as web/Kotlin - include branch_id and created_by
      const itemData: Record<string, any> = {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim() || null,
        image_url: formData.photo_url || null,
        storage_temperature: formData.storage_temperature ? parseFloat(formData.storage_temperature) : null,
        base_unit: formData.base_unit,
        enable_packaging: formData.enable_packaging,
        packaging_unit: formData.enable_packaging ? formData.packaging_unit : null,
        units_per_package: formData.enable_packaging && formData.units_per_package 
          ? parseInt(formData.units_per_package, 10) : null,
        threshold_level: parseInt(formData.threshold_level, 10),
        low_level: formData.low_level ? parseInt(formData.low_level, 10) : 5,
        critical_level: formData.critical_level ? parseInt(formData.critical_level, 10) : 2,
        branch_id: profile?.branchId || null,
        created_by: profile?.id || null,
      };
      
      console.log('Creating item with data:', JSON.stringify(itemData));
      
      if (editingItem) {
        await apiClient.updateItem(editingItem.id!, itemData as Partial<Item>);
        showToast('Item updated successfully');
      } else {
        await apiClient.createItem(itemData as Item);
        showToast('Item created successfully');
      }
      
      setItemModalVisible(false);
      loadItems(true);
    } catch (error: any) {
      console.log('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get valid image source
  const getImageSource = (item: Item) => {
    const imageUrl = item.photo_url || item.image_url;
    if (!imageUrl) return null;
    // Handle both regular URLs and data URLs (base64)
    return { uri: imageUrl };
  };

  // Item Card matching Android ItemTableRow
  const renderItem = ({ item }: { item: Item }) => {
    const imageSource = getImageSource(item);
    
    return (
    <View style={styles.itemCard}>
      {/* Header row with image, name, and actions */}
      <View style={styles.itemHeader}>
        {/* Item image and name */}
        <View style={styles.itemHeaderLeft}>
          {imageSource ? (
            <Image source={imageSource} style={styles.itemImage} />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <Icon name="inventory" size={30} color={designColors.textMuted} />
            </View>
          )}
          
          <View style={styles.itemNameContainer}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemCreatedDate}>
              Created {formatDate(item.created_at)}
            </Text>
          </View>
        </View>
        
        {/* Action buttons */}
        {isManager && (
          <View style={styles.itemActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEditItem(item)}
            >
              <Icon name="edit" size={22} color={designColors.editBlue} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteItem(item)}
            >
              <Icon name="delete" size={22} color={designColors.deleteRed} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <View style={styles.itemDivider} />
      
      {/* Details section */}
      <View style={styles.itemDetails}>
        {/* Category */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category:</Text>
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          ) : (
            <Text style={styles.detailValueMuted}>Not specified</Text>
          )}
        </View>
        
        {/* Description */}
        {item.description && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description:</Text>
            <Text style={styles.detailValue} numberOfLines={2}>{item.description}</Text>
          </View>
        )}
        
        {/* Storage Temperature - matching Kotlin */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Storage Temp:</Text>
          {item.storage_temperature != null ? (
            <View style={styles.storageTempContainer}>
              <Icon name="ac-unit" size={18} color={designColors.infoCyan} />
              <Text style={styles.storageTempValue}>{item.storage_temperature}°C</Text>
            </View>
          ) : (
            <Text style={styles.detailValueMuted}>Not specified</Text>
          )}
        </View>
        
        {/* Threshold Level */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Threshold Level:</Text>
          <View style={styles.thresholdContainer}>
            <Icon name="warning" size={18} color={designColors.warningOrange} />
            <Text style={styles.thresholdValue}>{item.threshold_level || 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={designColors.primaryRed} />
        <Text style={styles.loadingText}>Loading items...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header section matching Android */}
      <View style={styles.headerSection}>
        {/* Add Item button and Search icon */}
        <View style={styles.headerRow}>
          {isManager && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddItem}>
              <Icon name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.searchToggle}
            onPress={() => setShowSearchBar(!showSearchBar)}
          >
            <Icon 
              name={showSearchBar ? 'close' : 'search'} 
              size={24} 
              color={designColors.textPrimary} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Search bar - shows below when search icon is clicked */}
        {showSearchBar && (
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color={designColors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              placeholderTextColor={designColors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close" size={20} color={designColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      
      <View style={styles.divider} />

      {/* Items List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id!}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[designColors.primaryRed]}
            tintColor={designColors.primaryRed}
          />
        }
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            Manage Items ({filteredItems.length})
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={64} color={designColors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery === '' ? 'No items yet' : 'No items found'}
            </Text>
          </View>
        }
      />

      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteDialog(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContent}>
            <Icon name="delete" size={32} color={designColors.textPrimary} />
            <Text style={styles.dialogTitle}>Delete Item</Text>
            <Text style={styles.dialogMessage}>
              Are you sure you want to delete '{itemToDelete?.name}'? This action cannot be undone.
            </Text>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogButtonCancel}
                onPress={() => setShowDeleteDialog(false)}
              >
                <Text style={styles.dialogButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogButtonDelete}
                onPress={confirmDeleteItem}
              >
                <Text style={styles.dialogButtonDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Item Modal - matching Kotlin AddEditItemDialog */}
      <Modal
        visible={itemModalVisible}
        animationType="slide"
        onRequestClose={() => !isSubmitting && setItemModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Edit Item' : 'Add Item'}
            </Text>
          </View>
          
          <View style={styles.modalDivider} />

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Basic Details Section */}
            <Text style={styles.sectionLabel}>BASIC ITEM DETAILS</Text>
            
            {/* Item Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={[styles.textInput, formErrors.name ? styles.textInputError : null]}
                value={formData.name}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, name: text }));
                  setFormErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Enter item name"
                placeholderTextColor={designColors.textSecondary}
              />
              {formErrors.name ? (
                <Text style={styles.errorText}>{formErrors.name}</Text>
              ) : null}
            </View>

            {/* Category Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, formErrors.category ? styles.textInputError : null]}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <Text style={formData.category ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {formData.category || 'Select category'}
                </Text>
                <Icon name={showCategoryDropdown ? 'arrow-drop-up' : 'arrow-drop-down'} size={24} color={designColors.textSecondary} />
              </TouchableOpacity>
              {showCategoryDropdown && (
                <View style={styles.dropdownMenu}>
                  {CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData((prev) => ({ ...prev, category }));
                        setFormErrors((prev) => ({ ...prev, category: '' }));
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {formErrors.category ? (
                <Text style={styles.errorText}>{formErrors.category}</Text>
              ) : null}
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
                placeholder="Enter item description"
                placeholderTextColor={designColors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Item Image - Tap to pick from gallery */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Item Image</Text>
              <View style={styles.imagePickerContainer}>
                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
                  {formData.photo_url ? (
                    <View style={styles.imagePreviewWrapper}>
                      <Image 
                        source={{ uri: formData.photo_url }} 
                        style={styles.imagePreview} 
                      />
                      <View style={styles.imageOverlay}>
                        <Icon name="camera-alt" size={24} color="#FFFFFF" />
                        <Text style={styles.imageOverlayText}>Tap to change</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Icon name="add-a-photo" size={40} color={designColors.textMuted} />
                      <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {formData.photo_url && (
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => setFormData((prev) => ({ ...prev, photo_url: '' }))}
                  >
                    <Icon name="delete" size={18} color={designColors.deleteRed} />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Storage Temperature */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Storage Temperature (°C)</Text>
              <View style={styles.inputWithIcon}>
                <Icon name="ac-unit" size={20} color={designColors.infoCyan} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { flex: 1, paddingLeft: 40 }]}
                  value={formData.storage_temperature}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, storage_temperature: text }))}
                  placeholder="e.g., 4"
                  placeholderTextColor={designColors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.sectionLabel}>UNIT OF MEASUREMENT</Text>

            {/* Base Unit Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Base Unit *</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowBaseUnitDropdown(!showBaseUnitDropdown)}
              >
                <Text style={styles.dropdownValue}>
                  {formData.base_unit.charAt(0).toUpperCase() + formData.base_unit.slice(1)}
                </Text>
                <Icon name={showBaseUnitDropdown ? 'arrow-drop-up' : 'arrow-drop-down'} size={24} color={designColors.textSecondary} />
              </TouchableOpacity>
              {showBaseUnitDropdown && (
                <View style={styles.dropdownMenu}>
                  {BASE_UNITS.map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData((prev) => ({ ...prev, base_unit: unit }));
                        setShowBaseUnitDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Enable Packaging Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFormData((prev) => ({ ...prev, enable_packaging: !prev.enable_packaging }))}
            >
              <View style={[styles.checkbox, formData.enable_packaging && styles.checkboxChecked]}>
                {formData.enable_packaging && (
                  <Icon name="check" size={16} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Enable Packaging</Text>
            </TouchableOpacity>

            {/* Packaging fields - show only if enabled */}
            {formData.enable_packaging && (
              <View style={styles.packagingRow}>
                {/* Packaging Unit Dropdown */}
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Packaging Unit</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setShowPackagingUnitDropdown(!showPackagingUnitDropdown)}
                  >
                    <Text style={formData.packaging_unit ? styles.dropdownValue : styles.dropdownPlaceholder}>
                      {formData.packaging_unit 
                        ? formData.packaging_unit.charAt(0).toUpperCase() + formData.packaging_unit.slice(1)
                        : 'Select'
                      }
                    </Text>
                    <Icon name={showPackagingUnitDropdown ? 'arrow-drop-up' : 'arrow-drop-down'} size={24} color={designColors.textSecondary} />
                  </TouchableOpacity>
                  {showPackagingUnitDropdown && (
                    <View style={styles.dropdownMenu}>
                      {PACKAGING_UNITS.map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFormData((prev) => ({ ...prev, packaging_unit: unit }));
                            setShowPackagingUnitDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Units Per Package */}
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Units/Package</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.units_per_package}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, units_per_package: text }))}
                    placeholder="e.g., 12"
                    placeholderTextColor={designColors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>THRESHOLD DETAILS</Text>

            {/* Threshold Level */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Threshold Level *</Text>
              <TextInput
                style={[styles.textInput, formErrors.threshold_level ? styles.textInputError : null]}
                value={formData.threshold_level}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, threshold_level: text }));
                  setFormErrors((prev) => ({ ...prev, threshold_level: '' }));
                }}
                placeholder="Enter threshold level"
                placeholderTextColor={designColors.textSecondary}
                keyboardType="numeric"
              />
              {formErrors.threshold_level ? (
                <Text style={styles.errorText}>{formErrors.threshold_level}</Text>
              ) : null}
            </View>

            {/* Low Level */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Low Level (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={formData.low_level}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, low_level: text }))}
                placeholder="Default: 5"
                placeholderTextColor={designColors.textSecondary}
                keyboardType="numeric"
              />
            </View>

            {/* Critical Level */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Critical Level (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={formData.critical_level}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, critical_level: text }))}
                placeholder="Default: 2"
                placeholderTextColor={designColors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </ScrollView>
          
          {/* Action Buttons */}
          <View style={styles.modalDivider} />
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => !isSubmitting && setItemModalVisible(false)}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingItem ? 'Update' : 'Add'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designColors.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: designColors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: designColors.textSecondary,
  },
  headerSection: {
    backgroundColor: designColors.surfaceDark,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColors.primaryRed,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchToggle: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColors.primaryRed,
    backgroundColor: designColors.cardDark,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: designColors.textPrimary,
    paddingVertical: 0,
  },
  divider: {
    height: 1,
    backgroundColor: designColors.divider,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginBottom: 16,
  },
  // Item Card - matching Android ItemTableRow
  itemCard: {
    backgroundColor: designColors.cardDark,
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemNameContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColors.textPrimary,
  },
  itemCreatedDate: {
    fontSize: 12,
    color: designColors.textMuted,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDivider: {
    height: 1,
    backgroundColor: designColors.divider,
    marginVertical: 12,
  },
  itemDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: designColors.textMuted,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: designColors.textPrimary,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  detailValueMuted: {
    fontSize: 13,
    color: designColors.textMuted,
    fontStyle: 'italic',
  },
  categoryBadge: {
    backgroundColor: designColors.primaryRed + '1A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    color: designColors.primaryRed,
    fontSize: 13,
    fontWeight: '500',
  },
  thresholdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thresholdValue: {
    fontSize: 14,
    fontWeight: '500',
    color: designColors.textPrimary,
  },
  storageTempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storageTempValue: {
    fontSize: 14,
    fontWeight: '500',
    color: designColors.textPrimary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: designColors.textMuted,
  },
  // Delete Dialog
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContent: {
    backgroundColor: designColors.cardDark,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: designColors.textPrimary,
    marginTop: 12,
  },
  dialogMessage: {
    fontSize: 14,
    color: designColors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  dialogButtons: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  dialogButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dialogButtonCancelText: {
    color: designColors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  dialogButtonDelete: {
    flex: 1,
    backgroundColor: designColors.deleteRed,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dialogButtonDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: designColors.surfaceDark,
  },
  modalHeader: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: designColors.textPrimary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: designColors.divider,
  },
  modalContent: {
    padding: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: designColors.textMuted,
    marginBottom: 12,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: designColors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColors.divider,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: designColors.textPrimary,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  categorySelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: designColors.cardDark,
    borderWidth: 1,
    borderColor: designColors.divider,
  },
  categoryOptionActive: {
    backgroundColor: designColors.primaryRed,
    borderColor: designColors.primaryRed,
  },
  categoryOptionText: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
  categoryOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  unitSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: designColors.cardDark,
    borderWidth: 1,
    borderColor: designColors.divider,
  },
  unitOptionActive: {
    backgroundColor: designColors.primaryRed,
    borderColor: designColors.primaryRed,
  },
  unitOptionText: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
  unitOptionTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flex: 1,
  },
  cancelButtonText: {
    color: designColors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: designColors.primaryRed,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Dropdown styles - matching Kotlin ExposedDropdownMenuBox
  dropdownButton: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColors.divider,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: {
    fontSize: 16,
    color: designColors.textPrimary,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: designColors.textSecondary,
  },
  dropdownMenu: {
    backgroundColor: designColors.cardDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColors.divider,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: designColors.divider,
  },
  dropdownItemText: {
    fontSize: 16,
    color: designColors.textPrimary,
  },
  // Checkbox styles - matching Kotlin Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: designColors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: designColors.primaryRed,
    borderColor: designColors.primaryRed,
  },
  checkboxLabel: {
    fontSize: 14,
    color: designColors.textPrimary,
  },
  // Packaging row
  packagingRow: {
    flexDirection: 'row',
  },
  // Input with icon
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: 14,
    zIndex: 1,
  },
  // Error styles
  textInputError: {
    borderColor: designColors.deleteRed,
  },
  errorText: {
    fontSize: 12,
    color: designColors.deleteRed,
    marginTop: 4,
  },
  // Image picker styles
  imagePickerContainer: {
    alignItems: 'center',
  },
  imagePreviewWrapper: {
    position: 'relative',
  },
  imagePreview: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 2,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: designColors.cardDark,
    borderWidth: 2,
    borderColor: designColors.divider,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: designColors.textMuted,
    marginTop: 8,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  pickImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColors.primaryRed,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  pickImageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  removeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    gap: 4,
  },
  removeImageText: {
    color: designColors.deleteRed,
    fontSize: 13,
  },
});

export default ItemsScreen;
