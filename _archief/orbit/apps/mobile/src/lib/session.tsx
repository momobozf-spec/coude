import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import type { User } from '@orbit/types';
import { api, secureTokenStore, setUnauthenticatedHandler, setWorkspaceId } from './client';

/**
 * De sessie op mobiel. Bij het opstarten proberen we de bewaarde tokens; lukt
 * dat niet, dan gaat de gebruiker naar het inlogscherm. De client zelf ververst
 * verlopen tokens onderweg, dus dit is alleen de start- en eindtoestand.
 */

interface SessionValue {
  user: User | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const platform = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null);
      router.replace('/login');
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tokens = await secureTokenStore.get();
      if (!tokens) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await api().me();
        if (cancelled) return;
        await setWorkspaceId(me.currentWorkspaceId);
        setUser(me.user);
      } catch {
        await secureTokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api().login({ email, password, platform, deviceName: Platform.OS });
    await setWorkspaceId(result.workspace.id);
    setUser(result.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const result = await api().register({
      email,
      password,
      name,
      platform,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    await setWorkspaceId(result.workspace.id);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    await api().logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession moet binnen SessionProvider gebruikt worden');
  return context;
}
