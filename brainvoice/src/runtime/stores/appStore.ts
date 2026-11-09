import { create } from 'zustand';

import type { AppRuntime } from '../AppRuntime';
import type { AppSettings } from '@core/services/SettingsService';
import { DEFAULT_SETTINGS } from '@core/services/SettingsService';
import type { DomainError } from '@core/types/common';

/** Global app state: runtime lifecycle, settings snapshot, connectivity, data version. */
export interface AppStore {
  status: 'booting' | 'ready' | 'error';
  error: DomainError | null;
  settings: AppSettings;
  online: boolean;
  /** Incremented after every executed/undone command so screens refetch. */
  dataVersion: number;
  aiConfigured: boolean;
  setReady: (runtime: AppRuntime) => void;
  setError: (error: DomainError) => void;
  setSettings: (settings: AppSettings) => void;
  setOnline: (online: boolean) => void;
  setAiConfigured: (configured: boolean) => void;
  bumpData: () => void;
}

let runtimeRef: AppRuntime | null = null;

export function setRuntime(runtime: AppRuntime | null): void {
  runtimeRef = runtime;
}

export function getRuntime(): AppRuntime {
  if (!runtimeRef) throw new Error('Runtime not ready');
  return runtimeRef;
}

export function tryGetRuntime(): AppRuntime | null {
  return runtimeRef;
}

export const useAppStore = create<AppStore>((set) => ({
  status: 'booting',
  error: null,
  settings: DEFAULT_SETTINGS,
  online: true,
  dataVersion: 0,
  aiConfigured: false,
  setReady: (runtime) => {
    setRuntime(runtime);
    set({ status: 'ready', error: null, settings: runtime.settings.get() });
  },
  setError: (error) => set({ status: 'error', error }),
  setSettings: (settings) => set({ settings }),
  setOnline: (online) => set({ online }),
  setAiConfigured: (aiConfigured) => set({ aiConfigured }),
  bumpData: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
