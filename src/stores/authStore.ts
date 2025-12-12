import { create } from 'zustand';
import apiClient from '../api/ApiClient';
import { Profile, SignInRequest, SignUpRequest, User } from '../models';
import { socketService } from '../services/SocketService';
import { notificationService } from '../services/NotificationService';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  signIn: (request: SignInRequest) => Promise<void>;
  signUp: (request: SignUpRequest) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;  // Alias for signOut
  checkAuth: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  setUser: (user: User) => void;
  setProfile: (profile: Profile) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  signIn: async (request: SignInRequest) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.login(request.email, request.password);
      set({
        user: response.user,
        profile: response.profile,
        isAuthenticated: true,
        isLoading: false,
      });
      
      // Connect to Socket.IO for online presence
      if (response.accessToken && response.profile?.branchId && response.profile?.id) {
        socketService.connect(response.accessToken, response.profile.branchId, response.profile.id);
      }
      
      // Register FCM token for push notifications (disabled - FCM not available)
      // notificationService.onLogin().catch((e: unknown) => console.log('Push notification setup error:', e));
    } catch (error: any) {
      set({
        error: error.message || 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  signUp: async (request: SignUpRequest) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.signup(request);
      set({
        user: response.user,
        profile: response.profile,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Sign up failed',
        isLoading: false,
      });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      // Disconnect socket first
      socketService.disconnect();
      
      // Clean up push notifications (disabled - FCM not available)
      // notificationService.onLogout().catch((e: unknown) => console.log('Push notification cleanup error:', e));
      
      await apiClient.logout();
      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error: any) {
      set({ isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const isLoggedIn = await apiClient.isLoggedIn();
      if (isLoggedIn) {
        try {
          // Try to fetch profile - this will fail if token is invalid
          const profile = await apiClient.getProfile();
          const user = await apiClient.getCurrentUser();
          set({
            user,
            profile,
            isAuthenticated: true,
            isLoading: false,
          });
          
          // Connect to Socket.IO for online presence
          const token = await apiClient.getAuthToken();
          if (token && profile?.branchId && profile?.id) {
            socketService.connect(token, profile.branchId, profile.id);
          }
        } catch (error: any) {
          // Differentiate between network errors and auth errors
          const isNetworkError = error.name === 'AbortError' || 
                                error.message?.includes('Network') || 
                                error.message?.includes('Failed to fetch') ||
                                error.message?.includes('timeout');
          
          if (isNetworkError) {
            // Network error - keep logged in state, will retry later
            console.log('[AuthStore] Network error during auth check, staying logged in');
            set({ isLoading: false });
          } else {
            // Token exists but is invalid - clear auth state
            console.log('[AuthStore] Token invalid, clearing auth state');
            await apiClient.logout();
            set({
              user: null,
              profile: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        }
      } else {
        set({
          user: null,
          profile: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  refreshProfile: async () => {
    try {
      const profile = await apiClient.getProfile();
      set({ profile });
    } catch (error) {
      console.log('Error refreshing profile:', error);
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    try {
      const profile = await apiClient.updateProfile(updates);
      set({ profile });
    } catch (error) {
      console.log('Error updating profile:', error);
      throw error;
    }
  },

  // Alias for signOut
  logout: async () => {
    const state = useAuthStore.getState();
    await state.signOut();
  },

  setUser: (user: User) => set({ user }),
  setProfile: (profile: Profile) => set({ profile }),
  clearError: () => set({ error: null }),
}));
