import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { BlurView } from '@react-native-community/blur';

// Defaults copied from ICADeliveryScreen to keep behavior identical
const DEFAULT_ENTRY_TYPES = [
  'Salmon and Rolls',
  'Combo',
  'Salmon and Avocado Rolls',
  'Vegan Combo',
  'Goma Wakame',
];

const QUICK_PRESETS = [
  { label: 'Morning 5/5/1/1/4w', amounts: ['5', '5', '1', '1', '4w'], timeOfDay: 'Morning' },
  { label: 'Afternoon 5/5/1/1w', amounts: ['5', '5', '1', '1', 'w'], timeOfDay: 'Afternoon' },
  { label: 'Morning 10/10/1/1/4w', amounts: ['10', '10', '1', '1', '4w'], timeOfDay: 'Morning' },
];

const showToast = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({ type, text1, text2, position: 'bottom', visibilityTime: 3000 });
};

export default function AddICADeliveryModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess?: () => void; }) {
  const { designColors, isDark } = useTheme();
  const { profile } = useAuthStore();
  const userName = profile?.name || profile?.email || 'Current User';

  const [entries, setEntries] = useState(() => DEFAULT_ENTRY_TYPES.map(type => ({ type, amount: '', timeOfDay: 'Morning' })));
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyPreset = (amounts: string[], timeOfDay: string) => {
    setEntries(prev => prev.map((entry, index) => {
      const rawAmount = amounts[index] || '';
      const numericAmount = rawAmount.replace(/[^0-9]/g, '');
      return { ...entry, amount: numericAmount, timeOfDay };
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

  const handleSubmitDelivery = () => {
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
      await apiClient.submitICADelivery({ userName, entries: validEntries.map(e => ({ type: e.type, amount: e.amount, timeOfDay: e.timeOfDay })) });
      setIsSubmitting(false);
      setShowConfirmation(false);
      onClose();
      setTimeout(() => {
        showToast('success', 'Success', 'ICA Delivery order submitted');
        onSuccess && onSuccess();
      }, 100);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit order');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!isSubmitting) onClose(); }}>
      <View style={styles.overlay}>
        <View style={styles.containerWrapper}>
          <BlurView
            style={styles.blur}
            blurType={isDark ? 'dark' : 'xlight'}
            blurAmount={5}
            reducedTransparencyFallbackColor={isDark ? 'rgba(19,18,24,0.05)' : 'rgba(245,245,245,0.05)'}
          />
          <View style={[styles.containerContent, { backgroundColor: designColors.surfaceVariant, borderColor: designColors.border }]}> 
          {showConfirmation ? (
            <View style={{ padding: 8 }}>
              <Text style={[styles.title, { color: designColors.textPrimary }]}>Confirm ICA Delivery Order</Text>
              <Text style={{ color: designColors.textSecondary, marginBottom: 8 }}>You are about to submit the following order:</Text>
              <View style={[styles.confirmCard, { backgroundColor: designColors.cardBackground }]}>
                {entries.filter(e => e.amount.trim() !== '').map((entry, idx) => (
                  <Text key={idx} style={{ color: designColors.textPrimary }}>{entry.type}: {entry.amount} units - {entry.timeOfDay}</Text>
                ))}
              </View>

              {errorMessage && <Text style={{ color: designColors.errorRed, marginTop: 8 }}>{errorMessage}</Text>}

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity onPress={() => setShowConfirmation(false)} style={[styles.actionButton, { backgroundColor: designColors.surface, marginRight: 8 }]}>
                  <Text style={{ color: designColors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmSubmit} style={[styles.actionButtonPrimary, { backgroundColor: designColors.primaryRed }]} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Confirm & Submit</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.title, { color: designColors.textPrimary }]}>ICA Delivery Order</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={{ color: designColors.textSecondary, marginTop: 8 }}>Quick Presets:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
                  {QUICK_PRESETS.map((p, i) => (
                    <TouchableOpacity key={i} onPress={() => applyPreset(p.amounts, p.timeOfDay)} style={[styles.preset, { backgroundColor: designColors.cardBackground, borderColor: designColors.border }] }>
                      <Text style={{ color: designColors.textPrimary }}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {entries.map((entry, index) => (
                  <View key={index} style={[styles.entryRow, { backgroundColor: designColors.cardBackground, borderColor: designColors.border }] }>
                    <Text style={{ color: designColors.textPrimary, fontWeight: '600' }}>{entry.type}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <Text style={{ color: designColors.textSecondary, marginRight: 8 }}>Amount</Text>
                      <TextInput value={entry.amount} onChangeText={(t) => updateEntryAmount(index, t)} placeholder="0" placeholderTextColor={designColors.textSecondary} style={[styles.input, { backgroundColor: designColors.surfaceVariant, color: designColors.textPrimary }]} />

                      <TouchableOpacity style={[styles.timeBtn, { marginLeft: 12, backgroundColor: designColors.surfaceVariant }]} onPress={() => { if (index === 0) setShowTimeDropdown(!showTimeDropdown); else updateTimeOfDay(entry.timeOfDay === 'Morning' ? 'Afternoon' : 'Morning'); }}>
                        <Text style={{ color: designColors.textPrimary }}>{entry.timeOfDay}</Text>
                        <Icon name="arrow-drop-down" size={20} color={designColors.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    {index === 0 && showTimeDropdown && (
                      <View style={styles.timeDropdown}>
                        {['Morning', 'Afternoon'].map(t => (
                          <TouchableOpacity key={t} onPress={() => updateTimeOfDay(t)} style={styles.timeOption}><Text>{t}</Text></TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}

                {errorMessage && <Text style={{ color: designColors.errorRed }}>{errorMessage}</Text>}
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity onPress={onClose} style={[styles.actionButton, { backgroundColor: designColors.surface, marginRight: 8 }]}>
                  <Text style={{ color: designColors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmitDelivery} style={[styles.actionButtonPrimary, { backgroundColor: designColors.primaryRed }]}>
                  <Text style={{ color: '#fff' }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  containerWrapper: { width: '100%', maxWidth: 640, borderRadius: 12, overflow: 'hidden' },
  blur: { ...StyleSheet.absoluteFillObject },
  containerContent: { padding: 14, borderWidth: 1 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  preset: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  entryRow: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  input: { minWidth: 80, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  timeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  timeDropdown: { marginTop: 8, borderWidth: 1, borderRadius: 8, padding: 8 },
  timeOption: { paddingVertical: 8 },
  actionButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionButtonPrimary: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  confirmCard: { padding: 8, borderRadius: 8 },
});
