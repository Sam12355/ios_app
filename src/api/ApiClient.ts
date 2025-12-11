import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ActivityLog,
    AnalyticsData,
    AuthResponse,
    Branch,
    CalendarEvent,
    ICADelivery,
    Item,
    MovementReportItem,
    MoveoutList,
    Notification,
    Profile,
    SignUpRequest,
    StockItem,
    StockReceipt,
    StockReportItem,
    User,
    WeatherData
} from '../models';

const BASE_URL = 'https://stock-nexus-84-main-2-1.onrender.com/api';
const SUPABASE_URL = 'https://gvlaokxdgcnttyovdhku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bGFva3hkZ2NudHR5b3ZkaGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDMwNzEsImV4cCI6MjA3NDY3OTA3MX0.yAHnpoADPvk0rMnyoWiloKFxJJAPbkbKi9KtgwGdWCw';

// Default timeout for API requests (15 seconds)
const DEFAULT_TIMEOUT = 15000;

// Delay helper for retry logic
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with timeout helper
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@stocknexus_access_token',
  REFRESH_TOKEN: '@stocknexus_refresh_token',
  USER_DATA: '@stocknexus_user_data',
  PROFILE_DATA: '@stocknexus_profile_data',
};

class ApiClient {
  private accessToken: string | null = null;
  private cachedProfile: Profile | null = null;
  private profileCacheExpiry: number = 0;
  private static PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.loadStoredToken();
    this.loadStoredProfile(); // Load cached profile on startup
  }

  private async loadStoredToken() {
    try {
      this.accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.log('Error loading stored token:', error);
    }
  }

  private async loadStoredProfile() {
    try {
      const profileData = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE_DATA);
      if (profileData) {
        this.cachedProfile = JSON.parse(profileData);
        this.profileCacheExpiry = Date.now() + ApiClient.PROFILE_CACHE_DURATION;
        console.log('[ApiClient] Loaded cached profile from storage');
      }
    } catch (error) {
      console.log('Error loading stored profile:', error);
    }
  }

  // Get cached profile or fetch if needed (for internal use - fast)
  private async getCachedProfile(): Promise<Profile | null> {
    const now = Date.now();
    if (this.cachedProfile && this.profileCacheExpiry > now) {
      return this.cachedProfile;
    }
    try {
      const profile = await this.getProfile();
      this.cachedProfile = profile;
      this.profileCacheExpiry = now + ApiClient.PROFILE_CACHE_DURATION;
      return profile;
    } catch (error) {
      console.error('[ApiClient] Failed to get cached profile:', error);
      return null;
    }
  }

  // Clear profile cache (call on logout or profile update)
  clearProfileCache() {
    this.cachedProfile = null;
    this.profileCacheExpiry = 0;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    if (!this.accessToken) {
      this.accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout = DEFAULT_TIMEOUT,
    retryCount = 0
  ): Promise<T> {
    const headers = await this.getHeaders();
    
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    }, timeout);

    // Handle rate limiting with retry
    if (response.status === 429 && retryCount < 3) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
      await delay(retryAfter * 1000);
      return this.request<T>(endpoint, options, timeout, retryCount + 1);
    }

    const text = await response.text();
    let data;
    
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return data;
  }

  // Auth methods
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<{ success: boolean; data: { user: any; token: string } }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    if (!response.success) {
      throw new Error('Login failed');
    }

    const userData = response.data.user;
    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      branchId: userData.branch_id,
      branchName: userData.branch_name,
      createdAt: userData.created_at || new Date().toISOString(),
      updatedAt: userData.updated_at,
    };

    const profile: Profile = {
      id: userData.id,
      userId: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      branchId: userData.branch_id || '',
      branchName: userData.branch_name || '',
      createdAt: userData.created_at || new Date().toISOString(),
      updatedAt: userData.updated_at || new Date().toISOString(),
    };

    const authResponse: AuthResponse = {
      user,
      profile,
      accessToken: response.data.token,
    };

    await this.saveAuthData(authResponse);
    return authResponse;
  }

  async signup(request: SignUpRequest): Promise<AuthResponse> {
    const response = await this.request<{ success: boolean; data: { user: any; token: string } }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    if (!response.success) {
      throw new Error('Sign up failed');
    }

    const userData = response.data.user;
    const user: User = {
      id: userData.id,
      email: userData.email,
      name: userData.name || request.name,
      role: userData.role || request.role || 'staff',
      branchId: userData.branch_id,
      createdAt: userData.created_at || new Date().toISOString(),
    };

    const profile: Profile = {
      id: userData.id,
      userId: userData.id,
      name: userData.name || request.name,
      email: userData.email,
      role: userData.role || request.role || 'staff',
      branchId: userData.branch_id || '',
      createdAt: userData.created_at || new Date().toISOString(),
      updatedAt: userData.updated_at || new Date().toISOString(),
    };

    const authResponse: AuthResponse = {
      user,
      profile,
      accessToken: response.data.token,
    };

    await this.saveAuthData(authResponse);
    return authResponse;
  }

  async logout(): Promise<void> {
    this.accessToken = null;
    this.clearProfileCache(); // Clear cached profile on logout
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.PROFILE_DATA,
    ]);
  }

  async getProfile(): Promise<Profile> {
    const response = await this.request<{ success: boolean; data: any }>('/auth/profile');
    const data = response.data;

    const profile: Profile = {
      id: data.id || '',
      userId: data.user_id,
      name: data.name || '',
      email: data.email || '',
      phone: data.phone,
      photoUrl: data.photo_url,
      position: data.position,
      role: data.role || 'staff',
      branchId: data.branch_id,
      branchContext: data.branch_context,
      branchName: data.branch_name,
      branchLocation: data.branch_location || data.branch_context,
      districtName: data.district_name,
      regionName: data.region_name,
      regionId: data.region_id,
      districtId: data.district_id,
      lastAccess: data.last_access,
      accessCount: data.access_count,
      createdAt: data.created_at || '',
      updatedAt: data.updated_at || data.created_at || '',
      notificationSettings: data.notification_settings,
      stockAlertFrequencies: data.stock_alert_frequencies,
      dailyScheduleTime: data.daily_schedule_time,
      weeklyScheduleDay: data.weekly_schedule_day,
      weeklyScheduleTime: data.weekly_schedule_time,
      monthlyScheduleDate: data.monthly_schedule_date,
      monthlyScheduleTime: data.monthly_schedule_time,
      eventReminderFrequencies: data.event_reminder_frequencies,
      eventDailyScheduleTime: data.event_daily_schedule_time,
      eventWeeklyScheduleDay: data.event_weekly_schedule_day,
      eventWeeklyScheduleTime: data.event_weekly_schedule_time,
      eventMonthlyScheduleDate: data.event_monthly_schedule_date,
      eventMonthlyScheduleTime: data.event_monthly_schedule_time,
      softdrinkTrendsFrequencies: data.softdrink_trends_frequencies,
      softdrinkTrendsDailyScheduleTime: data.softdrink_trends_daily_schedule_time,
      softdrinkTrendsWeeklyScheduleDay: data.softdrink_trends_weekly_schedule_day,
      softdrinkTrendsWeeklyScheduleTime: data.softdrink_trends_weekly_schedule_time,
      softdrinkTrendsMonthlyScheduleDate: data.softdrink_trends_monthly_schedule_date,
      softdrinkTrendsMonthlyScheduleTime: data.softdrink_trends_monthly_schedule_time,
      assistantManagerStockInAccess: data.assistant_manager_stock_in_access,
    };

    // Cache profile
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE_DATA, JSON.stringify(profile));
    return profile;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userJson) {
        return JSON.parse(userJson);
      }
      return null;
    } catch {
      return null;
    }
  }

  async getCurrentProfile(): Promise<Profile | null> {
    try {
      const profileJson = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE_DATA);
      if (profileJson) {
        return JSON.parse(profileJson);
      }
      // Try to fetch from API
      return await this.getProfile();
    } catch {
      return null;
    }
  }

  // Get user profile by ID (for loading thread participant info)
  async getUserProfileById(userId: string): Promise<Profile | null> {
    try {
      // Try /profile/:id endpoint first
      const response = await this.request<any>(`/profile/${userId}`);
      const data = response.data || response.user || response;
      return {
        id: data.id || userId,
        name: data.name || 'Unknown User',
        email: data.email || '',
        role: data.role || '',
        photoUrl: data.photo_url || data.photoUrl || null,
        branchId: data.branch_id || data.branchId || null,
        branchName: data.branch_name || data.branchName || null,
        districtName: data.district_name || data.districtName || null,
        regionName: data.region_name || data.regionName || null,
        createdAt: data.created_at || data.createdAt || '',
        updatedAt: data.updated_at || data.updatedAt || '',
      };
    } catch (error) {
      console.log(`[ApiClient] /profile/${userId} failed, trying /users/${userId}:`, error);
      try {
        const response = await this.request<any>(`/users/${userId}`);
        const data = response.data || response.user || response;
        return {
          id: data.id || userId,
          name: data.name || 'Unknown User',
          email: data.email || '',
          role: data.role || '',
          photoUrl: data.photo_url || data.photoUrl || null,
          branchId: data.branch_id || data.branchId || null,
          branchName: data.branch_name || data.branchName || null,
          districtName: data.district_name || data.districtName || null,
          regionName: data.region_name || data.regionName || null,
          createdAt: data.created_at || data.createdAt || '',
          updatedAt: data.updated_at || data.updatedAt || '',
        };
      } catch (e) {
        console.error(`[ApiClient] Failed to get user profile for ${userId}:`, e);
        return null;
      }
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    return !!token;
  }

  async getAuthToken(): Promise<string | null> {
    return this.accessToken || await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  private async saveAuthData(authResponse: AuthResponse): Promise<void> {
    this.accessToken = authResponse.accessToken;
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authResponse.accessToken);
    if (authResponse.refreshToken) {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(authResponse.user));
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE_DATA, JSON.stringify(authResponse.profile));
    
    // Warm the profile cache so messaging is fast
    if (authResponse.profile) {
      this.cachedProfile = authResponse.profile;
      this.profileCacheExpiry = Date.now() + ApiClient.PROFILE_CACHE_DURATION;
    }
  }

  // Stock/Inventory methods
  async getStockData(): Promise<StockItem[]> {
    const response = await this.request<{ success: boolean; data: StockItem[] }>('/stock');
    return response.data || [];
  }

  async getItems(): Promise<Item[]> {
    const response = await this.request<{ success: boolean; data: Item[] }>('/items');
    return response.data || [];
  }

  async createItem(itemData: Partial<Item>): Promise<Item> {
    const response = await this.request<{ success: boolean; data: Item }>('/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
    return response.data;
  }

  async updateItem(itemId: string, itemData: Partial<Item>): Promise<Item> {
    const response = await this.request<{ success: boolean; data: Item }>(`/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
    return response.data;
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.request(`/items/${itemId}`, { method: 'DELETE' });
  }

  async updateStockQuantity(
    itemId: string,
    movementType: 'in' | 'out',
    quantity: number,
    reason?: string,
    unitType: string = 'base',
    unitQuantity?: number,
    unitLabel?: string
  ): Promise<StockItem> {
    const response = await this.request<{ success: boolean; data: StockItem }>('/stock/movement', {
      method: 'POST',
      body: JSON.stringify({
        item_id: itemId,
        movement_type: movementType,
        quantity,
        reason,
        unit_type: unitType,
        unit_quantity: unitQuantity,
        unit_label: unitLabel,
      }),
    });
    return response.data;
  }

  async initializeStock(): Promise<{ initialized: number }> {
    const response = await this.request<{ success: boolean; data: { initialized: number } }>(
      '/stock/initialize',
      { method: 'POST' }
    );
    return response.data;
  }

  // Moveout lists
  async getMoveoutLists(): Promise<MoveoutList[]> {
    const response = await this.request<{ success: boolean; data: MoveoutList[] }>('/moveout-lists');
    return response.data || [];
  }

  async createMoveoutList(data: { title: string; description?: string; items?: any[] }): Promise<MoveoutList> {
    const response = await this.request<{ success: boolean; data: MoveoutList }>('/moveout-lists', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        items: (data.items || []).map(item => ({
          item_id: item.itemId || item.item_id,
          item_name: item.itemName || item.item_name,
          available_amount: item.availableAmount || item.available_amount,
          request_amount: item.requestAmount || item.request_amount,
          category: item.category || 'General',
        })),
      }),
    });
    return response.data;
  }

  async activateMoveoutList(listId: string): Promise<MoveoutList> {
    const response = await this.request<{ success: boolean; data: MoveoutList }>(
      `/moveout-lists/${listId}/activate`,
      { method: 'POST' }
    );
    return response.data;
  }

  async deleteMoveoutList(listId: string): Promise<void> {
    await this.request(`/moveout-lists/${listId}`, { method: 'DELETE' });
  }

  async processMoveoutItem(
    listId: string,
    itemId: string,
    quantity: number,
    userName: string
  ): Promise<void> {
    // Use the correct endpoint format matching Android/Web
    await this.request(`/moveout-lists/${listId}/process-item`, {
      method: 'POST',
      body: JSON.stringify({ itemId, quantity, userName }),
    });
  }

  // Calendar events - Using /calendar-events endpoint (same as Kotlin)
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    try {
      const response = await this.request<CalendarEvent[] | { success: boolean; data: CalendarEvent[] }>('/calendar-events');
      // Handle both array response and wrapped response
      if (Array.isArray(response)) {
        return response;
      }
      return (response as { success: boolean; data: CalendarEvent[] }).data || [];
    } catch (error) {
      console.log('Calendar events error, returning empty array:', error);
      return [];
    }
  }

  async createCalendarEvent(data: {
    title: string;
    description?: string;
    event_date: string;
    event_type: string;
    branch_id?: string;
  }): Promise<CalendarEvent> {
    const response = await this.request<{ success: boolean; data: CalendarEvent } | CalendarEvent>('/calendar-events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Handle both wrapped and direct response
    if ('success' in response) {
      return response.data;
    }
    return response as CalendarEvent;
  }

  // ICA Delivery
  async getICADeliveries(startDate?: string, endDate?: string): Promise<ICADelivery[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request<{ success: boolean; data: ICADelivery[] }>(
      `/ica-delivery${queryString}`
    );
    return response.data || [];
  }

  async createICADelivery(data: Omit<ICADelivery, 'id' | 'created_at' | 'updated_at'>): Promise<ICADelivery> {
    const response = await this.request<{ success: boolean; data: ICADelivery }>('/ica-delivery', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateICADelivery(id: string, data: Partial<ICADelivery>): Promise<ICADelivery> {
    const response = await this.request<{ success: boolean; data: ICADelivery }>(`/ica-delivery/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteICADelivery(id: string): Promise<void> {
    await this.request(`/ica-delivery/${id}`, { method: 'DELETE' });
  }

  // ICA Delivery Records - Matching Kotlin app structure
  // Uses GET /ica-delivery?startDate=...&endDate=... for fetching
  async getICADeliveryRecords(startDate?: string, endDate?: string): Promise<any[]> {
    try {
      const params: string[] = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      
      const queryString = params.length > 0 ? `?${params.join('&')}` : '';
      const response = await this.request<any[] | { success: boolean; data: any[] }>(
        `/ica-delivery${queryString}`
      );
      // Handle both array response and wrapped response
      if (Array.isArray(response)) {
        return response;
      }
      return (response as { success: boolean; data: any[] }).data || [];
    } catch (error) {
      console.log('ICA Delivery records error:', error);
      return [];
    }
  }

  // POST /ica-delivery for submitting new entries
  async submitICADelivery(data: {
    userName: string;
    entries: { type: string; amount: string; timeOfDay: string }[];
  }): Promise<any> {
    const requestBody = {
      userName: data.userName,
      entries: data.entries.map(e => ({
        type: e.type,
        amount: e.amount,
        timeOfDay: e.timeOfDay,
      })),
      submittedAt: new Date().toISOString(),
    };
    
    console.log('ICA Delivery API Request Body:', JSON.stringify(requestBody, null, 2));
    
    const response = await this.request<{ success: boolean; data: any } | any>('/ica-delivery', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    console.log('ICA Delivery API Response:', JSON.stringify(response, null, 2));
    
    return response;
  }

  // DELETE /ica-delivery/:id for deleting a record
  async deleteICADeliveryRecord(id: number): Promise<void> {
    await this.request(`/ica-delivery/${id}`, { method: 'DELETE' });
  }

  // Staff - Using /users/staff endpoint (same as Kotlin)
  async getStaff(): Promise<Profile[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/users/staff');
    if (!response.data) {
      console.warn('getStaff: No data in response');
      return [];
    }
    return response.data.map(staff => ({
      id: staff.id,
      userId: staff.user_id || staff.id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      photoUrl: staff.photo_url,
      avatar_url: staff.photo_url,
      position: staff.position,
      role: staff.role,
      branchId: staff.branch_id,
      branchName: staff.branch_name,
      regionId: staff.region_id,
      districtId: staff.district_id,
      districtName: staff.district_name,
      is_active: staff.is_active ?? true,
      last_access: staff.last_access,
      access_count: staff.access_count ?? 0,
      createdAt: staff.created_at || '',
      updatedAt: staff.updated_at || staff.created_at || '',
    }));
  }

  async approveStaff(userId: string): Promise<void> {
    await this.request(`/users/${userId}/approve`, { method: 'POST' });
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await this.request(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async createStaff(data: Record<string, any>): Promise<Profile> {
    const response = await this.request<{ success: boolean; data: any }>('/users/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateStaff(userId: string, data: Record<string, any>): Promise<Profile> {
    const response = await this.request<{ success: boolean; data: any }>(`/users/staff/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteStaff(userId: string): Promise<void> {
    await this.request(`/users/staff/${userId}`, { method: 'DELETE' });
  }

  async activateStaff(userId: string): Promise<void> {
    await this.request(`/users/${userId}/activate`, { method: 'POST' });
  }

  // Branches
  async getBranches(): Promise<Branch[]> {
    const response = await this.request<{ success: boolean; data: Branch[] }>('/branches');
    return response.data || [];
  }

  async createBranch(data: Partial<Branch>): Promise<Branch> {
    const response = await this.request<{ success: boolean; data: Branch }>('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateBranch(id: string, data: Partial<Branch>): Promise<Branch> {
    const response = await this.request<{ success: boolean; data: Branch }>(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteBranch(id: string): Promise<void> {
    await this.request(`/branches/${id}`, { method: 'DELETE' });
  }

  // Regions
  async getRegions(): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/regions');
    return response.data || [];
  }

  async createRegion(data: any): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>('/regions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateRegion(id: string, data: any): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>(`/regions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteRegion(id: string): Promise<void> {
    await this.request(`/regions/${id}`, { method: 'DELETE' });
  }

  // Districts
  async getDistricts(): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/districts');
    return response.data || [];
  }

  async createDistrict(data: any): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>('/districts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateDistrict(id: string, data: any): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>(`/districts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteDistrict(id: string): Promise<void> {
    await this.request(`/districts/${id}`, { method: 'DELETE' });
  }

  // Categories
  async getCategories(): Promise<any[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/categories');
    return response.data || [];
  }

  async createCategory(data: any): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateCategory(id: string, data: any): Promise<any> {
    const response = await this.request<{ success: boolean; data: any }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request(`/categories/${id}`, { method: 'DELETE' });
  }

  // Messaging
  async getThreads(): Promise<any[]> {
    try {
      console.log('[ApiClient] 📡 Calling GET /messages/threads');
      // Use /messages/threads as primary endpoint (confirmed working)
      const response = await this.request<any>('/messages/threads');
      console.log('[ApiClient] ✅ /messages/threads response:', JSON.stringify(response, null, 2));
      
      // Handle different response formats
      if (Array.isArray(response)) {
        console.log('[ApiClient] Response is array, length:', response.length);
        return response;
      }
      if (response.threads) {
        console.log('[ApiClient] Response has threads field, length:', response.threads.length);
        return response.threads;
      }
      if (response.data) {
        console.log('[ApiClient] Response has data field, length:', response.data.length);
        return response.data;
      }
      console.log('[ApiClient] ⚠️ Response format not recognized, returning empty');
      return [];
    } catch (error) {
      console.error('[ApiClient] ❌ /messages/threads failed:', error);
      return [];
    }
  }

  async getMessages(otherUserId: string): Promise<any[]> {
    try {
      // Get current user ID from cached profile (fast)
      const profile = await this.getCachedProfile();
      const currentUserId = profile?.id;
      if (!currentUserId) {
        console.error('[ApiClient] No current user ID for getMessages');
        return [];
      }
      
      console.log('[ApiClient] 📡 Fetching messages between', currentUserId, 'and', otherUserId);
      
      // Use same endpoint as Kotlin: /messages/thread?user1=X&user2=Y
      const response = await this.request<any>(`/messages/thread?user1=${currentUserId}&user2=${otherUserId}`);
      
      // Handle different response formats
      let rawMessages: any[] = [];
      if (Array.isArray(response)) {
        rawMessages = response;
      } else if (response.data) {
        rawMessages = response.data;
      } else if (response.messages) {
        rawMessages = response.messages;
      }
      
      // Normalize messages - handle read_at being false, null, or a timestamp
      const normalizedMessages = rawMessages.map((msg: any) => {
        // Handle read_at - can be false (boolean), null, or a timestamp string
        let readAt = msg.read_at ?? msg.readAt;
        if (readAt === false || readAt === 'false' || readAt === null || readAt === undefined) {
          readAt = null;
        }
        
        // Handle delivered_at similarly
        let deliveredAt = msg.delivered_at ?? msg.deliveredAt;
        if (deliveredAt === false || deliveredAt === 'false' || deliveredAt === null || deliveredAt === undefined) {
          deliveredAt = null;
        }
        
        return {
          id: msg.id,
          sender_id: msg.sender_id || msg.senderId,
          receiver_id: msg.receiver_id || msg.receiverId,
          content: msg.content || msg.message,
          sent_at: msg.sent_at || msg.sentAt || msg.created_at || msg.createdAt,
          created_at: msg.created_at || msg.createdAt || msg.sent_at || msg.sentAt,
          delivered_at: deliveredAt,
          read_at: readAt,
        };
      });
      
      console.log('[ApiClient] ✅ Got', normalizedMessages.length, 'messages');
      // Log a sample message to debug read_at
      if (normalizedMessages.length > 0) {
        const sample = normalizedMessages[normalizedMessages.length - 1];
        console.log('[ApiClient] Sample message read_at:', sample.read_at, 'delivered_at:', sample.delivered_at);
      }
      
      return normalizedMessages;
    } catch (error) {
      console.error('[ApiClient] ❌ Failed to fetch messages:', error);
      return [];
    }
  }

  async sendMessage(receiverId: string, content: string): Promise<any> {
    try {
      // Get current user ID from cached profile (fast)
      const profile = await this.getCachedProfile();
      const senderId = profile?.id;
      if (!senderId) {
        throw new Error('No current user ID for sendMessage');
      }
      
      console.log('[ApiClient] 📤 Sending message from', senderId, 'to', receiverId);
      
      // Use same endpoint as Kotlin: POST /messages/send
      const response = await this.request<any>('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          sender_id: senderId,
          receiver_id: receiverId,
          content: content,
        }),
      });
      
      console.log('[ApiClient] ✅ Message sent:', JSON.stringify(response, null, 2));
      return response.data || response.message || response;
    } catch (error) {
      console.error('[ApiClient] ❌ Failed to send message:', error);
      throw error;
    }
  }

  async markThreadAsRead(otherUserId: string): Promise<void> {
    try {
      // Get current user ID from cached profile (fast)
      const profile = await this.getCachedProfile();
      const currentUserId = profile?.id;
      if (!currentUserId) return;
      
      console.log('[ApiClient] 📖 Marking messages as read from', otherUserId);
      
      // Emit socket event to notify sender in real-time (matching Kotlin)
      // Import dynamically to avoid circular dependencies
      try {
        const { socketService } = require('../services/SocketService');
        if (socketService.isSocketConnected()) {
          // Emit with same format as Kotlin: markMessagesRead with conversationPartnerId
          socketService.emit('markMessagesRead', { conversationPartnerId: otherUserId });
          console.log('[ApiClient] 📡 Emitted markMessagesRead socket event for:', otherUserId);
        }
      } catch (socketError) {
        console.log('[ApiClient] Could not emit socket event:', socketError);
      }
      
      // Try to mark as read - endpoint may vary
      await this.request('/messages/read', {
        method: 'POST',
        body: JSON.stringify({
          reader_id: currentUserId,
          sender_id: otherUserId,
        }),
      });
    } catch (error) {
      // Silently fail - read status is not critical
      console.log('[ApiClient] Could not mark as read:', error);
    }
  }

  // Password
  async changePassword(data: { current_password: string; new_password: string }): Promise<void> {
    await this.request('/users/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Weather
  async getWeather(city: string): Promise<WeatherData> {
    try {
      const response = await this.request<{ success: boolean; data: WeatherData }>(
        `/weather/current?location=${encodeURIComponent(city)}`
      );
      return response.data;
    } catch (error) {
      console.log('Weather API error, returning defaults:', error);
      // Return default weather on error (matching Android behavior)
      return {
        temperature: 15,
        condition: 'Clear sky',
        location: city,
        humidity: 70,
        windSpeed: 10,
      };
    }
  }

  // Activity logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    const response = await this.request<{ success: boolean; data: any[] }>('/activity-logs');
    return response.data || [];
  }

  // Receipts
  async getReceipts(): Promise<StockReceipt[]> {
    const response = await this.request<{ success: boolean; data: StockReceipt[] }>('/receipts');
    return response.data || [];
  }

  async createReceipt(data: {
    receiptNumber?: string;
    supplier?: string;
    notes?: string;
    items?: Array<{ item_id: string; quantity: number; notes?: string }>;
  }): Promise<StockReceipt> {
    const response = await this.request<{ success: boolean; data: StockReceipt }>('/receipts', {
      method: 'POST',
      body: JSON.stringify({
        receipt_number: data.receiptNumber,
        supplier: data.supplier,
        notes: data.notes,
        items: data.items,
      }),
    });
    return response.data;
  }

  async submitReceipt(data: FormData): Promise<StockReceipt> {
    const headers = await this.getHeaders();
    delete headers['Content-Type']; // Let fetch set it for FormData
    
    const response = await fetch(`${BASE_URL}/receipts`, {
      method: 'POST',
      headers,
      body: data,
    });
    
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Failed to submit receipt');
    }
    return json.data;
  }

  async updateReceiptStatus(id: string, status: 'approved' | 'rejected'): Promise<StockReceipt> {
    const response = await this.request<{ success: boolean; data: StockReceipt }>(
      `/receipts/${id}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }
    );
    return response.data;
  }

  // Analytics
  async getAnalyticsData(): Promise<AnalyticsData> {
    const response = await this.request<{ success: boolean; data: AnalyticsData }>('/analytics');
    return response.data;
  }

  // Alias for getAnalyticsData
  async getAnalytics(): Promise<AnalyticsData> {
    return this.getAnalyticsData();
  }

  async getItemUsageAnalytics(period: string = 'daily', itemId?: string): Promise<any[]> {
    const params = new URLSearchParams({ period });
    if (itemId) params.append('item_id', itemId);
    
    const response = await this.request<{ success: boolean; data: any[] }>(
      `/analytics/usage?${params.toString()}`
    );
    return response.data || [];
  }

  // Reports
  async getStockReport(): Promise<StockReportItem[]> {
    const response = await this.request<{ success: boolean; data: StockReportItem[] }>('/reports/stock');
    return response.data || [];
  }

  async getMovementsReport(): Promise<MovementReportItem[]> {
    const response = await this.request<{ success: boolean; data: MovementReportItem[] }>(
      '/reports/movements'
    );
    return response.data || [];
  }

  async getSoftDrinksReport(weeks: number = 4): Promise<{ data: any[]; summary?: any }> {
    const response = await this.request<{ success: boolean; data: any[]; summary?: any }>(`/reports/softdrinks-weekly?weeks=${weeks}`);
    return { data: response.data || [], summary: response.summary };
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const response = await this.request<{ success: boolean; data: Notification[] }>('/notifications');
    return response.data || [];
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.request(`/notifications/${id}/read`, { method: 'POST' });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.request('/notifications/read-all', { method: 'POST' });
  }

  // Settings
  async updateProfile(updates: Partial<Profile>): Promise<Profile> {
    // Convert camelCase to snake_case for API
    const apiUpdates: Record<string, any> = {};
    if (updates.name !== undefined) apiUpdates.name = updates.name;
    if (updates.phone !== undefined) apiUpdates.phone = updates.phone;
    if (updates.position !== undefined) apiUpdates.position = updates.position;
    if (updates.photoUrl !== undefined) apiUpdates.photo_url = updates.photoUrl;
    
    const response = await this.request<{ success: boolean; data: Profile }>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(apiUpdates),
    });
    return response.data;
  }

  async updateProfilePhoto(photoUri: string): Promise<Profile> {
    // Use Supabase RPC function to update photo
    const user = await this.getCurrentUser();
    if (!user?.id) {
      throw new Error('User not logged in');
    }
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id_param: user.id,
        new_photo_url: photoUri,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update photo');
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to update photo');
    }
    
    // Refresh and return updated profile
    return this.getProfile();
  }

  async updateNotificationSettings(settings: Record<string, boolean>): Promise<Profile> {
    const response = await this.request<{ success: boolean; data: Profile }>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify({ notification_settings: settings }),
    });
    return response.data;
  }

  /**
   * Update FCM token on backend for push notifications
   * Endpoint: POST /fcm/token
   */
  async updateFCMToken(fcmToken: string): Promise<void> {
    try {
      console.log('📱 ApiClient: Updating FCM token...');
      await this.request<{ success: boolean }>('/fcm/token', {
        method: 'POST',
        body: JSON.stringify({ fcm_token: fcmToken }),
      });
      console.log('✅ ApiClient: FCM token updated successfully');
    } catch (error) {
      console.error('❌ ApiClient: Failed to update FCM token:', error);
      throw error;
    }
  }
}

export const apiClient = new ApiClient();
export default apiClient;
