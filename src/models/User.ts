// User roles matching the Android/Web app
export type UserRole = 'admin' | 'super_admin' | 'manager' | 'assistant_manager' | 'staff' | 'regional_manager' | 'district_manager';

export interface User {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  phone?: string;
  photoUrl?: string;
  avatarUrl?: string;
  avatar_url?: string;
  photo_url?: string;
  position?: string;
  role: UserRole;
  branchId?: string;
  branch_name?: string;
  branchContext?: string;
  branchName?: string;
  branchLocation?: string;
  districtName?: string;
  regionName?: string;
  regionId?: string;
  districtId?: string;
  accessCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
  isActive?: boolean;
  isApproved?: boolean;
  needsPasswordReset?: boolean;
  notificationSettings?: Record<string, boolean>;
  stockAlertFrequencies?: string[];
  dailyScheduleTime?: string;
  weeklyScheduleDay?: number;
  weeklyScheduleTime?: string;
  monthlyScheduleDate?: number;
  monthlyScheduleTime?: string;
  eventReminderFrequencies?: string[];
  eventDailyScheduleTime?: string;
  eventWeeklyScheduleDay?: number;
  eventWeeklyScheduleTime?: string;
  eventMonthlyScheduleDate?: number;
  eventMonthlyScheduleTime?: string;
  softdrinkTrendsFrequencies?: string[];
  softdrinkTrendsDailyScheduleTime?: string;
  softdrinkTrendsWeeklyScheduleDay?: number;
  softdrinkTrendsWeeklyScheduleTime?: string;
  softdrinkTrendsMonthlyScheduleDate?: number;
  softdrinkTrendsMonthlyScheduleTime?: string;
  assistantManagerStockInAccess?: boolean;
}

export interface Profile {
  id: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  avatarUrl?: string;
  avatar_url?: string;
  position?: string;
  role: UserRole | string;
  branchId?: string;
  branchContext?: string;
  branchName?: string;
  branchLocation?: string;
  districtName?: string;
  regionName?: string;
  regionId?: string;
  districtId?: string;
  lastAccess?: string;
  accessCount?: number;
  isApproved?: boolean;
  createdAt: string;
  updatedAt: string;
  notificationSettings?: Record<string, boolean>;
  stockAlertFrequencies?: string[];
  dailyScheduleTime?: string;
  weeklyScheduleDay?: number;
  weeklyScheduleTime?: string;
  monthlyScheduleDate?: number;
  monthlyScheduleTime?: string;
  eventReminderFrequencies?: string[];
  eventDailyScheduleTime?: string;
  eventWeeklyScheduleDay?: number;
  eventWeeklyScheduleTime?: string;
  eventMonthlyScheduleDate?: number;
  eventMonthlyScheduleTime?: string;
  softdrinkTrendsFrequencies?: string[];
  softdrinkTrendsDailyScheduleTime?: string;
  softdrinkTrendsWeeklyScheduleDay?: number;
  softdrinkTrendsWeeklyScheduleTime?: string;
  softdrinkTrendsMonthlyScheduleDate?: number;
  softdrinkTrendsMonthlyScheduleTime?: string;
  assistantManagerStockInAccess?: boolean;
}

export interface AuthResponse {
  user: User;
  profile: Profile;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
  branchId?: string;
}

export interface PasswordResetRequest {
  email: string;
}
