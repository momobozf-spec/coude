'use client';

import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** Opnieuw laden, bv. na een fout of een wijziging. */
  reload: () => void;
  /** Lokaal bijwerken zonder opnieuw te laden (optimistisch of na een mutatie). */
  setData: (data: T | null) => void;
}

/**
 * Laadt iets asynchroon en houdt laad-, fout- en datastatus bij.
 * Een verouderd antwoord (van een eerdere aanroep) wordt genegeerd.
 */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList, enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [version, setVersion] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);

    load()
      .then((result) => {
        if (ticket !== latest.current) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (ticket !== latest.current) return;
        setError(cause);
      })
      .finally(() => {
        if (ticket === latest.current) setLoading(false);
      });
    // De aanroeper bepaalt de afhankelijkheden, zoals bij useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, enabled]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, error, loading, reload, setData };
}
