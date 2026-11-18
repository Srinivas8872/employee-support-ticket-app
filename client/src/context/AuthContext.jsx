import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate existing token and restore active session on mount
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await authApi.getMe();
        if (isMounted && response.data && response.data.success) {
          const freshUser = response.data.data.user || response.data.data;
          setUser(freshUser);
          setToken(storedToken);
          localStorage.setItem('user', JSON.stringify(freshUser));
        } else {
          throw new Error('Failed to verify session');
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for 'auth:unauthorized' events dispatched by Axios response interceptor on 401
  useEffect(() => {
    const handleUnauthorized = (event) => {
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Functional state resets: guard against redundant re-renders on concurrent 401s
      setUser((currentUser) => (currentUser !== null ? null : currentUser));
      setToken((currentToken) => (currentToken !== null ? null : currentToken));

      // Set contextual message for display on login page
      const expiredMessage =
        event?.detail?.message || 'Your session has expired. Please sign in again.';
      setError(expiredMessage);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      // Strict listener cleanup on unmount
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Standard user login
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(email, password);
      const { token: receivedToken, user: receivedUser } = response.data.data;

      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
      setLoading(false);

      return { success: true, user: receivedUser };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        (err.request
          ? 'Unable to reach backend server. Please verify the server is running.'
          : 'Login failed');
      setError(message);
      setLoading(false);
      return { success: false, message };
    }
  };

  // Standard user registration (forces Employee role on backend)
  const register = async (name, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.register(name, email, password);
      const { token: receivedToken, user: receivedUser } = response.data.data;

      localStorage.setItem('token', receivedToken);
      localStorage.setItem('user', JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
      setLoading(false);

      return { success: true, user: receivedUser };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        (err.request
          ? 'Unable to reach backend server. Please verify the server is running.'
          : 'Registration failed');
      setError(message);
      setLoading(false);
      return { success: false, message };
    }
  };

  // Logout clears token, user, and localStorage
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setError(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    loading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
