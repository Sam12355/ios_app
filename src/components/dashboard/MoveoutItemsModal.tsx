import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import apiClient from '../../api/ApiClient';
import { MoveoutItem, MoveoutList } from '../../models';
import { useAuthStore } from '../../stores/authStore';

// Design System Colors
const colors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardBackground: '#2D2D2D',
  tableHeader: '#3A3A3A',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  successGreen: '#16A34A',
  borderColor: '#404040',
};

interface MoveoutItemsModalProps {
  visible: boolean;
  moveoutList: MoveoutList | null;
  onClose: () => void;
  onItemProcessed: () => void;
}

const MoveoutItemsModal: React.FC<MoveoutItemsModalProps> = ({
  visible,
  moveoutList,
  onClose,
  onItemProcessed,
}) => {
  const { profile } = useAuthStore();
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<MoveoutItem[]>([]);

  // Initialize local items when modal opens
  React.useEffect(() => {
    if (visible && moveoutList?.items) {
      setLocalItems([...moveoutList.items]);
    }
  }, [visible, moveoutList]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleProcessItem = async (item: MoveoutItem) => {
    if (!moveoutList?.id || !item.item_id) return;

    setProcessingItemId(item.item_id);

    try {
      await apiClient.processMoveoutItem(
        moveoutList.id,
        item.item_id,
        item.request_amount,
        profile?.name || 'Unknown User'
      );

      // Update local state to show as completed
      setLocalItems((prev) =>
        prev.map((i) =>
          i.item_id === item.item_id
            ? { ...i, completed: true, status: 'completed' }
            : i
        )
      );

      console.log(`✅ Processed item: ${item.item_name}`);
      onItemProcessed();
    } catch (error) {
      console.log('Failed to process item:', error);
    } finally {
      setProcessingItemId(null);
    }
  };

  if (!moveoutList) return null;

  const allCompleted = localItems.every(
    (item) => item.completed || item.status === 'completed'
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                {moveoutList.title || 'Moveout List'}
              </Text>
              <Text style={styles.headerDate}>
                {formatDate(moveoutList.created_at)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.columnName]}>
              Item Name
            </Text>
            <Text style={[styles.tableHeaderText, styles.columnQty]}>
              Requesting{'\n'}Quantity
            </Text>
            <Text style={[styles.tableHeaderText, styles.columnAction]}>
              Action
            </Text>
          </View>

          {/* Items List */}
          <ScrollView style={styles.itemsList}>
            {localItems.map((item, index) => {
              const isCompleted = item.completed || item.status === 'completed';
              const isProcessing = processingItemId === item.item_id;

              return (
                <View key={item.id || item.item_id || index} style={styles.itemRow}>
                  <Text style={[styles.itemText, styles.columnName]}>
                    {item.item_name}
                  </Text>
                  <Text style={[styles.itemText, styles.columnQty]}>
                    {item.request_amount}
                  </Text>
                  <View style={styles.columnAction}>
                    {isCompleted ? (
                      <Text style={styles.completedText}>Completed</Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={() => handleProcessItem(item)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color={colors.textPrimary} />
                        ) : (
                          <Text style={styles.doneButtonText}>Done</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer - Show completion status */}
          {allCompleted && localItems.length > 0 && (
            <View style={styles.footer}>
              <Icon name="check-circle" size={20} color={colors.successGreen} />
              <Text style={styles.footerText}>All items completed</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeader,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  columnName: {
    flex: 2,
  },
  columnQty: {
    flex: 1.5,
  },
  columnAction: {
    flex: 1.2,
    alignItems: 'flex-start',
  },
  itemsList: {
    flexGrow: 0,
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    alignItems: 'center',
  },
  itemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  completedText: {
    fontSize: 13,
    color: colors.successGreen,
    fontWeight: '500',
  },
  doneButton: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderColor,
  },
  footerText: {
    fontSize: 14,
    color: colors.successGreen,
    fontWeight: '500',
  },
});

export default MoveoutItemsModal;
