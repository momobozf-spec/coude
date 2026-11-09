import { Platform } from 'react-native';

import { AIGateway } from '@core/ai/AIGateway';
import { AnthropicProvider } from '@core/ai/AnthropicProvider';
import { AdminParser } from '@core/butler/AdminParser';
import type { ButlerAdapters } from '@core/butler/adapters';
import { createToolRegistry } from '@core/butler/tools';
import type { ToolRegistry } from '@core/butler/ToolRegistry';
import { ActionRouter } from '@core/commands/ActionRouter';
import type { PlatformAdapters } from '@core/commands/adapters';
import { openDatabase, type Database } from '@core/db/Database';
import { IntentEngine } from '@core/intent/IntentEngine';
import { LLMParser } from '@core/intent/LLMParser';
import { addLogSink, createLogger, createRingBufferSink, setMinLogLevel, type LogEntry, type Logger } from '@core/logging/logger';
import { createOpsServices, type OpsServices } from '@core/ops';
import { createClock, createCoreServices, type Clock, type CoreServices } from '@core/services';
import type { SettingsService } from '@core/services/SettingsService';
import { DomainError, type Language } from '@core/types/common';
import { createOpsHost, type OpsHost } from './ops';
import { createAlarmAdapters } from '@platform/adapters/AlarmAdapters';
import { createButlerAdapters, createNotificationReminderScheduler } from '@platform/adapters/ButlerAdapters';
import { ExpoCalendarAdapter } from '@platform/adapters/ExpoCalendarAdapter';
import { ExpoNotificationAdapter } from '@platform/adapters/ExpoNotificationAdapter';
import { EventKitReminderAdapter, UnavailableReminderAdapter } from '@platform/adapters/ExpoReminderAdapter';
import { ExpoSqliteDriver } from '@platform/db/ExpoSqliteDriver';
import { getDeviceLanguage, getDeviceTimezone, installIdGenerator } from '@platform/device';
import { secrets } from '@platform/secrets';
import { ExpoSpeechVoiceInput, NullVoiceInput, type VoiceInputService } from '@platform/voice/VoiceInputService';

/**
 * Composition root: wires the platform implementations into the domain layer.
 * Created once at app start (RuntimeProvider) and never imported by src/core.
 */
export interface AppRuntime {
  db: Database;
  services: CoreServices;
  adapters: PlatformAdapters;
  router: ActionRouter;
  engine: IntentEngine;
  /** Butler tool registry and platform capabilities (spec §137–§138). */
  tools: ToolRegistry;
  butlerAdapters: ButlerAdapters;
  /** Alfred operations layer (§141–§181) and its on-device host (in-process workers, server client). */
  ops: OpsServices;
  opsHost: OpsHost;
  ai: AIGateway;
  voice: VoiceInputService;
  clock: Clock;
  settings: SettingsService;
  logger: Logger;
  logs: () => LogEntry[];
  deviceLanguage: Language;
  language: () => Language;
  timezone: () => string;
  /** Rebuilds the LLM parser after settings or secrets changed. */
  refreshAI: () => Promise<{ configured: boolean }>;
  dispose: () => Promise<void>;
}

const ring = createRingBufferSink(400);
addLogSink(ring.sink);
if (__DEV__) {
  setMinLogLevel('debug');
  addLogSink((entry) => {
    const line = `[${entry.scope}] ${entry.message}`;
    if (entry.level === 'error') console.error(line, entry.meta ?? '');
    else if (entry.level === 'warn') console.warn(line, entry.meta ?? '');
  });
} else {
  setMinLogLevel('info');
}

