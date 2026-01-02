// src/store/AuthContext.tsx
// Authentication state management with React Context

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authApi, User, LoginData, RegisterData } from '../api';
import apiClient from '../api/client';

// State types
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

// Action types
type AuthAction =
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: User }
  | { type: 'INIT_FAILURE' }
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'REGISTER_START' }
  | { type: 'REGISTER_SUCCESS'; payload: User }
  | { type: 'REGISTER_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

// Initial state
const storedUser = localStorage.getItem('user');
const initialUser: User | null = storedUser ? JSON.parse(storedUser) : null;
const hasToken = !!localStorage.getItem('accessToken');

const initialState: AuthState = {
  user: initialUser,
  isAuthenticated: hasToken && !!initialUser,
  isLoading: false, // Don't block UI if we have potential data
  isInitialized: false,
  error: null,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'INIT_START':
      // If we already have a user (optimistic), don't set loading
      return { ...state, isLoading: !state.user };
    case 'INIT_SUCCESS':
      localStorage.setItem('user', JSON.stringify(action.payload));
      return {
        ...state,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: true,
        user: action.payload,
        error: null,
      };
    case 'INIT_FAILURE':
      localStorage.removeItem('user');
      return {
        ...state,
        isLoading: false,
        isInitialized: true,
        isAuthenticated: false,
        user: null,
      };
    case 'LOGIN_START':
    case 'REGISTER_START':
      return { ...state, error: null }; // Do NOT set isLoading: true to avoid global loader
    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      localStorage.setItem('user', JSON.stringify(action.payload));
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload,
        error: null,
      };
    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      localStorage.removeItem('user');
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        error: null,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'UPDATE_USER':
      const updatedUser = state.user ? { ...state.user, ...action.payload } : null;
      if (updatedUser) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      return {
        ...state,
        user: updatedUser,
      };
    default:
      return state;
  }
}

// Context types
interface AuthContextType extends AuthState {
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateUser: (data: Partial<User>) => void;
  loginWithGoogle: (idToken: string) => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = apiClient.getAccessToken();

      if (!accessToken) {
        dispatch({ type: 'INIT_FAILURE' });
        return;
      }

      dispatch({ type: 'INIT_START' });

      try {
        const { user } = await authApi.getCurrentUser();
        dispatch({ type: 'INIT_SUCCESS', payload: user });
      } catch (error) {
        dispatch({ type: 'INIT_FAILURE' });
      }
    };

    initAuth();

    // Listen for logout events from API client
    const handleLogout = () => {
      dispatch({ type: 'LOGOUT' });
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = useCallback(async (data: LoginData) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      await authApi.login(data);
      // Fetch full user details (including role) immediately to ensure UI sync
      const { user } = await authApi.getCurrentUser();
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      throw error;
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    dispatch({ type: 'REGISTER_START' });
    try {
      await authApi.register(data);
      // Fetch full user details immediately
      const { user } = await authApi.getCurrentUser();
      dispatch({ type: 'REGISTER_SUCCESS', payload: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      dispatch({ type: 'REGISTER_FAILURE', payload: message });
      throw error;
    }
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      await authApi.loginWithGoogle(idToken);
      // Fetch full user details immediately
      const { user } = await authApi.getCurrentUser();
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: data });
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    clearError,
    updateUser,
    loginWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
