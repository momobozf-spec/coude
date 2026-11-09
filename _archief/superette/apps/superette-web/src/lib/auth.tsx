'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterSuperetteInput, SessionUser } from '@superette/contracts';
import { api, ApiError, SESSION_EXPIRED_EVENT } from './api';

interface AuthValue {
  user: SessionUser | null;
  /** `true` zolang we nog niet weten óf er een sessie is. Voorkomt een flits van het loginscherm. */
  loading: boolean;
  /** De sessie is verlopen of ingetrokken sinds de laatste actie; de app toont dat één keer. */
  sessionExpired: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterSuperetteInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Na accountverwijdering: lokale status wissen zonder de API nog aan te roepen. */
  forget: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // Alleen de server weet of er een geldige sessiecookie is. Een 401 betekent
    // gewoon: niet ingelogd — geen fout, geen melding.
    api
      .me()
      .then((me) => setUser(me))
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) setSessionExpired(true);
        return null;
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.login(input);
    setUser(response.user);
    setSessionExpired(false);
  }, []);

  const register = useCallback(async (input: RegisterSuperetteInput) => {
    const response = await api.register(input);
    setUser(response.user);
    setSessionExpired(false);
  }, []);

  const logout = useCallback(async () => {
    // Server-side intrekken; lukt dat niet (offline), dan is de cookie straks gewoon verlopen.
    await api.logout().catch(() => undefined);
    setUser(null);
    router.push('/');
  }, [router]);

  const forget = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, loading, sessionExpired, login, register, logout, forget }), [user, loading, sessionExpired, login, register, logout, forget]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth moet binnen <AuthProvider> gebruikt worden');
  return value;
}

/** Stuurt naar het loginscherm zodra vaststaat dat er geen sessie is; onthoudt waar je heen wilde. */
export function useRequireAuth(returnTo?: string): { user: SessionUser | null; loading: boolean } {
  const { user, loading, sessionExpired } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const target = returnTo ?? (typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search);
      router.replace(`/inloggen?terug=${encodeURIComponent(target)}${sessionExpired ? '&reden=verlopen' : ''}`);
    }
  }, [loading, user, router, returnTo, sessionExpired]);

  return { user, loading };
}
