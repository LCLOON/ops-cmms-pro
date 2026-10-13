'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface User {
  id: number; username: string; displayName: string;
  role: 'admin' | 'manager' | 'technician' | 'viewer';
  forcePasswordChange?: boolean;
}

interface AuthContextType {
  user: User | null; loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  canEdit: boolean; isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, login: async () => 'Not initialized',
  logout: async () => {}, refreshSession: async () => {}, canEdit: false, isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(() =>
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false)), []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const login = useCallback(async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || 'Login failed';
      setUser(data.user); return null;
    } catch { return 'Network error'; }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/session', { method: 'POST' });
    setUser(null);
  }, []);

  const canEdit = !!user && user.role !== 'viewer';
  const isAdmin = !!user && user.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshSession: checkSession, canEdit, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
