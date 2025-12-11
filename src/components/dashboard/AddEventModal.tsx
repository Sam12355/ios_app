import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

interface Branch {
  id: string;
  name: string;
  location?: string;
}

interface AddEventModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Event types matching Android exactly
const EVENT_TYPES = [
  { value: 'reorder', label: 'Reorder' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'alert', label: 'Alert' },
  { value: 'expiry', label: 'Expiry' },
  { value: 'usage_spike', label: 'Usage Spike' },
];

const AddEventModal: React.FC<AddEventModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuthStore();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventType, setSelectedEventType] = useState('reorder');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEventTypeDropdown, setShowEventTypeDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  
  // Fetch branches for admin users
  useEffect(() => {
    if (visible && isAdmin) {
      fetchBranches();
    }
  }, [visible, isAdmin]);
  
  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setSelectedDate(null);
      setSelectedEventType('reorder');
      setSelectedBranch(null);
      setShowEventTypeDropdown(false);
      setShowBranchDropdown(false);
    }
  }, [visible]);
  
  const fetchBranches = async () => {
    try {
      const response = await apiClient.getBranches();
      if (Array.isArray(response)) {
        setBranches(response);
      }
    } catch (error) {
      console.log('Failed to fetch branches:', error);
    }
  };
  
  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };
  
  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };
  
  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }
    
    if (isAdmin && branches.length > 0 && !selectedBranch) {
      Alert.alert('Error', 'Please select a branch');
      return;
    }

    setIsLoading(true);
    try {
      const isoDate = selectedDate.toISOString().split('T')[0] + 'T00:00:00';
      
      await apiClient.createCalendarEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        event_date: isoDate,
        event_type: selectedEventType,
        branch_id: selectedBranch?.id,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.log('Create event error:', error);
      Alert.alert('Error', 'Failed to create event');
    } finally {
      setIsLoading(false);
    }
  };
  
  const isFormValid = title.trim() && selectedDate && (!isAdmin || branches.length === 0 || selectedBranch);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Add Event
            </Text>
            
            {/* Branch Selection - Admin Only */}
            {isAdmin && branches.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Branch *
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dropdown,
                    { 
                      borderColor: showBranchDropdown ? Colors.primary : colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  onPress={() => {
                    setShowBranchDropdown(!showBranchDropdown);
                    setShowEventTypeDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownText,
                    { color: selectedBranch ? colors.text : colors.textSecondary }
                  ]}>
                    {selectedBranch ? selectedBranch.name : 'Select a branch'}
                  </Text>
                  <Icon 
                    name={showBranchDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                    size={24} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
                
                {showBranchDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {branches.map((branch) => (
                        <TouchableOpacity
                          key={branch.id}
                          style={[
                            styles.dropdownItem,
                            selectedBranch?.id === branch.id && { backgroundColor: Colors.primary + '20' }
                          ]}
                          onPress={() => {
                            setSelectedBranch(branch);
                            setShowBranchDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                            {branch.name}{branch.location ? ` - ${branch.location}` : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
            
            {/* Title Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Title *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  }
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter event title"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            {/* Description Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Description
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { 
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border,
                  }
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter event description"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            
            {/* Date Picker Field */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Date *
              </Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.dateInput,
                  { 
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={[
                  styles.dateText,
                  { color: selectedDate ? colors.text : colors.textSecondary }
                ]}>
                  {selectedDate ? formatDate(selectedDate) : 'Select date'}
                </Text>
                <Icon name="calendar-today" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {/* Date Picker Modal */}
            {showDatePicker && (
              Platform.OS === 'ios' ? (
                <Modal
                  transparent
                  animationType="fade"
                  visible={showDatePicker}
                  onRequestClose={() => setShowDatePicker(false)}
                >
                  <View style={styles.datePickerOverlay}>
                    <View style={[styles.datePickerContainer, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.datePickerTitle, { color: colors.text }]}>
                        Select Date
                      </Text>
                      <DateTimePicker
                        value={selectedDate || new Date()}
                        mode="date"
                        display="spinner"
                        onChange={(event, date) => {
                          if (date) setSelectedDate(date);
                        }}
                        textColor={isDarkMode ? '#FFFFFF' : '#000000'}
                        style={{ height: 200 }}
                      />
                      <View style={styles.datePickerButtons}>
                        <TouchableOpacity
                          style={styles.datePickerButton}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={{ color: Colors.primary, fontWeight: '600' }}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
              ) : (
                <DateTimePicker
                  value={selectedDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )
            )}
            
            {/* Event Type Dropdown */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Type
              </Text>
              <TouchableOpacity
                style={[
                  styles.dropdown,
                  { 
                    borderColor: showEventTypeDropdown ? Colors.primary : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                onPress={() => {
                  setShowEventTypeDropdown(!showEventTypeDropdown);
                  setShowBranchDropdown(false);
                }}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {EVENT_TYPES.find(t => t.value === selectedEventType)?.label || 'Select event type'}
                </Text>
                <Icon 
                  name={showEventTypeDropdown ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                  size={24} 
                  color={colors.textSecondary} 
                />
              </TouchableOpacity>
              
              {showEventTypeDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {EVENT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.dropdownItem,
                        selectedEventType === type.value && { backgroundColor: Colors.primary + '20' }
                      ]}
                      onPress={() => {
                        setSelectedEventType(type.value);
                        setShowEventTypeDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            
            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={isLoading}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { 
                    backgroundColor: isFormValid && !isLoading ? Colors.primary : Colors.primary + '60',
                  }
                ]}
                onPress={handleSubmit}
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Event</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  fieldContainer: {
    marginBottom: 16,
    zIndex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    height: 90,
    paddingTop: 14,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 16,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownItem: {
    padding: 14,
  },
  dropdownItemText: {
    fontSize: 16,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  datePickerButtons: {
    marginTop: 16,
    alignItems: 'center',
  },
  datePickerButton: {
    padding: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 24,
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AddEventModal;
