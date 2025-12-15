import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
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

// Toast helper function using react-native-toast-message
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  Toast.show({
    type,
    text1: message,
    position: 'bottom',
    visibilityTime: 2500,
  });
};

import apiClient from '../../api/ApiClient';
import { Profile, UserRole } from '../../models';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

// Design Colors matching Android
const designColors = {
  primaryRed: '#E6002A',
  backgroundDark: '#121212',
  surfaceDark: '#1E1E1E',
  cardDark: '#2D2D2D',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#808080',
  successGreen: '#4CAF50',
  deleteRed: '#D32F2F',
  divider: '#3D3D3D',
};

// Extended profile with approval status
interface StaffMember extends Profile {
  is_active?: boolean;
  access_count?: number;
  last_access?: string;
  phone?: string;
  position?: string;
}

const ROLES: UserRole[] = [
  'admin',
  'regional_manager',
  'district_manager',
  'manager',
  'assistant_manager',
  'staff',
];

// Helper functions matching Android
const getRoleColor = (role: string): string => {
  switch (role) {
    case 'admin': return '#E6002A';
    case 'regional_manager': return '#9C27B0';
    case 'district_manager': return '#673AB7';
    case 'manager': return '#2196F3';
    case 'assistant_manager': return '#00BCD4';
    case 'staff': return '#4CAF50';
    default: return '#757575';
  }
};

const getRoleIcon = (role: string): string => {
  switch (role) {
    case 'admin': return 'admin-panel-settings';
    case 'regional_manager': return 'public';
    case 'district_manager': return 'domain';
    case 'manager': return 'supervisor-account';
    case 'assistant_manager': return 'group';
    case 'staff': return 'person';
    default: return 'person';
  }
};

// Constants
const Colors = {
  primary: designColors.primaryRed,
  success: designColors.successGreen,
};

const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
};

const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

