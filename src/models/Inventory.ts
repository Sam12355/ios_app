// Inventory and stock models matching the Android/Web app

export interface Item {
  id: string;
  name: string;
  category: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  unit_of_measure: string;
  threshold_level: number;
  low_level?: number;
  critical_level?: number;
  image_url?: string;
  photo_url?: string;  // Alias for image_url
  storage_temperature?: number;
  base_unit?: string;
  enable_packaging?: boolean;
  packaging_unit?: string;
  units_per_package?: number;
  is_active: boolean;
  branch_id?: string;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface ItemDetails {
  name: string;
  category: string;
  threshold_level: number;
  low_level?: number;
  critical_level?: number;
  image_url?: string;
  photo_url?: string;  // Alias for image_url
  sku?: string;
  unit?: string;
  unit_of_measure?: string;
  branch_id: string;
  base_unit?: string;
  enable_packaging?: boolean;
  packaging_unit?: string;
  units_per_package?: number;
}

export interface StockItem {
  id: string;
  item_id: string;
  current_quantity: number;
  last_updated: string;
  items: ItemDetails;
}

export interface Stock {
  id: string;
  itemId: string;
  branchId: string;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastUpdated: string;
  item?: Item;
  branch?: Branch;
}

export interface StockMovement {
  id: string;
  itemId: string;
  branchId: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  reference?: string;
  notes?: string;
  userId: string;
  createdAt: string;
  item?: Item;
  branch?: Branch;
}

export interface StockReceipt {
  id: string;
  supplier_name: string;
  receipt_file_name: string;
  receipt_file_path?: string;
  remarks?: string;
  status: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by_name?: string;
  submitted_by_name?: string;
  // Legacy fields for backward compatibility
  supplier?: string;
  file_url?: string;
  submitted_by?: string;
  submitted_at?: string;
  profiles?: {
    name: string;
  };
}

export interface MoveoutList {
  id?: string;
  title?: string;
  description?: string;
  branch_id?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_by?: string;
  completed_by?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  items: MoveoutItem[];
  branch?: Branch;
  creator?: any;
  completer?: any;
}

export interface MoveoutItem {
  id?: string;
  moveout_list_id?: string;
  item_id: string;
  item_name: string;
  available_amount: number;
  request_amount: number;
  status?: string;
  completed: boolean;
  completed_at?: string;
  completed_by?: string;
  completed_by_name?: string;
  processed_by?: string;
  processed_at?: string;
  notes?: string;
  item?: Item;
  category?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_type: 'reorder' | 'delivery' | 'alert' | 'expiry' | 'usage_spike';
  branch_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ICADelivery {
  id: string;
  date: string;
  delivery_date?: string;
  delivery_time?: string;
  type: string;
  time_of_day: 'lunch' | 'dinner';
  quantity: number;
  status?: 'pending' | 'scheduled' | 'in_transit' | 'completed' | 'cancelled';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Branch and Organization models
export interface Region {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface District {
  id: string;
  name: string;
  code?: string;
  region_id?: string;
  regionId?: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  region?: Region;
}

export interface Branch {
  id: string;
  name: string;
  location?: string;
  districtId?: string;
  district_id?: string;
  region_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  district?: District;
  manager?: any;
}

// Dashboard models
export interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  criticalStockItems: number;
  thresholdStockItems: number;
  totalStaff: number;
  recentActivities: ActivityLog[];
  lowStockDetails?: StockDetail[];
  criticalStockDetails?: StockDetail[];
  thresholdStockDetails?: StockDetail[];
}

export interface ActivityLog {
  id: string;
  action: string;
  description?: string;
  details?: string;
  created_at: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  profiles?: {
    name: string;
  };
}

export interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
  humidity: number;
  windSpeed: number;
}

export interface StockDetail {
  id: string;
  name: string;
  category: string;
  currentQuantity: number;
  thresholdLevel: number;
  lowLevel: number;
  criticalLevel: number;
  imageUrl?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  read?: boolean;  // Alias for is_read
  created_at: string;
  user_id: string;
}

// Analytics models
export interface AnalyticsData {
  totalItems: number;
  lowStockItems: number;
  criticalItems: number;
  activeUsers: number;
  stockMovements24h: number;
  categoryBreakdown: CategoryBreakdown[];
  stockMovements: StockMovementData[];
  topItems: TopItemData[];
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  lowStock: number;
  critical: number;
}

export interface StockMovementData {
  date: string;
  stockIn: number;
  stockOut: number;
}

export interface TopItemData {
  name: string;
  movements: number;
}

// Report models
export interface StockReportItem {
  id: string;
  name: string;
  category: string;
  current_quantity: number;
  threshold_level: number;
  status: 'normal' | 'low' | 'critical';
}

export interface MovementReportItem {
  id: string;
  created_at: string;
  item_name: string;
  movement_type: 'in' | 'out';
  quantity: number;
  user_name: string | null;
  reason?: string;
}

export interface SoftDrinksReportData {
  item: string;
  weeks: Record<string, number>;
  total: number;
  average: number;
}

// Message models

