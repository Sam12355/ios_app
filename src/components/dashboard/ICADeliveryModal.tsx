import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

interface ICADeliveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ICADeliveryModal: React.FC<ICADeliveryModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { colors } = useTheme();
  const [temperature, setTemperature] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!temperature.trim()) {
      Alert.alert('Error', 'Please enter temperature');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.createICADelivery({
        notes,
        status: 'pending',
        delivery_date: new Date().toISOString(),
      });
      onSuccess();
      onClose();
      setTemperature('');
      setNotes('');
    } catch (error) {
      console.log('Create ICA delivery error:', error);
      Alert.alert('Error', 'Failed to create ICA delivery');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: Colors.primary }]}>
            <Text style={styles.headerTitle}>Record ICA Delivery</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={[styles.label, { color: colors.text }]}>Temperature (°C)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
              value={temperature}
              onChangeText={setTemperature}
              placeholder="e.g., 4.5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: Colors.primary }]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Delivery</Text>
              )}
            </TouchableOpacity>
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
    padding: Spacing.md,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  formContent: {
    padding: Spacing.md,
  },
  label: {
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: FontSizes.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: 'bold',
  },
});

export default ICADeliveryModal;
