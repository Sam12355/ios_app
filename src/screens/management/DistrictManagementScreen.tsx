import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { District, Region } from '../../models/Inventory';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

export const DistrictManagementScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    region_id: '',
    description: '',
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchData = useCallback(async () => {
    try {
      const [districtsData, regionsData] = await Promise.all([
        apiClient.getDistricts(),
        apiClient.getRegions(),
      ]);
      setDistricts(districtsData || []);
      setRegions(regionsData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      Alert.alert('Error', 'Failed to load districts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getRegionName = (regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    return region?.name || 'Unknown Region';
  };

  const handleAdd = () => {
    setEditingDistrict(null);
    setFormData({ name: '', code: '', region_id: '', description: '' });
    setModalVisible(true);
  };

  const handleEdit = (district: District) => {
    setEditingDistrict(district);
    setFormData({
      name: district.name,
      code: district.code || '',
      region_id: district.region_id || '',
      description: district.description || '',
    });
    setModalVisible(true);
  };

  const handleDelete = (district: District) => {
    Alert.alert(
      'Delete District',
      `Are you sure you want to delete "${district.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteDistrict(district.id);
              fetchData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete district');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'District name is required');
      return;
    }

    try {
      if (editingDistrict) {
        await apiClient.updateDistrict(editingDistrict.id, formData);
      } else {
        await apiClient.createDistrict(formData);
      }
      setModalVisible(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', `Failed to ${editingDistrict ? 'update' : 'create'} district`);
    }
  };

  const filteredDistricts = districts.filter(district => {
    const matchesSearch = district.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (district.code && district.code.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRegion = selectedRegion === 'all' || district.region_id === selectedRegion;
    return matchesSearch && matchesRegion;
  });

  const renderDistrictItem = ({ item }: { item: District }) => (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: colors.secondary + '20' }]}>
          <Icon name="location-city" size={24} color={colors.secondary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.districtName, { color: colors.onSurface }]}>
            {item.name}
          </Text>
          {item.code && (
            <Text style={[styles.districtCode, { color: colors.onSurfaceVariant }]}>
              Code: {item.code}
            </Text>
          )}
          <View style={styles.regionTag}>
            <Icon name="public" size={14} color={colors.primary} />
            <Text style={[styles.regionText, { color: colors.primary }]}>
              {getRegionName(item.region_id || '')}
            </Text>
          </View>
          {item.description && (
            <Text style={[styles.description, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>
      
      {isAdmin && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary + '15' }]}
            onPress={() => handleEdit(item)}
          >
            <Icon name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error + '15' }]}
            onPress={() => handleDelete(item)}
          >
            <Icon name="delete" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.outline,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.onSurface,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 4,
    },
    addButtonText: {
      color: colors.onPrimary,
      fontWeight: '600',
    },
    filterContainer: {
      padding: 16,
      gap: 12,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      fontSize: 16,
      color: colors.onSurface,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
    },
    filterChipTextActive: {
      color: colors.onPrimary,
    },
    listContainer: {
      padding: 16,
      paddingTop: 0,
    },
    card: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    cardContent: {
      flex: 1,
    },
    districtName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    districtCode: {
      fontSize: 14,
      marginBottom: 4,
    },
    regionTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    regionText: {
      fontSize: 13,
      fontWeight: '500',
    },
    description: {
      fontSize: 13,
      marginTop: 4,
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
      gap: 8,
    },
    actionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.onSurface,
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.onSurfaceVariant,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.onSurface,
      borderWidth: 1,
      borderColor: colors.outline,
      marginBottom: 16,
    },
    selectInput: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectText: {
      fontSize: 16,
      color: colors.onSurface,
    },
    selectPlaceholder: {
      color: colors.onSurfaceVariant,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 8,
    },
    modalButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    cancelButton: {
      backgroundColor: colors.surfaceVariant,
    },
    submitButton: {
      backgroundColor: colors.primary,
    },
    cancelButtonText: {
      color: colors.onSurfaceVariant,
      fontWeight: '600',
    },
    submitButtonText: {
      color: colors.onPrimary,
      fontWeight: '600',
    },
    pickerModalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      maxHeight: '60%',
    },
    pickerItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    pickerItemSelected: {
      backgroundColor: colors.primary + '20',
    },
    pickerItemText: {
      fontSize: 16,
      color: colors.onSurface,
    },
    pickerItemTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loader]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Districts</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Icon name="add" size={20} color={colors.onPrimary} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={colors.onSurfaceVariant} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search districts..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedRegion === 'all' && styles.filterChipActive,
              ]}
              onPress={() => setSelectedRegion('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedRegion === 'all' && styles.filterChipTextActive,
                ]}
              >
                All Regions
              </Text>
            </TouchableOpacity>
            {regions.map((region) => (
              <TouchableOpacity
                key={region.id}
                style={[
                  styles.filterChip,
                  selectedRegion === region.id && styles.filterChipActive,
                ]}
                onPress={() => setSelectedRegion(region.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedRegion === region.id && styles.filterChipTextActive,
                  ]}
                >
                  {region.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <FlatList
        data={filteredDistricts}
        keyExtractor={(item) => item.id}
        renderItem={renderDistrictItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="location-city" size={64} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>No districts found</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingDistrict ? 'Edit District' : 'Add District'}
            </Text>

            <ScrollView>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter district name"
                placeholderTextColor={colors.onSurfaceVariant}
              />

              <Text style={styles.inputLabel}>Code</Text>
              <TextInput
                style={styles.input}
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text })}
                placeholder="Enter district code"
                placeholderTextColor={colors.onSurfaceVariant}
              />

              <Text style={styles.inputLabel}>Region</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectInput]}
                onPress={() => setRegionPickerVisible(true)}
              >
                <Text
                  style={[
                    styles.selectText,
                    !formData.region_id && styles.selectPlaceholder,
                  ]}
                >
                  {formData.region_id
                    ? getRegionName(formData.region_id)
                    : 'Select region'}
                </Text>
                <Icon name="arrow-drop-down" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Enter description"
                placeholderTextColor={colors.onSurfaceVariant}
                multiline
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>
                  {editingDistrict ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Region Picker Modal */}
      <Modal
        visible={regionPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRegionPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.modalTitle}>Select Region</Text>
            <ScrollView>
              {regions.map((region) => (
                <TouchableOpacity
                  key={region.id}
                  style={[
                    styles.pickerItem,
                    formData.region_id === region.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, region_id: region.id });
                    setRegionPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      formData.region_id === region.id && styles.pickerItemTextSelected,
                    ]}
                  >
                    {region.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DistrictManagementScreen;
