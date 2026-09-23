import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginInput, RegisterInput, UserDto } from '@superrette/validation';
import { ApiClient } from '../api/client';
import { endpoints, type Endpoints } from '../api/endpoints';
import { secureTokenStore } from '../api/token-store';
import { API_URL } from '../lib/config';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

interface SessionValue {
  api: Endpoints;
  client: ApiClient;
  status: 'loading' | 'signed-out' | 'signed-in';
  user: UserDto | null;
  signIn(input: LoginInput): Promise<void>;
  signUp(input: RegisterInput): Promise<void>;
  signOut(): Promise<void>;
  refreshUser(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): ReactNode {
  const qc = useQueryClient();
  const [hasTokens, setHasTokens] = useState<boolean | null>(null);
  const client = useMemo(() => new ApiClient(API_URL, secureTokenStore, undefined, () => setHasTokens(false)), []);
  const api = useMemo(() => endpoints(client), [client]);

  useEffect(() => {
    void secureTokenStore.get().then((t) => setHasTokens(Boolean(t)));
  }, []);

  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: hasTokens === true, retry: false });

  const signIn = useCallback(
    async (input: LoginInput) => {
      const auth = await api.login(input);
      await client.setSession(auth);
      qc.setQueryData(['me'], auth.user);
      setHasTokens(true);
    },
    [api, client, qc],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      const auth = await api.register(input);
      await client.setSession(auth);
      qc.setQueryData(['me'], auth.user);
      setHasTokens(true);
    },
    [api, client, qc],
  );

  const signOut = useCallback(async () => {
    await client.clearSession();
    qc.clear();
    setHasTokens(false);
  }, [client, qc]);

  const refreshUser = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['me'] });
  }, [qc]);

  const status: SessionValue['status'] =
    hasTokens === null || (hasTokens && me.isLoading) ? 'loading' : hasTokens && me.data ? 'signed-in' : 'signed-out';

  const value = useMemo<SessionValue>(
    () => ({ api, client, status, user: me.data ?? null, signIn, signUp, signOut, refreshUser }),
    [api, client, status, me.data, signIn, signUp, signOut, refreshUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

export function useApi(): Endpoints {
  return useSession().api;
}
