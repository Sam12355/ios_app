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
import { MoveoutItem, MoveoutList } from '../../models';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

const MoveoutListScreen = () => {
  const { colors, designColors } = useTheme();
  const { profile } = useAuthStore();
  const isManager = profile?.role === 'manager' || profile?.role === 'assistant_manager' || profile?.role === 'admin';

  const [moveoutLists, setMoveoutLists] = useState<MoveoutList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'active' | 'completed'>('all');
  
  // Create/Edit modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // View modal
  const [selectedList, setSelectedList] = useState<MoveoutList | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const loadMoveoutLists = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    try {
      const data = await apiClient.getMoveoutLists();
      let filtered = data;
      if (filterStatus !== 'all') {
        filtered = data.filter((list) => list.status === filterStatus);
      }
      setMoveoutLists(filtered);
    } catch (error) {
      console.log('Load moveout lists error:', error);
      Alert.alert('Error', 'Failed to load moveout lists');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadMoveoutLists();
  }, [loadMoveoutLists]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadMoveoutLists(true);
  };

  const handleCreateList = async () => {
    if (!listTitle.trim()) {
      Alert.alert('Validation Error', 'Please enter a list title');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await apiClient.createMoveoutList({
        title: listTitle.trim(),
        description: listDescription.trim() || undefined,
      });
      
      Alert.alert('Success', 'Moveout list created successfully');
      setCreateModalVisible(false);
      setListTitle('');
      setListDescription('');
      loadMoveoutLists(true);
    } catch (error: any) {
      console.log('Create list error:', error);
      Alert.alert('Error', error.message || 'Failed to create list');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateList = async (listId: string) => {
    try {
      await apiClient.activateMoveoutList(listId);
      Alert.alert('Success', 'List activated successfully');
      loadMoveoutLists(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to activate list');
    }
  };

  const handleDeleteList = (list: MoveoutList) => {
    Alert.alert(
      'Delete List',
      `Are you sure you want to delete "${list.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteMoveoutList(list.id!);
              Alert.alert('Success', 'List deleted successfully');
              loadMoveoutLists(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete list');
            }
          },
        },
      ]
    );
  };

  const handleProcessItem = async (item: MoveoutItem) => {
    if (!selectedList) return;
    
    const quantity = parseInt(quantities[item.item_id] || item.request_amount.toString(), 10);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity');
      return;
    }
    
    if (quantity > item.available_amount) {
      Alert.alert('Insufficient Stock', `Only ${item.available_amount} available`);
      return;
    }
    
    setProcessingItemId(item.item_id);
    
    try {
      await apiClient.processMoveoutItem(
        selectedList.id!,
        item.item_id,
        quantity,
        profile?.name || 'User'
      );
      
      // Refresh the list
      const lists = await apiClient.getMoveoutLists();
      const updatedList = lists.find((l) => l.id === selectedList.id);
      
      if (updatedList) {
        setSelectedList(updatedList);
        
        // Check if all items are completed
        const allCompleted = updatedList.items.every((i) => i.completed);
        if (allCompleted) {
          Alert.alert('Complete', 'All items have been processed!');
          setViewModalVisible(false);
        }
      }
      
      loadMoveoutLists(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process item');
    } finally {
      setProcessingItemId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return Colors.warning;
      case 'active': return Colors.success;
      case 'completed': return Colors.info;
      default: return Colors.secondary;
    }
  };

  const renderListCard = ({ item: list }: { item: MoveoutList }) => {
    const completedCount = list.items.filter((i) => i.completed).length;
    const totalCount = list.items.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    
    return (
      <TouchableOpacity
        style={[styles.listCard, { backgroundColor: colors.card }]}
        onPress={() => {
          setSelectedList(list);
          setViewModalVisible(true);
        }}
      >
        <View style={styles.listHeader}>
          <View style={styles.listTitleRow}>
            <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>
              {list.title || 'Untitled List'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(list.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(list.status) }]}>
                {list.status}
              </Text>
            </View>
          </View>
          
          {list.description && (
            <Text style={[styles.listDescription, { color: colors.textSecondary }]} numberOfLines={2}>
              {list.description}
            </Text>
          )}
        </View>
        
        <View style={styles.progressSection}>
          <View style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%`, backgroundColor: getStatusColor(list.status) },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {completedCount} of {totalCount} items processed
          </Text>
        </View>
        
        <View style={styles.listFooter}>
          <Text style={[styles.listDate, { color: colors.textSecondary }]}>
            Created: {list.created_at ? new Date(list.created_at).toLocaleDateString() : 'N/A'}
          </Text>
          
          {isManager && (
            <View style={styles.listActions}>
              {list.status === 'draft' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: Colors.success + '20' }]}
                  onPress={() => handleActivateList(list.id!)}
                >
                  <Icon name="play-arrow" size={18} color={Colors.success} />
                </TouchableOpacity>
              )}
              {list.status === 'draft' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: Colors.danger + '20' }]}
                  onPress={() => handleDeleteList(list)}
                >
                  <Icon name="delete" size={18} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading moveout lists...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Tabs */}
      <View style={[styles.filterTabs, { backgroundColor: colors.card }]}>
        {(['all', 'draft', 'active', 'completed'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              filterStatus === status && { borderBottomColor: Colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filterStatus === status ? Colors.primary : colors.textSecondary },
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lists */}
      <FlatList
        data={moveoutLists}
        keyExtractor={(item) => item.id!}
        renderItem={renderListCard}
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
            <Icon name="list-alt" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No moveout lists found
            </Text>
            {isManager && (
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: Colors.primary }]}
                onPress={() => setCreateModalVisible(true)}
              >
                <Text style={styles.emptyButtonText}>Create New List</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Create List FAB */}
      {isManager && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: Colors.primary }]}
          onPress={() => setCreateModalVisible(true)}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Create List Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmitting && setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Create Moveout List
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                value={listTitle}
                onChangeText={setListTitle}
                placeholder="Enter list title"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  { backgroundColor: colors.surfaceVariant, color: colors.text },
                ]}
                value={listDescription}
                onChangeText={setListDescription}
                placeholder="Optional description"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
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
                onPress={handleCreateList}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View List Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={[styles.viewModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.viewModalHeader, { backgroundColor: Colors.primary }]}>
            <TouchableOpacity onPress={() => setViewModalVisible(false)}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.viewModalTitle} numberOfLines={1}>
              {selectedList?.title || 'Moveout List'}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          
          {selectedList && (
            <FlatList
              data={selectedList.items}
              keyExtractor={(item) => item.item_id}
              contentContainerStyle={styles.viewModalContent}
              ListHeaderComponent={
                selectedList.description ? (
                  <Text style={[styles.viewModalDescription, { color: colors.textSecondary }]}>
                    {selectedList.description}
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.moveoutItemCard,
                    { backgroundColor: item.completed ? colors.surfaceVariant : colors.card },
                  ]}
                >
                  <View style={styles.moveoutItemHeader}>
                    <Text style={[styles.moveoutItemName, { color: colors.text }]}>
                      {item.item_name}
                    </Text>
                    {item.completed && (
                      <Icon name="check-circle" size={20} color={Colors.success} />
                    )}
                  </View>
                  
                  <View style={styles.moveoutItemDetails}>
                    <Text style={[styles.moveoutItemText, { color: colors.textSecondary }]}>
                      Available: {item.available_amount} | Requested: {item.request_amount}
                    </Text>
                  </View>
                  
                  {!item.completed && selectedList.status === 'active' && (
                    <View style={styles.moveoutItemActions}>
                      <TextInput
                        style={[
                          styles.quantityInput,
                          { backgroundColor: colors.surfaceVariant, color: colors.text },
                        ]}
                        value={quantities[item.item_id] || item.request_amount.toString()}
                        onChangeText={(text) =>
                          setQuantities((prev) => ({ ...prev, [item.item_id]: text }))
                        }
                        keyboardType="numeric"
                        placeholder="Qty"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <TouchableOpacity
                        style={[styles.processButton, { backgroundColor: Colors.success }]}
                        onPress={() => handleProcessItem(item)}
                        disabled={processingItemId === item.item_id}
                      >
                        {processingItemId === item.item_id ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.processButtonText}>Process</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {item.completed && item.completed_by_name && (
                    <Text style={[styles.completedBy, { color: colors.textSecondary }]}>
                      Completed by: {item.completed_by_name}
                    </Text>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyItems}>
                  <Icon name="shopping-basket" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyItemsText, { color: colors.textSecondary }]}>
                    No items in this list
                  </Text>
                </View>
              }
            />
          )}
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
  filterTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 80,
  },
  listCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  listHeader: {
    marginBottom: Spacing.sm,
  },
  listTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  listDescription: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  progressSection: {
    marginVertical: Spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: FontSizes.xs,
  },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  listDate: {
    fontSize: FontSizes.xs,
  },
  listActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  emptyButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: '600',
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
    marginBottom: Spacing.lg,
    textAlign: 'center',
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
  viewModalContainer: {
    flex: 1,
  },
  viewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingTop: Spacing.xl + Spacing.md,
  },
  viewModalTitle: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  viewModalDescription: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  viewModalContent: {
    padding: Spacing.md,
  },
  moveoutItemCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  moveoutItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moveoutItemName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    flex: 1,
  },
  moveoutItemDetails: {
    marginTop: Spacing.xs,
  },
  moveoutItemText: {
    fontSize: FontSizes.sm,
  },
  moveoutItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  quantityInput: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSizes.md,
  },
  processButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  processButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  completedBy: {
    marginTop: Spacing.sm,
    fontSize: FontSizes.xs,
    fontStyle: 'italic',
  },
  emptyItems: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyItemsText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
});

export default MoveoutListScreen;
