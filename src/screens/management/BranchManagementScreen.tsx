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
import { Branch, Region } from '../../models';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

const BranchManagementScreen = () => {
  const { colors } = useTheme();
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    region_id: '',
  });

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    try {
      const [branchesData, regionsData] = await Promise.all([
        apiClient.getBranches(),
        apiClient.getRegions(),
      ]);
      setBranches(branchesData);
      setRegions(regionsData);
    } catch (error) {
      console.log('Load branches error:', error);
      Alert.alert('Error', 'Failed to load branches');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(true);
  };

  const filteredBranches = branches.filter((branch) =>
    searchQuery === '' ||
    branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateBranch = () => {
    setEditingBranch(null);
    setFormData({ name: '', location: '', region_id: '' });
    setCreateModalVisible(true);
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location || '',
      region_id: branch.region_id || '',
    });
    setCreateModalVisible(true);
  };

  const handleDeleteBranch = (branch: Branch) => {
    Alert.alert(
      'Delete Branch',
      `Are you sure you want to delete "${branch.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteBranch(branch.id!);
              Alert.alert('Success', 'Branch deleted');
              loadData(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete branch');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter branch name');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (editingBranch) {
        await apiClient.updateBranch(editingBranch.id!, formData);
        Alert.alert('Success', 'Branch updated');
      } else {
        await apiClient.createBranch(formData);
        Alert.alert('Success', 'Branch created');
      }
      
      setCreateModalVisible(false);
      loadData(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save branch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBranchCard = ({ item: branch }: { item: Branch }) => {
    const region = regions.find((r) => r.id === branch.region_id);
    
    return (
      <TouchableOpacity
        style={[styles.branchCard, { backgroundColor: colors.card }]}
        onPress={() => handleEditBranch(branch)}
        onLongPress={() => handleDeleteBranch(branch)}
      >
        <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '20' }]}>
          <Icon name="store" size={24} color={Colors.primary} />
        </View>
        
        <View style={styles.branchInfo}>
          <Text style={[styles.branchName, { color: colors.text }]}>{branch.name}</Text>
          {branch.location && (
            <View style={styles.locationRow}>
              <Icon name="location-on" size={14} color={colors.textSecondary} />
              <Text style={[styles.branchLocation, { color: colors.textSecondary }]}>
                {branch.location}
              </Text>
            </View>
          )}
          {region && (
            <View style={[styles.regionBadge, { backgroundColor: Colors.info + '20' }]}>
              <Text style={[styles.regionText, { color: Colors.info }]}>{region.name}</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditBranch(branch)}
        >
          <Icon name="edit" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading branches...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Icon name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search branches..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Branches List */}
      <FlatList
        data={filteredBranches}
        keyExtractor={(item) => item.id!}
        renderItem={renderBranchCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="store" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No branches found
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: Colors.primary }]}
        onPress={handleCreateBranch}
      >
        <Icon name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmitting && setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingBranch ? 'Edit Branch' : 'Create Branch'}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                value={formData.name}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder="Branch name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Location</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                value={formData.location}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, location: text }))}
                placeholder="Branch location"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Region</Text>
              <View style={styles.regionOptions}>
                {regions.map((region) => (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.regionOption,
                      {
                        backgroundColor:
                          formData.region_id === region.id
                            ? Colors.primary
                            : colors.surfaceVariant,
                      },
                    ]}
                    onPress={() => setFormData((prev) => ({ ...prev, region_id: region.id! }))}
                  >
                    <Text
                      style={[
                        styles.regionOptionText,
                        { color: formData.region_id === region.id ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {region.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setCreateModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: Colors.primary }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                    {editingBranch ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 80,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  branchInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  branchName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  branchLocation: {
    fontSize: FontSizes.sm,
  },
  regionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  regionText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  editButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  fab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.lg,
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
  regionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  regionOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  regionOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});

export default BranchManagementScreen;
