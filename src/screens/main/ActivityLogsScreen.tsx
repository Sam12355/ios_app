import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../../api/ApiClient';
import { ActivityLog } from '../../models/Inventory';
import { useTheme } from '../../theme/ThemeContext';

export const ActivityLogsScreen: React.FC = () => {
  const { colors } = useTheme();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await apiClient.getActivityLogs();
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
      case 'add':
        return { name: 'add-circle', color: colors.success };
      case 'update':
      case 'edit':
        return { name: 'edit', color: colors.primary };
      case 'delete':
      case 'remove':
        return { name: 'delete', color: colors.error };
      case 'login':
        return { name: 'login', color: colors.secondary };
      case 'logout':
        return { name: 'logout', color: colors.onSurfaceVariant };
      case 'stock_in':
        return { name: 'add-box', color: colors.success };
      case 'stock_out':
        return { name: 'remove-circle', color: colors.warning };
      default:
        return { name: 'info', color: colors.onSurfaceVariant };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
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
    listContainer: {
      padding: 16,
    },
    logItem: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    logContent: {
      flex: 1,
    },
    logAction: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onSurface,
      marginBottom: 4,
    },
    logDescription: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginBottom: 4,
    },
    logMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logUser: {
      fontSize: 12,
      color: colors.primary,
    },
    logDate: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
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
  });

  const renderLogItem = ({ item }: { item: ActivityLog }) => {
    const iconInfo = getActionIcon(item.action);
    
    return (
      <View style={styles.logItem}>
        <View style={[styles.iconContainer, { backgroundColor: iconInfo.color + '20' }]}>
          <Icon name={iconInfo.name} size={20} color={iconInfo.color} />
        </View>
        <View style={styles.logContent}>
          <Text style={styles.logAction}>
            {item.action.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <Text style={styles.logDescription} numberOfLines={2}>
            {item.description || item.details || 'No description'}
          </Text>
          <View style={styles.logMeta}>
            {item.user_name && (
              <Text style={styles.logUser}>{item.user_name}</Text>
            )}
            <Text style={styles.logDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

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
        <Text style={styles.title}>Activity Logs</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={renderLogItem}
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
            <Icon name="history" size={64} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>No activity logs found</Text>
          </View>
        }
      />
    </View>
  );
};

export default ActivityLogsScreen;
