import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './theme';

const TOKEN_KEY = 'auth_token';

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'formando';
  status: 'pending' | 'approved' | 'rejected';
  score_total: number;
  telegram_linked: boolean;
  telegram_start_token: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthed: boolean;
  isPending: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, password: string, name: string, phone: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType>(null as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistToken = async (t: string | null) => {
    if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  };

  const fetchMe = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as User;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (stored) {
        const me = await fetchMe(stored);
        if (me) {
          setToken(stored);
          setUser(me);
        } else {
          await persistToken(null);
        }
      }
      setLoading(false);
    })();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.detail || 'Erro de autenticação' };
      setToken(data.access_token);
      setUser(data.user);
      await persistToken(data.access_token);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: 'Erro de rede' };
    }
  };

  const register = async (email: string, password: string, name: string, phone: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.detail || 'Erro de registo' };
      setToken(data.access_token);
      setUser(data.user);
      await persistToken(data.access_token);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: 'Erro de rede' };
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await persistToken(null);
  };

  const refresh = async () => {
    if (!token) return;
    const me = await fetchMe(token);
    if (me) setUser(me);
  };

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const url = path.startsWith('http') ? path : `${API_URL}${path}`;
      const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> | undefined),
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetch(url, { ...init, headers });
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAdmin: user?.role === 'admin',
        isAuthed: !!user,
        isPending: user?.status === 'pending',
        login,
        register,
        logout,
        refresh,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
