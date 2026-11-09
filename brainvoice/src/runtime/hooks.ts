import { useCallback, useEffect, useState } from 'react';

import { getRuntime, useAppStore } from './stores/appStore';
import type { Agenda } from '@core/services/AgendaService';
import type { TaskView } from '@core/db/repositories/TaskRepository';
import type { NoteFilter } from '@core/db/repositories/NoteRepository';
import type { ActionHistoryEntry, Alarm, Capture, Note, Task } from '@core/domain/entities';
import type { AppSettings } from '@core/services/SettingsService';
import type { Language } from '@core/types/common';

/** Generic async loader that refetches whenever the data version changes. */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []): { data: T | null; loading: boolean; error: Error | null; reload: () => void } {
  const dataVersion = useAppStore((s) => s.dataVersion);
  const status = useAppStore((s) => s.status);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status !== 'ready') return;
    let cancelled = false;
    // Loading stays true only until the first result; later refreshes are silent to avoid flicker.
    loader()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dataVersion, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

export function useSettings(): AppSettings {
  return useAppStore((s) => s.settings);
}

export function useLanguage(): Language {
  const settings = useSettings();
  const status = useAppStore((s) => s.status);
  if (status !== 'ready') return settings.language === 'auto' ? 'en' : settings.language;
  return getRuntime().language();
}

export function useTimezone(): string {
  const status = useAppStore((s) => s.status);
  return status === 'ready' ? getRuntime().timezone() : 'UTC';
}

export function useAgenda(date?: string, rangeDays = 1) {
  return useAsyncData<Agenda>(() => {
    const rt = getRuntime();
    return rt.services.agenda.getRange(date ?? rt.clock.today(), rangeDays);
  }, [date, rangeDays]);
}

export function useTasks(view: TaskView, listName?: string | null) {
  return useAsyncData<Task[]>(() => getRuntime().services.tasks.list(view, listName === undefined ? {} : { listName }), [view, listName]);
}

export function useTaskCounts() {
  return useAsyncData(() => getRuntime().services.tasks.counts());
}

export function useNotes(filter: NoteFilter = {}) {
  return useAsyncData<Note[]>(() => getRuntime().services.notes.list(filter), [JSON.stringify(filter)]);
}

export function useNote(id: string | null) {
  return useAsyncData<Note | null>(() => (id ? getRuntime().services.notes.getById(id) : Promise.resolve(null)), [id]);
}

export function useTask(id: string | null) {
  return useAsyncData<Task | null>(() => (id ? getRuntime().services.tasks.getById(id) : Promise.resolve(null)), [id]);
}

export function useCaptures(limit = 20) {
  return useAsyncData<Capture[]>(() => getRuntime().services.captures.listRecent(limit), [limit]);
}

export function useUnprocessedCaptures() {
  return useAsyncData<Capture[]>(() => getRuntime().services.captures.listUnprocessed());
}

export function useHistory(limit = 50) {
  // Connected mode shows the server's history (Alfred's actions); local mode this phone's.
  return useAsyncData<ActionHistoryEntry[]>(() => getRuntime().opsHost.client().call('history.listRecent', [limit]) as Promise<ActionHistoryEntry[]>, [limit]);
}

export function useScheduledAlarms() {
  return useAsyncData<Alarm[]>(() => getRuntime().services.alarms.listScheduled());
}

export function useCategories() {
  return useAsyncData(() => getRuntime().db.categories.list());
}

/** Updates settings and keeps the store snapshot in sync. */
export function useUpdateSettings(): (patch: DeepPartialSettings<AppSettings>) => Promise<void> {
  const setSettings = useAppStore((s) => s.setSettings);
  return useCallback(
    async (patch) => {
      const next = await getRuntime().settings.update(patch);
      setSettings(next);
    },
    [setSettings],
  );
}

type DeepPartialSettings<T> = { [K in keyof T]?: T[K] extends object ? DeepPartialSettings<T[K]> : T[K] };
