import React from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { StockItem } from '../../models';
import { useTheme } from '../../theme/ThemeContext';
import { BorderRadius, Colors, FontSizes, Spacing } from '../../theme/colors';

interface StockDetailsModalProps {
  visible: boolean;
  title: string;
  items: StockItem[];
  onClose: () => void;
}

const StockDetailsModal: React.FC<StockDetailsModalProps> = ({
  visible,
  title,
  items,
  onClose,
}) => {
  const { colors } = useTheme();

  const renderItem = ({ item }: { item: StockItem }) => (
    <View style={[styles.itemCard, { backgroundColor: colors.card }]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemName, { color: colors.text }]}>
          {item.items.name}
        </Text>
        <View style={[styles.quantityBadge, { backgroundColor: getQuantityColor(item) }]}>
          <Text style={styles.quantityText}>
            {item.current_quantity} {item.items.unit || 'units'}
          </Text>
        </View>
      </View>
      <Text style={[styles.itemCategory, { color: colors.textSecondary }]}>
        {item.items.category}
      </Text>
      <View style={styles.thresholdInfo}>
        <Text style={[styles.thresholdText, { color: colors.textSecondary }]}>
          Threshold: {item.items.threshold_level}
        </Text>
      </View>
    </View>
  );

  const getQuantityColor = (item: StockItem) => {
    const qty = item.current_quantity;
    const threshold = item.items.threshold_level;
    if (qty <= threshold * 0.5) return Colors.danger;
    if (qty <= threshold) return Colors.warning;
    return Colors.success;
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
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No items found
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    overflow: 'hidden',
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
  listContent: {
    padding: Spacing.md,
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  itemName: {
    fontSize: FontSizes.md,
    fontWeight: 'bold',
    flex: 1,
  },
  quantityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  quantityText: {
    color: '#FFFFFF',
    fontSize: FontSizes.sm,
    fontWeight: 'bold',
  },
  itemCategory: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  thresholdInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thresholdText: {
    fontSize: FontSizes.xs,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSizes.md,
  },
});

export default StockDetailsModal;