const StaffScreen = () => {
  const { profile } = useAuthStore();
  const { isDark, designColors: themeDesignColors } = useTheme();
  const currentUserId = profile?.id;
  const userRole = profile?.role || 'staff';
  
  // Permission check matching Android StaffScreen.kt
  const isAdmin = userRole === 'admin';
  const isManager = ['admin', 'regional_manager', 'district_manager', 'manager', 'assistant_manager'].includes(userRole);
  const canManageStaff = ['admin', 'regional_manager', 'district_manager', 'manager', 'assistant_manager'].includes(userRole);

  // Colors for theme (matching Android) - use themeDesignColors
  const colors = {
    background: themeDesignColors.background,
    card: themeDesignColors.cardDark,
    surfaceVariant: themeDesignColors.surfaceDark,
    text: themeDesignColors.textPrimary,
    textSecondary: themeDesignColors.textSecondary,
  };
  
  // User reference for compatibility
  const user = profile;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  // Modal states
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [staffToActivate, setStaffToActivate] = useState<StaffMember | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state - matching Kotlin StaffFormDialog
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    role: '' as string,
    password: '',
    photoUrl: '',
    branchId: '' as string | null,
    regionId: '' as string | null,
    districtId: '' as string | null,
  });
  
  // Dropdown visibility states - matching Kotlin
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Additional states
  const [activateBranchId, setActivateBranchId] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  // Available roles based on current user - matching Kotlin exactly
  const getAvailableRoles = useCallback(() => {
    switch (userRole) {
      case 'admin':
        return ['manager', 'assistant_manager', 'staff'];
      case 'regional_manager':
        return ['district_manager', 'manager', 'assistant_manager', 'staff'];
      case 'district_manager':
        return ['manager', 'assistant_manager', 'staff'];
      case 'manager':
        return ['assistant_manager', 'staff'];
      case 'assistant_manager':
        return ['staff'];
      default:
        return [];
    }
  }, [userRole]);

  // Filter branches based on user role and selections - matching Kotlin
  const getFilteredBranches = useCallback(() => {
    switch (userRole) {
      case 'admin':
        if (formData.districtId) {
          return branches.filter(b => b.districtId === formData.districtId || b.district_id === formData.districtId);
        } else if (formData.regionId) {
          return branches.filter(b => b.district?.regionId === formData.regionId || b.region_id === formData.regionId);
        }
        return branches;
      case 'regional_manager':
      case 'district_manager':
        return branches;
      case 'manager':
        if (profile?.branchId) {
          return branches.filter(b => b.id === profile.branchId);
        }
        return branches;
      default:
        return [];
    }
  }, [userRole, branches, formData.districtId, formData.regionId, profile?.branchId]);

  // Filter districts based on selected region - matching Kotlin
  const getFilteredDistricts = useCallback(() => {
    if (formData.regionId) {
      return districts.filter(d => d.region_id === formData.regionId);
    }
    return districts;
  }, [districts, formData.regionId]);

  // Check if branch already has manager/assistant manager - matching Kotlin
  const branchHasManager = useCallback((branchId: string | null) => {
    if (!branchId) return false;
    return staff.some(s => 
      (s.branchId === branchId || (s as any).branch_id === branchId) && 
      s.role === 'manager' && 
      s.id !== selectedStaff?.id
    );
  }, [staff, selectedStaff]);

  const branchHasAssistant = useCallback((branchId: string | null) => {
    if (!branchId) return false;
    return staff.some(s => 
      (s.branchId === branchId || (s as any).branch_id === branchId) && 
      s.role === 'assistant_manager' && 
      s.id !== selectedStaff?.id
    );
  }, [staff, selectedStaff]);

  // Form validation - matching Kotlin isValid
  const isFormValid = useCallback(() => {
    const hasName = formData.name.trim().length > 0;
    const hasEmail = formData.email.trim().length > 0;
    const hasRole = formData.role.length > 0;
    const hasPassword = selectedStaff !== null || formData.password.length >= 6;
    
    let hasLocation = true;
    switch (formData.role) {
      case 'staff':
      case 'assistant_manager':
      case 'manager':
        hasLocation = !!formData.branchId;
        break;
      case 'district_manager':
        hasLocation = !!formData.districtId;
        break;
      case 'regional_manager':
        hasLocation = !!formData.regionId;
        break;
    }
    
    return hasName && hasEmail && hasRole && hasPassword && hasLocation;
  }, [formData, selectedStaff]);

  const loadStaff = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    try {
      // Load staff and branches first (required)
      const [staffData, branchesData] = await Promise.all([
        apiClient.getStaff(),
        apiClient.getBranches(),
      ]);
      setStaff(staffData as StaffMember[]);
      setBranches(branchesData || []);
      
      // Load regions and districts separately (optional - may fail for non-admin users)
      try {
        const regionsData = await apiClient.getRegions();
        setRegions(regionsData || []);
      } catch (e) {
        console.log('Could not load regions:', e);
        setRegions([]);
      }
      
      try {
        const districtsData = await apiClient.getDistricts();
        setDistricts(districtsData || []);
      } catch (e) {
        console.log('Could not load districts:', e);
        setDistricts([]);
      }
    } catch (error: any) {
      console.error('Load staff error:', error?.message || error);
      Alert.alert('Error', error?.message || 'Failed to load staff. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStaff(true);
  };

  // Filter staff by search query
  const filteredStaff = staff.filter((member) => {
    if (searchQuery === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      member.name?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query) ||
      member.role?.toLowerCase().includes(query) ||
      member.position?.toLowerCase().includes(query)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleLabel = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleAddStaff = () => {
    setSelectedStaff(null);
    // Reset form to match Kotlin StaffFormDialog initial state
    setFormData({
      name: '',
      email: '',
      phone: '',
      position: '',
      role: '',
      password: '',
      photoUrl: '',
      branchId: null,
      regionId: null,
      districtId: null,
    });
    setShowRoleDropdown(false);
    setShowBranchDropdown(false);
    setShowRegionDropdown(false);
    setShowDistrictDropdown(false);
    setShowPassword(false);
    setShowAddDialog(true);
  };

  const handleEditStaff = (member: StaffMember) => {
    setSelectedStaff(member);
    // Populate form with existing staff data - matching Kotlin
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      position: member.position || '',
      role: member.role || '',
      password: '',
      photoUrl: member.photoUrl || (member as any).photo_url || '',
      branchId: member.branchId || (member as any).branch_id || null,
      regionId: member.regionId || (member as any).region_id || null,
      districtId: member.districtId || (member as any).district_id || null,
    });
    setShowRoleDropdown(false);
    setShowBranchDropdown(false);
    setShowRegionDropdown(false);
    setShowDistrictDropdown(false);
    setShowPassword(false);
    setShowAddDialog(true);
  };

  const handleDeleteStaff = async (staffId: string) => {
    setIsSubmitting(true);
    try {
      await apiClient.deleteStaff(staffId);
      showToast('Staff member deleted successfully');
      loadStaff(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateStaff = async (staffId: string, branchId: string) => {
    setIsSubmitting(true);
    try {
      // Update staff with branch_id and is_active = true
      await apiClient.updateStaff(staffId, { 
        branch_id: branchId, 
        is_active: true 
      });
      loadStaff(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to activate staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveStaff = async () => {
    // Validation matching Kotlin isValid
    if (!isFormValid()) {
      if (!formData.name.trim()) {
        Alert.alert('Error', 'Name is required');
      } else if (!formData.email.trim()) {
        Alert.alert('Error', 'Email is required');
      } else if (!formData.role) {
        Alert.alert('Error', 'Role is required');
      } else if (formData.password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
      } else {
        Alert.alert('Error', 'Please select a location (branch/district/region)');
      }
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Build staff data matching Kotlin createStaff
      const staffData: Record<string, any> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        password: formData.password.trim(),
      };
      
      if (formData.phone.trim()) staffData.phone = formData.phone.trim();
      if (formData.position.trim()) staffData.position = formData.position.trim();
      if (formData.photoUrl.trim()) staffData.photo_url = formData.photoUrl.trim();
      
      // Set location based on role - matching Kotlin
      switch (formData.role) {
        case 'staff':
        case 'assistant_manager':
        case 'manager':
          if (formData.branchId) staffData.branch_id = formData.branchId;
          break;
        case 'district_manager':
          if (formData.districtId) staffData.district_id = formData.districtId;
          break;
        case 'regional_manager':
          if (formData.regionId) staffData.region_id = formData.regionId;
          break;
      }
      
      await apiClient.createStaff(staffData);
      showToast('Staff member created successfully');
      setShowAddDialog(false);
      loadStaff(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!selectedStaff) return;
    
    // Validation for update
    if (!formData.name.trim() || !formData.email.trim() || !formData.role) {
      Alert.alert('Error', 'Name, email, and role are required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Build staff data matching Kotlin updateStaff
      const staffData: Record<string, any> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
      };
      
      if (formData.phone.trim()) staffData.phone = formData.phone.trim();
      if (formData.position.trim()) staffData.position = formData.position.trim();
      if (formData.photoUrl.trim()) staffData.photo_url = formData.photoUrl.trim();
      if (formData.password.trim()) staffData.password = formData.password.trim();
      
      // Set location based on role - matching Kotlin
      switch (formData.role) {
        case 'staff':
        case 'assistant_manager':
        case 'manager':
          if (formData.branchId) staffData.branch_id = formData.branchId;
          break;
        case 'district_manager':
          if (formData.districtId) staffData.district_id = formData.districtId;
          break;
        case 'regional_manager':
          if (formData.regionId) staffData.region_id = formData.regionId;
          break;
      }
      
      await apiClient.updateStaff(selectedStaff.id!, staffData);
      showToast('Staff member updated successfully');
      setShowAddDialog(false);
      setEditModalVisible(false);
      loadStaff(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Staff Member Card matching Android StaffMemberCard
  const renderStaffCard = ({ item: member }: { item: StaffMember }) => {
    const isActive = member.is_active !== false;
    const roleColor = getRoleColor(member.role || 'staff');
    
    return (
      <View style={[styles.staffCard, { backgroundColor: themeDesignColors.cardBackground }]}>
        <View style={styles.staffContent}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {member.photoUrl ? (
              <Image source={{ uri: member.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {getInitials(member.name || 'U')}
                </Text>
              </View>
            )}
          </View>
          
          {/* Staff Info */}
          <View style={styles.staffInfo}>
            <Text style={[styles.staffName, { color: themeDesignColors.textPrimary }]} numberOfLines={1}>
              {member.name || 'Unknown'}
            </Text>
            <Text style={[styles.staffEmail, { color: themeDesignColors.textSecondary }]} numberOfLines={1}>
              {member.email}
            </Text>
            {member.phone && (
              <Text style={[styles.staffPhone, { color: themeDesignColors.textSecondary }]}>{member.phone}</Text>
            )}
            
            {/* Badges Row */}
            <View style={styles.badgesRow}>
              {/* Role Badge */}
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
                <Icon name={getRoleIcon(member.role || 'staff')} size={12} color={roleColor} />
                <Text style={[styles.roleText, { color: roleColor }]}>
                  {getRoleLabel(member.role || 'staff')}
                </Text>
              </View>
              
              {/* Active/Inactive Badge */}
              <View style={[
                styles.statusBadge,
                { backgroundColor: isActive ? themeDesignColors.successGreen : themeDesignColors.deleteRed }
              ]}>
                <Text style={styles.statusBadgeText}>
                  {isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            
            {/* Access Info */}
            <View style={styles.infoRow}>
              <Icon name="login" size={12} color={themeDesignColors.textSecondary} />
              <Text style={[styles.infoText, { color: themeDesignColors.textSecondary }]}>
                Access: {member.access_count || 0}
              </Text>
              {member.last_access && (
                <Text style={[styles.infoText, { color: themeDesignColors.textSecondary }]}>
                  • Last: {member.last_access.substring(0, 10)}
                </Text>
              )}
            </View>
          </View>
          
          {/* Action Buttons Column - Matching Kotlin StaffMemberCard exactly */}
          {canManageStaff && (
            <View style={styles.actionButtonsColumn}>
              {/* Activate button for inactive staff - shown on top */}
              {!isActive && (
                <TouchableOpacity
                  style={styles.activateBtn}
                  onPress={() => {
                    setStaffToActivate(member);
                    setActivateBranchId(profile?.branchId || '');
                    setShowActivateDialog(true);
                  }}
                >
                  <Icon name="check-circle" size={14} color={themeDesignColors.successGreen} />
                  <Text style={styles.activateBtnText}>Activate</Text>
                </TouchableOpacity>
              )}
              
              {/* Icon buttons row - matching Kotlin */}
              <View style={styles.iconButtonsRow}>
                {/* Edit IconButton */}
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleEditStaff(member)}
                >
                  <Icon name="edit" size={20} color={themeDesignColors.textSecondary} />
                </TouchableOpacity>
                
                {/* Delete IconButton (only if not current user) */}
                {member.id !== currentUserId && (
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => {
                      setStaffToDelete(member);
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Icon name="delete" size={20} color={themeDesignColors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading staff...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Row with Search Toggle */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.searchToggle}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Icon 
              name={showSearch ? "close" : "search"} 
              size={24} 
              color={colors.text} 
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Manage Staff
          </Text>
        </View>
      </View>

      {/* Expandable Search Bar */}
      {showSearch && (
        <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search staff members..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Permission Check */}
      {!canManageStaff ? (
        <View style={[styles.noPermissionCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.noPermissionText, { color: colors.textSecondary }]}>
            You don't have permission to manage staff.
          </Text>
        </View>
      ) : (
        <>
          {/* Staff List Header */}
          <View style={[styles.listHeaderCard, { backgroundColor: colors.card }]}>
            <View style={styles.listHeaderRow}>
              <Icon name="people" size={24} color={Colors.primary} />
              <Text style={[styles.listHeaderTitle, { color: colors.text }]}>
                Staff Members ({filteredStaff.length})
              </Text>
            </View>
          </View>

          {/* Staff List */}
          <FlatList
            data={filteredStaff}
            keyExtractor={(item) => item.id!}
            renderItem={renderStaffCard}
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
                <Icon name="people" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'No staff members matching your search.' : 'No staff members found.'}
                </Text>
              </View>
            }
          />

          {/* FAB for Add Staff */}
          <TouchableOpacity
            style={styles.fab}
            onPress={handleAddStaff}
          >
            <Icon name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}

      {/* Add/Edit Staff Dialog - Matching Kotlin StaffFormDialog exactly */}
      <Modal
        visible={showAddDialog || editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowAddDialog(false);
            setEditModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.formModalContent, { backgroundColor: colors.card }]}>
            <ScrollView 
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Header - matching Kotlin */}
              <View style={styles.formHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                </Text>
                <TouchableOpacity onPress={() => {
                  setShowAddDialog(false);
                  setEditModalVisible(false);
                }}>
                  <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {/* Full Name - matching Kotlin OutlinedTextField */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Full Name *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                  placeholder="Enter full name"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                />
              </View>

              {/* Email Address - matching Kotlin */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email Address *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                  placeholder="Enter email address"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.email}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!selectedStaff} // Email disabled for edit mode like Kotlin
                />
              </View>

              {/* Phone Number - matching Kotlin */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Phone Number</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.phone}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Branch Selection - Show first for staff/manager/assistant_manager roles - matching Kotlin logic */}
              {(formData.branchId !== null || getAvailableRoles().some(r => ['staff', 'assistant_manager', 'manager'].includes(r))) && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Branch *</Text>
                  <TouchableOpacity
                    style={[styles.dropdownButton, { backgroundColor: colors.surfaceVariant, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                    onPress={() => setShowBranchDropdown(!showBranchDropdown)}
                  >
                    <Text style={[styles.dropdownButtonText, { color: formData.branchId ? colors.text : colors.textSecondary }]}>
                      {getFilteredBranches().find(b => b.id === formData.branchId)?.name || 'Select branch'}
                    </Text>
                    <Icon name={showBranchDropdown ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showBranchDropdown && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surfaceVariant }]}>
                      {getFilteredBranches().map((branch) => (
                        <TouchableOpacity
                          key={branch.id}
                          style={[styles.dropdownListItem, formData.branchId === branch.id && { backgroundColor: Colors.primary + '30' }]}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, branchId: branch.id, role: '' })); // Clear role when branch changes like Kotlin
                            setShowBranchDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownListItemText, { color: colors.text }]}>{branch.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {!formData.branchId && (
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      Please select a branch first to see available roles.
                    </Text>
                  )}
                </View>
              )}

              {/* Role Selection - Only show after branch is selected - matching Kotlin */}
              {(formData.branchId || ['regional_manager', 'district_manager'].includes(formData.role)) && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Role *</Text>
                  <TouchableOpacity
                    style={[styles.dropdownButton, { backgroundColor: colors.surfaceVariant, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                    onPress={() => setShowRoleDropdown(!showRoleDropdown)}
                  >
                    <Text style={[styles.dropdownButtonText, { color: formData.role ? colors.text : colors.textSecondary }]}>
                      {formData.role ? getRoleLabel(formData.role) : 'Select role'}
                    </Text>
                    <Icon name={showRoleDropdown ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showRoleDropdown && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surfaceVariant }]}>
                      {getAvailableRoles()
                        .filter(role => {
                          // Filter out manager/assistant_manager if already assigned - matching Kotlin
                          if (role === 'manager' && branchHasManager(formData.branchId)) return false;
                          if (role === 'assistant_manager' && branchHasAssistant(formData.branchId)) return false;
                          return true;
                        })
                        .map((role) => (
                          <TouchableOpacity
                            key={role}
                            style={[styles.dropdownListItem, formData.role === role && { backgroundColor: Colors.primary + '30' }]}
                            onPress={() => {
                              setFormData(prev => ({ ...prev, role }));
                              setShowRoleDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownListItemText, { color: colors.text }]}>{getRoleLabel(role)}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  )}
                </View>
              )}

              {/* Regional Manager - Region Selection - matching Kotlin */}
              {formData.role === 'regional_manager' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Region *</Text>
                  <TouchableOpacity
                    style={[styles.dropdownButton, { backgroundColor: colors.surfaceVariant, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                    onPress={() => setShowRegionDropdown(!showRegionDropdown)}
                  >
                    <Text style={[styles.dropdownButtonText, { color: formData.regionId ? colors.text : colors.textSecondary }]}>
                      {regions.find(r => r.id === formData.regionId)?.name || 'Select region'}
                    </Text>
                    <Icon name={showRegionDropdown ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showRegionDropdown && (
                    <View style={[styles.dropdownList, { backgroundColor: colors.surfaceVariant }]}>
                      {regions.map((region) => (
                        <TouchableOpacity
                          key={region.id}
                          style={[styles.dropdownListItem, formData.regionId === region.id && { backgroundColor: Colors.primary + '30' }]}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, regionId: region.id }));
                            setShowRegionDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownListItemText, { color: colors.text }]}>{region.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* District Manager - Region & District Selection - matching Kotlin */}
              {formData.role === 'district_manager' && userRole === 'admin' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Region *</Text>
                    <TouchableOpacity
                      style={[styles.dropdownButton, { backgroundColor: colors.surfaceVariant, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                      onPress={() => setShowRegionDropdown(!showRegionDropdown)}
                    >
                      <Text style={[styles.dropdownButtonText, { color: formData.regionId ? colors.text : colors.textSecondary }]}>
                        {regions.find(r => r.id === formData.regionId)?.name || 'Select region'}
                      </Text>
                      <Icon name={showRegionDropdown ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {showRegionDropdown && (
                      <View style={[styles.dropdownList, { backgroundColor: colors.surfaceVariant }]}>
                        {regions.map((region) => (
                          <TouchableOpacity
                            key={region.id}
                            style={[styles.dropdownListItem, formData.regionId === region.id && { backgroundColor: Colors.primary + '30' }]}
                            onPress={() => {
                              setFormData(prev => ({ ...prev, regionId: region.id, districtId: null }));
                              setShowRegionDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownListItemText, { color: colors.text }]}>{region.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>District *</Text>
                    <TouchableOpacity
                      style={[styles.dropdownButton, { backgroundColor: colors.surfaceVariant, borderColor: themeDesignColors.divider, borderWidth: 1, opacity: formData.regionId ? 1 : 0.5 }]}
                      onPress={() => formData.regionId && setShowDistrictDropdown(!showDistrictDropdown)}
                      disabled={!formData.regionId}
                    >
                      <Text style={[styles.dropdownButtonText, { color: formData.districtId ? colors.text : colors.textSecondary }]}>
                        {getFilteredDistricts().find(d => d.id === formData.districtId)?.name || 'Select district'}
                      </Text>
                      <Icon name={showDistrictDropdown ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                    {showDistrictDropdown && (
                      <View style={[styles.dropdownList, { backgroundColor: colors.surfaceVariant }]}>
                        {getFilteredDistricts().map((district) => (
                          <TouchableOpacity
                            key={district.id}
                            style={[styles.dropdownListItem, formData.districtId === district.id && { backgroundColor: Colors.primary + '30' }]}
                            onPress={() => {
                              setFormData(prev => ({ ...prev, districtId: district.id }));
                              setShowDistrictDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownListItemText, { color: colors.text }]}>{district.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Password - matching Kotlin */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {selectedStaff ? 'New Password (leave blank to keep current)' : 'Password *'}
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.textInput, styles.passwordInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                    placeholder={selectedStaff ? 'Leave blank to keep current' : 'Enter password (min 6 characters)'}
                    placeholderTextColor={colors.textSecondary}
                    value={formData.password}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, password: text }))}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Icon name={showPassword ? "visibility-off" : "visibility"} size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                {!selectedStaff && formData.password.length > 0 && formData.password.length < 6 && (
                  <Text style={[styles.helperText, { color: designColors.deleteRed }]}>
                    Password must be at least 6 characters
                  </Text>
                )}
              </View>

              {/* Photo URL - matching Kotlin */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Photo URL (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: themeDesignColors.divider, borderWidth: 1 }]}
                  placeholder="https://example.com/photo.jpg"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.photoUrl}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, photoUrl: text }))}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>

            </ScrollView>
            
            {/* Action Buttons - Always visible at bottom */}
            <View style={[styles.modalButtonsRow, { borderTopWidth: 1, borderTopColor: themeDesignColors.divider, paddingTop: 12, marginTop: 8 }]}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddDialog(false);
                  setEditModalVisible(false);
                }}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: Colors.primary, opacity: isFormValid() && !isSubmitting ? 1 : 0.5 }]}
                onPress={selectedStaff ? handleUpdateStaff : handleSaveStaff}
                disabled={!isFormValid() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {selectedStaff ? 'Update Staff' : 'Add Staff'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        visible={showDeleteDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalContent, { backgroundColor: colors.card }]}>
            <Icon name="delete" size={32} color={colors.text} style={styles.deleteIcon} />
            <Text style={[styles.deleteTitle, { color: colors.text }]}>
              Delete Staff Member
            </Text>
            <Text style={[styles.deleteMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete {staffToDelete?.name}? This action cannot be undone.
            </Text>
            <View style={styles.deleteButtons}>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowDeleteDialog(false)}
              >
                <Text style={[styles.deleteButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: '#D32F2F' }]}
                onPress={async () => {
                  if (staffToDelete) {
                    await handleDeleteStaff(staffToDelete.id!);
                  }
                  setShowDeleteDialog(false);
                  setStaffToDelete(null);
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.deleteButtonText, { color: '#FFFFFF' }]}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Activate Staff Dialog with Branch Selection */}
      <Modal
        visible={showActivateDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActivateDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.activateModalContent, { backgroundColor: colors.card }]}>
            <Icon name="check-circle" size={32} color={Colors.success} style={styles.activateIcon} />
            <Text style={[styles.activateTitle, { color: colors.text }]}>
              Activate Staff Member
            </Text>
            <Text style={[styles.activateSubtitle, { color: colors.textSecondary }]}>
              Activate {staffToActivate?.name}?
            </Text>
            <Text style={[styles.activateEmail, { color: colors.textSecondary }]}>
              Email: {staffToActivate?.email}
            </Text>

            {/* Branch Selection for Activation */}
            <View style={styles.activateBranchSection}>
              <Text style={[styles.inputLabel, { color: colors.text, fontWeight: '600' }]}>
                Assign Branch:
              </Text>
              <View style={styles.branchList}>
                {branches.map((branch) => (
                  <TouchableOpacity
                    key={branch.id}
                    style={[
                      styles.branchOption,
                      { 
                        backgroundColor: activateBranchId === branch.id 
                          ? Colors.primary 
                          : colors.surfaceVariant,
                        borderColor: activateBranchId === branch.id 
                          ? Colors.primary 
                          : 'transparent',
                      },
                    ]}
                    onPress={() => setActivateBranchId(branch.id)}
                  >
                    <Text
                      style={[
                        styles.branchOptionText,
                        { color: activateBranchId === branch.id ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {branch.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.activateButtons}>
              <TouchableOpacity
                style={[styles.activateButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowActivateDialog(false);
                  setStaffToActivate(null);
                  setActivateBranchId('');
                }}
              >
                <Text style={[styles.activateButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.activateButton, 
                  { 
                    backgroundColor: activateBranchId ? Colors.success : colors.surfaceVariant,
                    opacity: activateBranchId ? 1 : 0.5,
                  }
                ]}
                onPress={() => {
                  if (staffToActivate && activateBranchId) {
                    handleActivateStaff(staffToActivate.id!, activateBranchId);
                  }
                  setShowActivateDialog(false);
                  setStaffToActivate(null);
                  setActivateBranchId('');
                }}
                disabled={!activateBranchId}
              >
                <Text style={[styles.activateButtonText, { color: '#FFFFFF' }]}>Activate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Staff Details Modal */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailsModalContent, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDetailsModalVisible(false)}
            >
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            
            {selectedStaff && (
              <>
                <View style={styles.detailsHeader}>
                  {selectedStaff.photoUrl || selectedStaff.avatar_url ? (
                    <Image source={{ uri: selectedStaff.photoUrl || selectedStaff.avatar_url }} style={styles.detailsAvatar} />
                  ) : (
                    <View style={[styles.detailsAvatarPlaceholder, { backgroundColor: getRoleColor(selectedStaff.role || 'staff') + '30' }]}>
                      <Text style={[styles.detailsAvatarText, { color: getRoleColor(selectedStaff.role || 'staff') }]}>
                        {getInitials(selectedStaff.name || 'U')}
                      </Text>
                    </View>
                  )}
                  
                  <Text style={[styles.detailsName, { color: colors.text }]}>
                    {selectedStaff.name}
                  </Text>
                  
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(selectedStaff.role || 'staff') + '20' }]}>
                    <Icon name={getRoleIcon(selectedStaff.role || 'staff')} size={16} color={getRoleColor(selectedStaff.role || 'staff')} />
                    <Text style={[styles.roleText, { color: getRoleColor(selectedStaff.role || 'staff') }]}>
                      {(selectedStaff.role || 'staff').replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.detailsBody}>
                  <View style={styles.detailRow}>
                    <Icon name="email" size={20} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.text }]}>{selectedStaff.email}</Text>
                  </View>
                  
                  {selectedStaff.branchLocation && (
                    <View style={styles.detailRow}>
                      <Icon name="location-on" size={20} color={colors.textSecondary} />
                      <Text style={[styles.detailText, { color: colors.text }]}>{selectedStaff.branchLocation}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailRow}>
                    <Icon name="verified-user" size={20} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      {selectedStaff.isApproved !== false ? 'Approved' : 'Pending Approval'}
                    </Text>
                  </View>
                </View>
                
                {isManager && (
                  <View style={styles.detailsActions}>
                    <TouchableOpacity
                      style={[styles.detailsButton, { backgroundColor: Colors.primary }]}
                      onPress={() => {
                        setDetailsModalVisible(false);
                        handleEditStaff(selectedStaff);
                      }}
                    >
                      <Icon name="edit" size={18} color="#FFFFFF" />
                      <Text style={styles.detailsButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
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
  // Header Row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchToggle: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSizes.xl,
    fontWeight: 'bold',
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.xs,
  },
  // No Permission
  noPermissionCard: {
    margin: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  noPermissionText: {
    fontSize: FontSizes.lg,
  },
  // List Header
  listHeaderCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listHeaderTitle: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
  },
  // Staff Card - backgroundColor applied inline for theme support
  staffCard: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  staffContent: {
    flexDirection: 'row',
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(230, 0, 42, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FontSizes.lg,
    fontWeight: 'bold',
    color: designColors.primaryRed,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  staffEmail: {
    fontSize: FontSizes.sm,
    marginBottom: 2,
  },
  staffPhone: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  roleText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  infoText: {
    fontSize: FontSizes.sm,
  },
  staffActions: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: designColors.divider,
    paddingTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  actionButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  // Action Buttons Column - matching Kotlin StaffMemberCard
  actionButtonsColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 4,
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    height: 32,
    gap: 3,
  },
  activateBtnText: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
    color: '#4CAF50',
  },
  iconButtonsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: FontSizes.md,
  },
  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: designColors.primaryRed,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  formModalContent: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  textInput: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: FontSizes.md,
  },
  dropdownContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  dropdownItemText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  // Delete Modal
  deleteModalContent: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  deleteIcon: {
    marginBottom: Spacing.md,
  },
  deleteTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  deleteMessage: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  deleteButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  deleteButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Activate Modal
  activateModalContent: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  activateIcon: {
    marginBottom: Spacing.md,
  },
  activateTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  activateSubtitle: {
    fontSize: FontSizes.md,
    marginBottom: Spacing.xs,
  },
  activateEmail: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
  },
  activateBranchSection: {
    width: '100%',
    marginTop: Spacing.md,
  },
  branchList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  branchOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  branchOptionText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  activateButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    marginTop: Spacing.lg,
  },
  activateButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  activateButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Details Modal
  detailsModalContent: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  detailsHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  detailsAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: Spacing.md,
  },
  detailsAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  detailsAvatarText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  detailsName: {
    fontSize: FontSizes.xl,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  detailsBody: {
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailText: {
    fontSize: FontSizes.md,
    flex: 1,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Edit Modal
  editModalContent: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalSubtitle: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  roleOptions: {
    gap: Spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  roleOptionText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    textTransform: 'capitalize',
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
  // New styles for Kotlin-matching form
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  dropdownButtonText: {
    fontSize: FontSizes.md,
    flex: 1,
  },
  dropdownList: {
    marginTop: Spacing.xs,
    borderRadius: BorderRadius.md,
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownListItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  dropdownListItemText: {
    fontSize: FontSizes.md,
  },
  helperText: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cancelButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  submitButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
});

export default StaffScreen;
