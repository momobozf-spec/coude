'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput, SessionUser } from '@superette/contracts';
import { api, session } from './api';

const STORE_KEY = 'jj.store';

interface AuthValue {
  user: SessionUser | null;
  /** `true` zolang we nog niet weten óf er een sessie is. Voorkomt een flits van het loginscherm. */
  loading: boolean;
  storeId: string | null;
  setStoreId: (id: string) => void;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreIdState] = useState<string | null>(null);

  useEffect(() => {
    setStoreIdState(window.localStorage.getItem(STORE_KEY));

    if (!session.get()) {
      setLoading(false);
      return;
    }

    // Het token in localStorage kan verlopen of ingetrokken zijn. Alleen de
    // server weet dat. Vraag het, en ruim op als het antwoord nee is.
    api
      .me()
      .then(setUser)
      .catch(() => session.clear())
      .finally(() => setLoading(false));
  }, []);

  const setStoreId = useCallback((id: string) => {
    window.localStorage.setItem(STORE_KEY, id);
    setStoreIdState(id);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.login(input);
    session.set(response.accessToken);
    setUser(response.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await api.register(input);
    session.set(response.accessToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
    router.push('/inloggen');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, storeId, setStoreId, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth moet binnen <AuthProvider> gebruikt worden');
  return value;
}

/** Stuurt naar het loginscherm zodra vaststaat dat er geen sessie is. */
export function useRequireAuth(): { user: SessionUser | null; loading: boolean } {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/inloggen');
  }, [loading, user, router]);

  return { user, loading };
}
