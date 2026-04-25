import { useState, useEffect, useCallback } from 'react';
import type { User, AuthError } from '../types/auth';

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string | null, newPassword: string) => Promise<void>;
  deleteAccount: (password: string | null) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AUTH_BASE = '/api/auth';

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Serwer zwrócił nieoczekiwaną odpowiedź. Spróbuj ponownie później.');
  }

  const data = await res.json();
  if (!res.ok) {
    const errData = data as AuthError;
    throw new Error(errData.error || 'Wystąpił nieznany błąd.');
  }
  return data as T;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check auth status on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const userData = await authFetch<User>('/me');
        if (!cancelled) setUser(userData);
      } catch {
        // Not authenticated — that's fine
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  // Handle OAuth redirect result (URL params ?auth=success or ?auth=error&message=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('auth');

    if (authResult === 'success') {
      // Re-fetch user after OAuth redirect
      authFetch<User>('/me').then(setUser).catch(() => {});
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.pathname);
    } else if (authResult === 'error') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time init from URL params on mount
      setError(params.get('message') || 'Logowanie nie powiodło się.');
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      url.searchParams.delete('message');
      window.history.replaceState({}, '', url.pathname);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const userData = await authFetch<User>('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logowanie nie powiodło się.';
      setError(message);
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setError(null);
    try {
      const userData = await authFetch<User>('/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rejestracja nie powiodła się.';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch<{ ok: boolean }>('/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors — clear client state regardless
    }
    setUser(null);
    setError(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string | null, newPassword: string) => {
    setError(null);
    try {
      await authFetch<{ ok: boolean }>('/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Zmiana hasła nie powiodła się.';
      setError(message);
      throw err;
    }
  }, []);

  const deleteAccount = useCallback(async (password: string | null) => {
    setError(null);
    try {
      await authFetch<{ ok: boolean }>('/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Usunięcie konta nie powiodło się.';
      setError(message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    register,
    logout,
    changePassword,
    deleteAccount,
    error,
    clearError,
  };
}
