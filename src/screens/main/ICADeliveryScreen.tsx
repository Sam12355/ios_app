import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
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
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

// Static design colors for StyleSheet (dynamic colors applied inline)
const staticDesignColors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardDark: '#1e293b',
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  successGreen: '#10B981',
  errorRed: '#EF4444',
  borderLight: 'rgba(255, 255, 255, 0.3)',
  borderFocus: 'rgba(255, 255, 255, 0.5)',
};

// ICA Delivery Entry interface matching Kotlin
interface ICADeliveryEntry {
  type: string;
  amount: string;
  timeOfDay: string;
}

// ICA Delivery Record from API
interface ICADeliveryRecord {
  id: number;
  type: string;
  amount: number;
  time_of_day: string;
  user_name: string;
  submitted_at: string;
}

// Grouped records for display
interface ICADeliveryGroup {
  userName: string;
  timeOfDay: string;
  submittedAt: string;
  items: { type: string; amount: number; id: number }[];
  recordIds: number[];
}

// Default entry types - matching Kotlin exactly
const DEFAULT_ENTRY_TYPES = [
  'Salmon and Rolls',
  'Combo',
  'Salmon and Avocado Rolls',
  'Vegan Combo',
  'Goma Wakame',
];

// Quick Presets matching Kotlin - now includes timeOfDay
const QUICK_PRESETS = [
  { label: 'Morning 5/5/1/1/4w', amounts: ['5', '5', '1', '1', '4w'], timeOfDay: 'Morning' },
  { label: 'Afternoon 5/5/1/1w', amounts: ['5', '5', '1', '1', 'w'], timeOfDay: 'Afternoon' },
  { label: 'Morning 10/10/1/1/4w', amounts: ['10', '10', '1', '1', '4w'], timeOfDay: 'Morning' },
];

// Helper function
const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({ type, text1, text2, position: 'bottom', visibilityTime: 3000 });
};

