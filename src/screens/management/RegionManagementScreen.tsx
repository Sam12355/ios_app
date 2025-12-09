import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { Region } from '../../models/Inventory';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

export const RegionManagementScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const fetchRegions = useCallback(async () => {
    try {
      const data = await apiClient.getRegions();
      setRegions(data || []);
    } catch (error) {
      console.error('Failed to fetch regions:', error);
      Alert.alert('Error', 'Failed to load regions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRegions();
  };

  const handleAdd = () => {
    setEditingRegion(null);
    setFormData({ name: '', code: '', description: '' });
    setModalVisible(true);
  };

  const handleEdit = (region: Region) => {
    setEditingRegion(region);
    setFormData({
      name: region.name,
      code: region.code || '',
      description: region.description || '',
    });
    setModalVisible(true);
  };

  const handleDelete = (region: Region) => {
    Alert.alert(
      'Delete Region',
      `Are you sure you want to delete "${region.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteRegion(region.id);
              fetchRegions();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete region');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Region name is required');
      return;
    }

    try {
      if (editingRegion) {
        await apiClient.updateRegion(editingRegion.id, formData);
      } else {
        await apiClient.createRegion(formData);
      }
      setModalVisible(false);
      fetchRegions();
    } catch (error) {
      Alert.alert('Error', `Failed to ${editingRegion ? 'update' : 'create'} region`);
    }
  };

  const filteredRegions = regions.filter(region =>
    region.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (region.code && region.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderRegionItem = ({ item }: { item: Region }) => (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Icon name="public" size={24} color={colors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.regionName, { color: colors.onSurface }]}>
            {item.name}
          </Text>
          {item.code && (
            <Text style={[styles.regionCode, { color: colors.onSurfaceVariant }]}>
              Code: {item.code}
            </Text>
          )}
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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
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
    regionName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    regionCode: {
      fontSize: 14,
      marginBottom: 4,
    },
    description: {
      fontSize: 13,
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
        <Text style={styles.title}>Regions</Text>
        {isAdmin && (
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Icon name="add" size={20} color={colors.onPrimary} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={colors.onSurfaceVariant} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search regions..."
          placeholderTextColor={colors.onSurfaceVariant}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredRegions}
        keyExtractor={(item) => item.id}
        renderItem={renderRegionItem}
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
            <Icon name="public" size={64} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>No regions found</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingRegion ? 'Edit Region' : 'Add Region'}
            </Text>

            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter region name"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.inputLabel}>Code</Text>
            <TextInput
              style={styles.input}
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text })}
              placeholder="Enter region code"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Enter description"
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
            />

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
                  {editingRegion ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default RegionManagementScreen;
