import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './theme';

const TOKEN_KEY = 'auth_token';
const REMEMBER_KEY = 'auth_remember';
const EMAIL_KEY = 'auth_remember_email';
const PASSWORD_KEY = 'auth_remember_password';

export type User = {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  role: 'admin' | 'formando';
  status: 'pending' | 'approved' | 'rejected';
  score_total: number;
  telegram_linked: boolean;
  telegram_start_token: string;
  last_seen?: string | null;
};

export type RegisterPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthed: boolean;
  isPending: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  register: (payload: RegisterPayload) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  getRememberedCredentials: () => Promise<{ remember: boolean; email: string; password: string }>;
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

  const persistRemember = async (remember: boolean, email: string, password: string) => {
    if (remember) {
      await AsyncStorage.setItem(REMEMBER_KEY, '1');
      await AsyncStorage.setItem(EMAIL_KEY, email);
      await AsyncStorage.setItem(PASSWORD_KEY, password);
    } else {
      await AsyncStorage.removeItem(REMEMBER_KEY);
      await AsyncStorage.removeItem(EMAIL_KEY);
      await AsyncStorage.removeItem(PASSWORD_KEY);
    }
  };

  const getRememberedCredentials = async () => {
    const r = await AsyncStorage.getItem(REMEMBER_KEY);
    const email = (await AsyncStorage.getItem(EMAIL_KEY)) || '';
    const password = (await AsyncStorage.getItem(PASSWORD_KEY)) || '';
    return { remember: r === '1', email, password };
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

  const login = async (email: string, password: string, remember = true) => {
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
      await persistRemember(remember, email, password);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: 'Erro de rede' };
    }
  };

  const register = async (payload: RegisterPayload) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.detail || 'Erro de registo' };
      setToken(data.access_token);
      setUser(data.user);
      await persistToken(data.access_token);
      // Auto-remember after register (user just chose a password)
      await persistRemember(true, payload.email, payload.password);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: 'Erro de rede' };
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await persistToken(null);
    await persistRemember(false, '', '');
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
        getRememberedCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