const ICADeliveryScreen = () => {
  const { colors, designColors, isDark } = useTheme();
  const { profile } = useAuthStore();
  const userName = profile?.name || profile?.email || 'Current User';

  const [records, setRecords] = useState<ICADeliveryRecord[]>([]);
  const [groupedRecords, setGroupedRecords] = useState<ICADeliveryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Date filter
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDayOfMonth.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Modal states
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<ICADeliveryGroup | null>(null);
  const [recordsToDelete, setRecordsToDelete] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add form state
  const [entries, setEntries] = useState<ICADeliveryEntry[]>(() => 
    DEFAULT_ENTRY_TYPES.map(type => ({ type, amount: '', timeOfDay: 'Morning' }))
  );
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showEditTimeDropdown, setShowEditTimeDropdown] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Date picker states
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Group records by user, time of day, and submission date
  const groupRecords = useCallback((data: ICADeliveryRecord[]) => {
    const grouped: { [key: string]: ICADeliveryRecord[] } = {};
    
    data.forEach(record => {
      let submissionDate = record.submitted_at;
      try {
        const date = new Date(record.submitted_at);
        submissionDate = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      } catch (e) {}
      
      const key = `${record.user_name}-${record.time_of_day}-${submissionDate}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(record);
    });
    
    return Object.entries(grouped).map(([_, recs]) => {
      // Sort items by predefined order
      const sortedItems = recs
        .map(r => ({ type: r.type, amount: r.amount, id: r.id }))
        .sort((a, b) => {
          const orderA = DEFAULT_ENTRY_TYPES.indexOf(a.type);
          const orderB = DEFAULT_ENTRY_TYPES.indexOf(b.type);
          return (orderA >= 0 ? orderA : 999) - (orderB >= 0 ? orderB : 999);
        });
      
      return {
        userName: recs[0].user_name,
        timeOfDay: recs[0].time_of_day,
        submittedAt: recs[0].submitted_at,
        items: sortedItems,
        recordIds: recs.map(r => r.id),
      } as ICADeliveryGroup;
    });
  }, []);

  const loadRecords = useCallback(async (silent = false, customStartDate?: string, customEndDate?: string) => {
    if (!silent) setIsLoading(true);
    
    try {
      const data = await apiClient.getICADeliveryRecords(customStartDate || startDate, customEndDate || endDate);
      setRecords(data);
      setGroupedRecords(groupRecords(data));
    } catch (error) {
      console.log('Load ICA records error:', error);
      showToast('error', 'Error', 'Failed to load ICA delivery records');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [groupRecords]);

  // Load records only on initial mount
  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadRecords(true, startDate, endDate);
  };

  const handleFilter = () => {
    loadRecords(false, startDate, endDate);
  };

  const handleClearFilters = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const newStartDate = firstDayOfMonth.toISOString().split('T')[0];
    const newEndDate = today.toISOString().split('T')[0];
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    // Reload with new dates
    loadRecords(false, newStartDate, newEndDate);
  };

  const handleOpenAddModal = () => {
    setEntries(DEFAULT_ENTRY_TYPES.map(type => ({ type, amount: '', timeOfDay: 'Morning' })));
    setErrorMessage(null);
    setShowConfirmation(false);
    setAddModalVisible(true);
  };

  const handleOpenEditModal = (group: ICADeliveryGroup) => {
    setGroupToEdit(group);
    const editEntries = DEFAULT_ENTRY_TYPES.map(type => {
      const item = group.items.find(i => i.type === type);
      return { type, amount: item ? item.amount.toString() : '', timeOfDay: group.timeOfDay };
    });
    setEntries(editEntries);
    setErrorMessage(null);
    setShowEditTimeDropdown(false);
    setEditModalVisible(true);
  };

  const handleDeleteGroup = (group: ICADeliveryGroup) => {
    setRecordsToDelete(group.recordIds);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    setIsSubmitting(true);
    try {
      for (const id of recordsToDelete) {
        await apiClient.deleteICADeliveryRecord(id);
      }
      showToast('success', 'Success', 'Record deleted successfully');
      setDeleteDialogVisible(false);
      setRecordsToDelete([]);
      loadRecords(true, startDate, endDate);
    } catch (error: any) {
      showToast('error', 'Error', error.message || 'Failed to delete record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (amounts: string[], timeOfDay: string) => {
    setEntries(prev => prev.map((entry, index) => {
      // Extract only numeric part from amount (e.g., '4w' → '4', 'w' → '')
      const rawAmount = amounts[index] || '';
      const numericAmount = rawAmount.replace(/[^0-9]/g, '');
      return {
        ...entry,
        amount: numericAmount,
        timeOfDay: timeOfDay,
      };
    }));
  };

  const updateEntryAmount = (index: number, amount: string) => {
    setEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount };
      return updated;
    });
  };

  const updateTimeOfDay = (timeOfDay: string) => {
    setEntries(prev => prev.map(entry => ({ ...entry, timeOfDay })));
    setShowTimeDropdown(false);
  };

  const handleSubmitDelivery = async () => {
    // Validate at least one entry
    const validEntries = entries.filter(e => e.amount.trim() !== '');
    if (validEntries.length === 0) {
      setErrorMessage('Please fill in at least one entry');
      return;
    }
    setErrorMessage(null);
    setShowConfirmation(true);
  };

  const confirmSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const validEntries = entries.filter(e => e.amount.trim() !== '');
      
      console.log('Submitting ICA Delivery:', {
        userName,
        entries: validEntries,
      });
      
      const result = await apiClient.submitICADelivery({
        userName,
        entries: validEntries.map(e => ({
          type: e.type,
          amount: e.amount,
          timeOfDay: e.timeOfDay,
        })),
      });
      
      console.log('ICA Delivery submit result:', result);
      
      // Close modal first, then show toast and reload
      setAddModalVisible(false);
      setShowConfirmation(false);
      setIsSubmitting(false);
      
      // Short delay to ensure modal is closed before toast
      setTimeout(() => {
        showToast('success', 'Success', 'ICA Delivery order submitted');
        loadRecords(true, startDate, endDate);
      }, 100);
    } catch (error: any) {
      console.log('ICA Delivery submit error:', error);
      setErrorMessage(error.message || 'Failed to submit order');
      // Stay on confirmation so user can see error and try again
      setIsSubmitting(false);
    }
  };

  const handleUpdateDelivery = async () => {
    if (!groupToEdit) return;
    
    // Validate at least one entry
    const validEntries = entries.filter(e => e.amount.trim() !== '');
    if (validEntries.length === 0) {
      setErrorMessage('Please fill in at least one entry');
      return;
    }
    
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      // Delete old records first
      for (const id of groupToEdit.recordIds) {
        await apiClient.deleteICADeliveryRecord(id);
      }
      
      // Submit new entries
      await apiClient.submitICADelivery({
        userName: groupToEdit.userName,
        entries: validEntries.map(e => ({
          type: e.type,
          amount: e.amount,
          timeOfDay: e.timeOfDay,
        })),
      });
      
      showToast('success', 'Success', 'ICA Delivery updated');
      setEditModalVisible(false);
      setGroupToEdit(null);
      loadRecords(true, startDate, endDate);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSubmittedDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Render group card matching Kotlin design
  const renderGroupCard = ({ item: group }: { item: ICADeliveryGroup }) => (
    <View style={[styles.groupCard, { backgroundColor: designColors.cardBackground, ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }) }]}>
      <View style={styles.groupHeader}>
        <View style={styles.groupInfo}>
          <Text style={[styles.groupUserName, { color: designColors.textPrimary }]}>{group.userName}</Text>
          
          <View style={styles.groupMetaRow}>
            <View style={[styles.timeOfDayBadge, { backgroundColor: designColors.primaryRed + '20' }]}>
              <Text style={[styles.timeOfDayText, { color: designColors.primaryRed }]}>{group.timeOfDay}</Text>
            </View>
            <Text style={[styles.submittedDate, { color: designColors.textSecondary }]}>{formatSubmittedDate(group.submittedAt)}</Text>
          </View>
          
          {/* Item types list */}
          <View style={styles.itemsColumn}>
            {group.items.map((item, index) => (
              <Text key={index} style={[styles.itemTypeName, { color: designColors.textPrimary }]}>{item.type}</Text>
            ))}
          </View>
        </View>
        
        {/* Right column with actions and amounts */}
        <View style={styles.groupActions}>
          <View style={styles.iconButtonRow}>
            <TouchableOpacity onPress={() => handleOpenEditModal(group)} style={styles.iconButton}>
              <Icon name="edit" size={22} color={staticDesignColors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteGroup(group)} style={styles.iconButton}>
              <Icon name="delete" size={22} color={staticDesignColors.primaryRed} />
            </TouchableOpacity>
          </View>
          
          {/* Amounts aligned with items */}
          <View style={styles.amountsColumn}>
            {group.items.map((item, index) => (
              <Text key={index} style={[styles.itemAmount, { color: designColors.textPrimary }]}>{item.amount}</Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: designColors.background }]}>
        <ActivityIndicator size="large" color={staticDesignColors.primaryRed} />
        <Text style={[styles.loadingText, { color: designColors.textSecondary }]}>Loading ICA delivery records...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: designColors.background }]}>
      {/* Header */}
      <Text style={[styles.headerTitle, { color: designColors.textPrimary }]}>ICA Delivery Records</Text>
      
      {/* Filter Section */}
      <View style={[styles.filterCard, { backgroundColor: designColors.cardBackground }]}>
        <Text style={[styles.filterTitle, { color: designColors.textPrimary }]}>Filter by Date Range</Text>
        
        <View style={styles.dateInputRow}>
          <View style={styles.dateInputWrapper}>
            <Text style={[styles.dateInputLabel, { color: designColors.textSecondary }]}>Start Date</Text>
            <TouchableOpacity 
              style={[styles.dateInput, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.divider }]}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={[styles.dateInputText, { color: designColors.textPrimary }]}>{startDate || 'YYYY-MM-DD'}</Text>
              <Icon name="calendar-today" size={20} color={designColors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.dateInputWrapper}>
            <Text style={[styles.dateInputLabel, { color: designColors.textSecondary }]}>End Date</Text>
            <TouchableOpacity 
              style={[styles.dateInput, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.divider }]}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={[styles.dateInputText, { color: designColors.textPrimary }]}>{endDate || 'YYYY-MM-DD'}</Text>
              <Icon name="calendar-today" size={20} color={designColors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.filterButtonRow}>
          <TouchableOpacity style={styles.filterButton} onPress={handleFilter}>
            <Icon name="filter-list" size={18} color="#FFFFFF" />
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
            <Icon name="clear" size={18} color="#FFFFFF" />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={startDate ? new Date(startDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            // Always close the picker first
            setShowStartDatePicker(false);
            // Only update date if user selected one (not cancelled)
            if (event.type === 'set' && selectedDate) {
              setStartDate(selectedDate.toISOString().split('T')[0]);
            }
          }}
          themeVariant={isDark ? 'dark' : 'light'}
        />
      )}
      
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate ? new Date(endDate) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            // Always close the picker first
            setShowEndDatePicker(false);
            // Only update date if user selected one (not cancelled)
            if (event.type === 'set' && selectedDate) {
              setEndDate(selectedDate.toISOString().split('T')[0]);
            }
          }}
          themeVariant={isDark ? 'dark' : 'light'}
        />
      )}
      
      {/* Records List */}
      {groupedRecords.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: designColors.cardBackground }]}>
          <Text style={styles.emptyText}>No ICA delivery records found</Text>
        </View>
      ) : (
        <FlatList
          data={groupedRecords}
          keyExtractor={(item, index) => `${item.userName}-${item.timeOfDay}-${index}`}
          renderItem={renderGroupCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[staticDesignColors.primaryRed]}
              tintColor={staticDesignColors.primaryRed}
            />
          }
        />
      )}
      
      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenAddModal}>
        <Icon name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      
      {/* Add ICA Delivery Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmitting && !showConfirmation && setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: designColors.surfaceVariant }]}>
            {/* Show confirmation view or form view */}
            {showConfirmation ? (
              // Confirmation View
              <View style={styles.confirmationContainer}>
                <Text style={[styles.confirmTitle, { color: designColors.textPrimary }]}>Confirm ICA Delivery Order</Text>
                <Text style={[styles.confirmText, { color: designColors.textSecondary }]}>You are about to submit the following order:</Text>
                
                <View style={[styles.confirmItemsCard, { backgroundColor: designColors.cardBackground }]}>
                  {entries.filter(e => e.amount.trim() !== '').map((entry, index) => (
                    <Text key={index} style={[styles.confirmItemText, { color: designColors.textPrimary }]}>
                      {entry.type}: {entry.amount} units - {entry.timeOfDay}
                    </Text>
                  ))}
                </View>
                
                <Text style={[styles.confirmSubmittedBy, { color: designColors.textSecondary }]}>Submitted by: {userName}</Text>
                
                {errorMessage && (
                  <Text style={[styles.errorMessage, { color: designColors.errorRed }]}>{errorMessage}</Text>
                )}
                
                <View style={styles.confirmButtonRow}>
                  <TouchableOpacity 
                    style={[styles.confirmCancelButton, { borderColor: designColors.borderLight }]}
                    onPress={() => setShowConfirmation(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.confirmCancelText, { color: designColors.textPrimary }]}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.confirmSubmitButton, { backgroundColor: staticDesignColors.primaryRed }]}
                    onPress={confirmSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmSubmitText}>Confirm & Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Form View
              <>
                <Text style={[styles.modalTitle, { color: designColors.textPrimary }]}>ICA Delivery Order</Text>
            
                <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                  {/* Quick Presets */}
                  <View style={styles.presetsSection}>
                    <Text style={[styles.presetLabel, { color: designColors.textSecondary }]}>Quick Presets:</Text>
                    <View style={styles.presetsRow}>
                      {QUICK_PRESETS.map((preset, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[styles.presetButton, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight }]}
                          onPress={() => applyPreset(preset.amounts, preset.timeOfDay)}
                        >
                          <Text style={[styles.presetButtonText, { color: designColors.textPrimary }]}>{preset.label}</Text>
                        </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Entry Cards */}
              {entries.map((entry, index) => (
                <View key={index} style={[styles.entryCard, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight, ...(isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }) }]}>
                  <View style={styles.entryRow}>
                    <Text style={[styles.entryTypeName, { color: designColors.textPrimary }]}>{entry.type}</Text>
                  </View>
                  <View style={styles.entryInputRow}>
                    <View style={styles.amountInputWrapper}>
                      <Text style={[styles.amountInputLabel, { color: designColors.textSecondary }]}>Amount</Text>
                      <TextInput
                        style={[styles.amountInput, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight, color: designColors.textPrimary }]}
                        value={entry.amount}
                        onChangeText={(text) => updateEntryAmount(index, text)}
                        placeholder="0"
                        placeholderTextColor={designColors.textSecondary}
                        keyboardType="default"
                      />
                    </View>
                    
                    {/* Time of Day dropdown - on each entry like Kotlin */}
                    <View style={styles.timeInputWrapper}>
                      <Text style={[styles.timeInputLabel, { color: designColors.textSecondary }]}>Time of Day</Text>
                      <TouchableOpacity 
                        style={[styles.timeDropdownTrigger, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight }]}
                        onPress={() => {
                          // Use first entry's dropdown state to control all (they sync anyway)
                          if (index === 0) {
                            setShowTimeDropdown(!showTimeDropdown);
                          } else {
                            // Update all entries to cycle through times
                            const newTime = entry.timeOfDay === 'Morning' ? 'Afternoon' : 'Morning';
                            updateTimeOfDay(newTime);
                          }
                        }}
                      >
                        <Text style={[styles.timeDropdownText, { color: designColors.textPrimary }]}>{entry.timeOfDay}</Text>
                        <Icon name="arrow-drop-down" size={24} color={designColors.textSecondary} />
                      </TouchableOpacity>
                      
                      {/* Dropdown menu only on first entry */}
                      {index === 0 && showTimeDropdown && (
                        <View style={styles.timeDropdownMenu}>
                          {['Morning', 'Afternoon'].map(time => (
                            <TouchableOpacity
                              key={time}
                              style={styles.timeDropdownItem}
                              onPress={() => updateTimeOfDay(time)}
                            >
                              <Text style={styles.timeDropdownItemText}>{time}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
              
              {/* Error message */}
              {errorMessage && (
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              )}
            </ScrollView>
            
            {/* Action buttons */}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.cancelButton, { borderColor: designColors.borderLight }]}
                onPress={() => setAddModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelButtonText, { color: designColors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: staticDesignColors.primaryRed }]}
                onPress={handleSubmitDelivery}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
              </>
            )}
          </View>
        </View>
      </Modal>
      
      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmitting && setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: designColors.surfaceVariant }]}>
            <Text style={[styles.modalTitle, { color: designColors.textPrimary }]}>Edit ICA Delivery</Text>
            
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Time of Day Selector */}
              <View style={[styles.editTimeSection, { zIndex: 1000 }]}>
                <Text style={[styles.editTimeLabel, { color: designColors.textSecondary }]}>Time of Day</Text>
                <TouchableOpacity 
                  style={[styles.editTimeButton, { backgroundColor: designColors.cardBackground, borderColor: designColors.borderLight }]}
                  onPress={() => setShowEditTimeDropdown(!showEditTimeDropdown)}
                >
                  <Text style={[styles.editTimeText, { color: designColors.textPrimary }]}>{entries[0]?.timeOfDay || 'Morning'}</Text>
                  <Icon name="arrow-drop-down" size={24} color={staticDesignColors.textSecondary} />
                </TouchableOpacity>
                
                {showEditTimeDropdown && (
                  <View style={[styles.editTimeDropdownVisible, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight }]}>
                    {['Morning', 'Afternoon'].map(time => (
                      <TouchableOpacity
                        key={time}
                        style={[styles.editTimeOptionVisible, { backgroundColor: designColors.surfaceVariant, borderBottomColor: designColors.borderLight }]}
                        onPress={() => {
                          updateTimeOfDay(time);
                          setShowEditTimeDropdown(false);
                        }}
                      >
                        <Text style={[styles.editTimeOptionText, { color: designColors.textPrimary }]}>{time}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              
              {/* Edit entries */}
              {entries.map((entry, index) => (
                <View key={index} style={[styles.editEntryRow, { borderBottomColor: designColors.borderLight }]}>
                  <Text style={[styles.editEntryType, { color: designColors.textPrimary }]}>{entry.type}</Text>
                  <TextInput
                    style={[styles.editAmountInput, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.borderLight, color: designColors.textPrimary }]}
                    value={entry.amount}
                    onChangeText={(text) => updateEntryAmount(index, text)}
                    keyboardType="default"
                  />
                </View>
              ))}
              
              {errorMessage && (
                <Text style={styles.errorMessage}>{errorMessage}</Text>
              )}
            </ScrollView>
            
            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.cancelButton, { borderColor: designColors.borderLight }]}
                onPress={() => { setEditModalVisible(false); setGroupToEdit(null); setShowEditTimeDropdown(false); }}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelButtonText, { color: designColors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: staticDesignColors.primaryRed }]}
                onPress={handleUpdateDelivery}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Delete Confirmation Dialog */}
      <Modal
        visible={deleteDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isSubmitting && setDeleteDialogVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteDialogContent, { backgroundColor: designColors.surfaceVariant }]}>
            <Icon name="delete" size={48} color={staticDesignColors.primaryRed} style={styles.deleteIcon} />
            <Text style={[styles.deleteTitle, { color: designColors.textPrimary }]}>Delete ICA Delivery Record</Text>
            <Text style={[styles.deleteText, { color: designColors.textSecondary }]}>Are you sure you want to delete this record? This action cannot be undone.</Text>
            
            <View style={styles.deleteButtonRow}>
              <TouchableOpacity 
                style={[styles.deleteCancelButton, { borderColor: designColors.borderLight }]}
                onPress={() => setDeleteDialogVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.deleteCancelText, { color: designColors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteConfirmButton}
                onPress={confirmDelete}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete</Text>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  
  // Filter Section
  filterCard: {
    backgroundColor: staticDesignColors.surfaceDark,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: staticDesignColors.textPrimary,
    marginBottom: 8,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginBottom: 4,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: staticDesignColors.backgroundDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInputText: {
    flex: 1,
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  filterButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: staticDesignColors.primaryRed,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 4,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    paddingVertical: 10,
    gap: 4,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: staticDesignColors.textPrimary,
  },
  
  // List
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  
  // Group Card
  groupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupInfo: {
    flex: 1,
  },
  groupUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  timeOfDayBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeOfDayText: {
    fontSize: 12,
    color: staticDesignColors.successGreen,
  },
  submittedDate: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
  },
  itemsColumn: {
    marginTop: 8,
  },
  itemTypeName: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
    paddingVertical: 2,
  },
  groupActions: {
    alignItems: 'flex-end',
  },
  iconButtonRow: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: 8,
  },
  amountsColumn: {
    paddingRight: 12,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: staticDesignColors.textPrimary,
    paddingVertical: 2,
    textAlign: 'right',
  },
  
  // Empty State
  emptyCard: {
    flex: 1,
    margin: 16,
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 12,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: staticDesignColors.textSecondary,
  },
  
  // FAB
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: staticDesignColors.primaryRed,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    backgroundColor: staticDesignColors.cardDark,
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalScrollView: {
    maxHeight: '80%',
  },
  
  // Presets Section
  presetsSection: {
    marginBottom: 16,
  },
  presetLabel: {
    fontSize: 14,
    color: staticDesignColors.textSecondary,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  presetButtonText: {
    fontSize: 12,
    color: staticDesignColors.textPrimary,
  },
  
  // Entry Card
  entryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
  },
  entryRow: {
    marginBottom: 8,
  },
  entryTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: staticDesignColors.textPrimary,
  },
  entryInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountInputWrapper: {
    flex: 1,
  },
  amountInputLabel: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginBottom: 4,
  },
  amountInput: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  timeInputWrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 1000,
  },
  timeInputLabel: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginBottom: 4,
  },
  timeDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeDropdownText: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  timeDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: staticDesignColors.cardDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    marginTop: 4,
    zIndex: 1000,
  },
  timeDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: staticDesignColors.borderLight,
  },
  timeDropdownItemText: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  
  // Error Message
  errorMessage: {
    fontSize: 12,
    color: staticDesignColors.errorRed,
    marginTop: 8,
  },
  
  // Modal Buttons
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: staticDesignColors.textPrimary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: staticDesignColors.primaryRed,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  
  // Confirmation Dialog (inline view)
  confirmationContainer: {
    paddingVertical: 8,
  },
  confirmDialogContent: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 16,
    padding: 20,
    width: '90%',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
    marginBottom: 12,
  },
  confirmItemsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  confirmItemText: {
    fontSize: 12,
    color: staticDesignColors.textPrimary,
    paddingVertical: 2,
  },
  confirmSubmittedBy: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginBottom: 16,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  confirmCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmCancelText: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  confirmSubmitButton: {
    backgroundColor: staticDesignColors.successGreen,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmSubmitText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  
  // Edit Modal
  editTimeSection: {
    marginBottom: 16,
    position: 'relative',
  },
  editTimeLabel: {
    fontSize: 12,
    color: staticDesignColors.textSecondary,
    marginBottom: 4,
  },
  editTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editTimeText: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  editTimeDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: staticDesignColors.cardDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    marginTop: 4,
    zIndex: 1000,
  },
  editTimeDropdownVisible: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.textSecondary,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  editTimeOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  editTimeOptionVisible: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: staticDesignColors.surfaceDark,
    borderBottomWidth: 1,
    borderBottomColor: staticDesignColors.borderLight,
  },
  editTimeOptionText: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  editEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: staticDesignColors.borderLight,
  },
  editEntryType: {
    flex: 1,
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  editAmountInput: {
    width: 80,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: staticDesignColors.textPrimary,
    textAlign: 'center',
  },
  
  // Delete Dialog
  deleteDialogContent: {
    backgroundColor: staticDesignColors.surfaceDark,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  deleteIcon: {
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: staticDesignColors.textPrimary,
    marginBottom: 8,
  },
  deleteText: {
    fontSize: 14,
    color: staticDesignColors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  deleteButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: staticDesignColors.borderLight,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 14,
    color: staticDesignColors.textPrimary,
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: staticDesignColors.primaryRed,
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

export default ICADeliveryScreen;
