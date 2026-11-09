import type { Clock } from './Clock';
import type { KeyValueRepository } from '../db/repositories/MetaRepositories';
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from '../intent/config';
import { DEFAULT_OPS_SETTINGS, type OpsSettings } from '../ops/settings';
import type { Language } from '../types/common';

export interface AppSettings {
  userName: string | null;
  language: Language | 'auto';
  autoExecuteSafeCommands: boolean;
  thresholds: { autoConfirm: number; confirm: number };
  defaultEventDurationMinutes: number;
  /** Schedule a notification for tasks that have a due time. */
  notifyTasksWithTime: boolean;
  /** iOS only: 'system' = Apple Reminders via EventKit, 'app' = local notifications. */
  reminderBackend: 'system' | 'app';
  ai: {
    enabled: boolean;
    provider: 'anthropic' | 'none';
    transport: 'proxy' | 'direct';
    model: string;
    effort: 'low' | 'medium' | 'high';
    proxyUrl: string;
  };
  privacy: {
    keepTranscripts: boolean;
    /** Always false in v1: raw audio is never persisted. Kept explicit for the Privacy screen. */
    retainAudio: false;
    cloudAIConsent: boolean;
  };
  voice: {
    locale: string | null;
    onDeviceOnly: boolean;
    interimResults: boolean;
  };
  hapticFeedback: boolean;
  onboardingDone: boolean;
  /** Alfred operations layer (§168). */
  ops: OpsSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  userName: null,
  language: 'auto',
  autoExecuteSafeCommands: false,
  thresholds: { autoConfirm: 0.9, confirm: 0.65 },
  defaultEventDurationMinutes: 60,
  notifyTasksWithTime: true,
  reminderBackend: 'system',
  ai: { enabled: false, provider: 'anthropic', transport: 'proxy', model: 'claude-opus-5', effort: 'low', proxyUrl: '' },
  privacy: { keepTranscripts: true, retainAudio: false, cloudAIConsent: false },
  voice: { locale: null, onDeviceOnly: false, interimResults: true },
  hapticFeedback: true,
  onboardingDone: false,
  ops: { ...DEFAULT_OPS_SETTINGS },
};

const KEY = 'app.settings';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T extends object>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const current = out[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
      out[key] = merge(current as object, value as DeepPartial<object>);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export class SettingsService {
  private cache: AppSettings | null = null;
  private readonly listeners = new Set<(settings: AppSettings) => void>();

  constructor(
    private readonly repo: KeyValueRepository,
    private readonly clock: Clock,
  ) {}

  async load(): Promise<AppSettings> {
    if (this.cache) return this.cache;
    const raw = await this.repo.get(KEY);
    let stored: DeepPartial<AppSettings> | undefined;
    if (raw) {
      try {
        stored = JSON.parse(raw) as DeepPartial<AppSettings>;
      } catch {
        stored = undefined;
      }
    }
    this.cache = merge(DEFAULT_SETTINGS, stored);
    return this.cache;
  }

  get(): AppSettings {
    return this.cache ?? DEFAULT_SETTINGS;
  }

  /** Re-reads the stored settings (other processes – API vs worker – may have changed them). */
  async reload(): Promise<AppSettings> {
    this.cache = null;
    return this.load();
  }

  async update(patch: DeepPartial<AppSettings>): Promise<AppSettings> {
    const current = await this.load();
    const next = merge(current, patch);
    this.cache = next;
    await this.repo.set(KEY, JSON.stringify(next), this.clock.nowISO());
    for (const listener of this.listeners) listener(next);
    return next;
  }

  subscribe(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  engineConfig(): EngineConfig {
    const s = this.get();
    return {
      ...DEFAULT_ENGINE_CONFIG,
      thresholds: { ...s.thresholds },
      autoExecuteSafeCommands: s.autoExecuteSafeCommands,
      llmEnabled: s.ai.enabled && s.ai.provider !== 'none' && s.privacy.cloudAIConsent,
      defaultEventDurationMinutes: s.defaultEventDurationMinutes,
    };
  }

  language(deviceLanguage: Language): Language {
    const s = this.get();
    return s.language === 'auto' ? deviceLanguage : s.language;
  }
}
