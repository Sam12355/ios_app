import { create } from 'zustand';
import apiClient from '../api/ApiClient';
import { Profile, SignInRequest, SignUpRequest, User } from '../models';

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
        const profile = await apiClient.getProfile();
        const user = await apiClient.getCurrentUser();
        set({
          user,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
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
