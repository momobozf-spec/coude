'use client';

/**
 * De werkende voorkeuren: uit het profiel voor ingelogde gebruikers, uit de
 * browser voor bezoekers. Zoeken, productdetail en promoties gebruiken ze om
 * de ketens en de opties (persoonlijk, online) te bepalen.
 */
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_COMPARE_PREFERENCES, type ComparePreferences } from '@superette/contracts';
import { api } from './api';
import { useAuth } from './auth';
import { readGuestPreferences, writeGuestPreferences } from './local-preferences';

export function usePreferences(): {
  preferences: ComparePreferences;
  loading: boolean;
  isGuest: boolean;
  save: (next: ComparePreferences) => Promise<ComparePreferences>;
  reload: () => void;
} {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<ComparePreferences>(DEFAULT_COMPARE_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setPreferences(readGuestPreferences());
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .preferences()
      .then(setPreferences)
      .catch(() => setPreferences(DEFAULT_COMPARE_PREFERENCES))
      .finally(() => setLoading(false));
  }, [user, authLoading, version]);

  const save = useCallback(
    async (next: ComparePreferences): Promise<ComparePreferences> => {
      if (!user) {
        writeGuestPreferences(next);
        setPreferences(next);
        return next;
      }
      const saved = await api.updatePreferences(next);
      setPreferences(saved);
      return saved;
    },
    [user],
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { preferences, loading: authLoading || loading, isGuest: !user, save, reload };
}
