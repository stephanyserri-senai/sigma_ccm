import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api';
import type { Page } from './App';

export type User = {
  id: number;
  nome: string;
  username: string;
  papel: 'CCM' | 'PCM' | 'EXECUTANTE';
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, senha: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function homeFor(papel: User['papel']): Page {
  return papel === 'EXECUTANTE' ? 'field' : 'dashboard';
}

export const PERMS: Record<User['papel'], Page[]> = {
  CCM: [
    'dashboard',
    'orders',
    'new-order',
    'assets',
    'schedule',
    'indicators',
    'reports',
    'alerts',
    'users',
    'settings',
    'field',
  ],
  PCM: [
    'dashboard',
    'orders',
    'new-order',
    'assets',
    'schedule',
    'indicators',
    'reports',
    'alerts',
  ],
  EXECUTANTE: ['field'],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('sigma_token');

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userData = await api.me();
        setUser({
          id: Number(userData.id),
          nome: userData.nome,
          username: userData.username,
          papel: userData.papel as User['papel'],
        });
      } catch {
        api.clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (username: string, senha: string) => {
    const data = await api.login(username, senha);
    setUser({
      id: Number(data.user.id),
      nome: data.user.nome,
      username: data.user.username,
      papel: data.user.papel as User['papel'],
    });
  };

  const logout = () => {
    localStorage.removeItem('sigma_token');
    api.clearToken();
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