export async function createAppRuntime(): Promise<AppRuntime> {
  const logger = createLogger('runtime');
  installIdGenerator();

  const deviceLanguage = getDeviceLanguage();
  const timezone = () => getDeviceTimezone();
  const clock = createClock(timezone);

  let db: Database;
  try {
    const driver = await ExpoSqliteDriver.open('brainvoice.db');
    db = await openDatabase(driver);
    logger.info('database ready', { version: db.migration.currentVersion, fts5: db.migration.fts5, applied: db.migration.appliedVersions });
  } catch (e) {
    const error = DomainError.from(e, 'DB_MIGRATION_FAILED');
    logger.error('database failed to open', { code: error.code, message: error.message });
    throw error;
  }

  const calendar = new ExpoCalendarAdapter();
  const ai = new AIGateway();
  let services: CoreServices;
  const language = () => services.settings.language(deviceLanguage);
  services = createCoreServices(db, clock, calendar, { ai, language, signature: () => services.settings.get().userName });
  const settings = services.settings;
  await settings.load();

  const { alarms, timers } = createAlarmAdapters(language);
  const adapters: PlatformAdapters = {
    calendar,
    reminders: Platform.OS === 'ios' ? new EventKitReminderAdapter() : new UnavailableReminderAdapter(),
    alarms,
    timers,
    notifications: new ExpoNotificationAdapter(),
  };
  try {
    await ExpoNotificationAdapter.configure(language());
  } catch (e) {
    logger.warn('notification setup failed', { message: e instanceof Error ? e.message : String(e) });
  }

  const tools = createToolRegistry();
  const butlerAdapters = createButlerAdapters(adapters.notifications);
  services.setReminderScheduler(createNotificationReminderScheduler(services.reminders, adapters.notifications, language));
  const router = new ActionRouter({ services, adapters, clock, language, logger: logger.child('router'), tools, butlerAdapters });
  const engine = new IntentEngine({ config: settings.engineConfig(), logger: logger.child('engine'), adminParser: new AdminParser() });
  const ops = createOpsServices({ db, clock, services, tools, butlerAdapters, engine, router, language, logger: logger.child('ops') });
  router.setOps(ops);
  const opsHost = createOpsHost({ ops, services, adapters, engine, router, clock, deviceLanguage, language, logger: logger.child('ops-host'), version: '1.0.0' });

  const refreshAI = async (): Promise<{ configured: boolean }> => {
    const s = settings.get();
    engine.setConfig(settings.engineConfig());
    if (!s.ai.enabled || s.ai.provider !== 'anthropic' || !s.privacy.cloudAIConsent) {
      engine.setLLMParser(null);
      ai.setProvider(null);
      return { configured: false };
    }
    const provider = new AnthropicProvider({
      transport: s.ai.transport,
      baseUrl: s.ai.transport === 'proxy' ? s.ai.proxyUrl : 'https://api.anthropic.com',
      getCredential: () => (s.ai.transport === 'proxy' ? secrets.getProxyToken() : secrets.getAnthropicApiKey()),
      model: s.ai.model,
      effort: s.ai.effort,
      timeoutMs: 20_000,
      onUsage: (usage) => void ops.costs.record(usage),
    });
    const configured = await provider.isConfigured();
    engine.setLLMParser(configured ? new LLMParser(provider) : null);
    ai.setProvider(configured ? provider : null);
    return { configured };
  };
  await refreshAI();
  settings.subscribe(() => {
    void refreshAI();
  });

  let voice: VoiceInputService;
  try {
    const speech = new ExpoSpeechVoiceInput();
    voice = speech.isAvailable() ? speech : new NullVoiceInput();
  } catch (e) {
    logger.warn('speech recognition unavailable', { message: e instanceof Error ? e.message : String(e) });
    voice = new NullVoiceInput();
  }

  return {
    db,
    services,
    adapters,
    router,
    engine,
    tools,
    butlerAdapters,
    ops,
    opsHost,
    ai,
    voice,
    clock,
    settings,
    logger,
    logs: ring.entries,
    deviceLanguage,
    language,
    timezone,
    refreshAI,
    dispose: async () => {
      await opsHost.stop();
      await db.driver.close();
    },
  };
}
