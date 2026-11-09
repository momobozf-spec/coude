import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import type { ActionRouter } from '@core/commands/ActionRouter';
import type { PlatformAdapters } from '@core/commands/adapters';
import type { IntentEngine } from '@core/intent/IntentEngine';
import type { Logger } from '@core/logging/logger';
import type { OpsServices } from '@core/ops';
import { HttpOpsClient, LocalOpsClient, type OpsClient } from '@core/ops/client';
import type { WorkerSupervisor } from '@core/ops/workers/Supervisor';
import type { Clock, CoreServices } from '@core/services';
import type { Language } from '@core/types/common';
import { secrets } from '@platform/secrets';

/**
 * On-device host for the operations layer. Two explicit modes (Phase 1):
 *  - **local** (no server URL): everything runs in-process on this phone; workers and the
 *    scheduler tick while the app is in the foreground – never 24/7.
 *  - **connected** (server URL set): the Alfred server is the source of truth. Mission
 *    Control, administrative data and Butler commands go through the API; in-process workers
 *    are off so the phone never competes with the server.
 */
export type OpsMode = 'local' | 'connected';

export interface OpsHost {
  start(): void;
  stop(): Promise<void>;
  running(): boolean;
  mode(): OpsMode;
  /** Local client, or the HTTP client in connected mode. */
  client(): OpsClient;
  usingServer(): boolean;
  tick(): Promise<{ scheduled: number; processed: number }>;
  /** Registers this device's Expo push token with the server (REQUIRES DEVICE TEST). */
  registerPushToken(): Promise<{ registered: boolean; reason: string | null }>;
}

export interface OpsHostDeps {
  ops: OpsServices;
  services: CoreServices;
  adapters: PlatformAdapters;
  engine: IntentEngine;
  router: ActionRouter;
  clock: Clock;
  deviceLanguage: Language;
  language: () => Language;
  logger: Logger;
  version: string;
}

export function createOpsHost(deps: OpsHostDeps): OpsHost {
  const { ops, services, adapters, clock, logger } = deps;
  const supervisor: WorkerSupervisor = ops.createSupervisor({ mode: 'in_process', host: `app-${Platform.OS}`, pollMs: 15_000, singleWorker: true, version: deps.version });

  // Alerts for approvals/questions while the app is open or backgrounded: a local device notification (not remote push).
  ops.notifications.addSink({
    channel: 'push',
    isAvailable: async () => (await adapters.notifications.getPermission().catch(() => 'denied')) === 'granted',
    deliver: async (n) => {
      await adapters.notifications.schedule({ title: n.title, body: n.body, fireISO: clock.now().plus({ seconds: 1 }).toISO({ suppressMilliseconds: true }) ?? clock.nowISO(), categoryId: 'reminder', data: { ...n.data, opsNotificationId: n.id } });
      return { status: 'delivered', detail: 'local device notification' };
    },
  });

  const local = new LocalOpsClient(ops, services, { tick: () => supervisor.tick(), engine: deps.engine, router: deps.router, clock, deviceLanguage: deps.deviceLanguage, language: deps.language });
  let http: HttpOpsClient | null = null;
  let httpUrl = '';
  const serverUrl = () => services.settings.get().ops.serverUrl.trim();
  const mode = (): OpsMode => (serverUrl() ? 'connected' : 'local');
  const client = (): OpsClient => {
    const url = serverUrl();
    if (!url) return local;
    if (!http || httpUrl !== url) {
      http = new HttpOpsClient({ baseUrl: url, token: () => secrets.getAlfredServerToken() });
      httpUrl = url;
    }
    return http;
  };

  let appStateSubscription: { remove(): void } | null = null;
  let settingsUnsubscribe: (() => void) | null = null;
  // In connected mode the server owns the queue; local workers must never run.
  const wanted = () => mode() === 'local' && services.settings.get().ops.inProcessWorkers;

  const apply = (state: AppStateStatus) => {
    if (state === 'active' && wanted()) {
      if (!supervisor.running) {
        supervisor.start();
        logger.info('in-process workers started');
      }
    } else if (supervisor.running) {
      void supervisor.stop().then(() => logger.info('in-process workers paused', { state, mode: mode() }));
    }
  };

  return {
    start() {
      appStateSubscription?.remove();
      appStateSubscription = AppState.addEventListener('change', apply);
      settingsUnsubscribe?.();
      settingsUnsubscribe = services.settings.subscribe(() => apply(AppState.currentState));
      apply(AppState.currentState);
    },
    async stop() {
      appStateSubscription?.remove();
      appStateSubscription = null;
      settingsUnsubscribe?.();
      settingsUnsubscribe = null;
      await supervisor.stop();
    },
    running: () => supervisor.running,
    mode,
    client,
    usingServer: () => mode() === 'connected',
    tick: () => (mode() === 'connected' ? client().runTick() : supervisor.tick()),
    async registerPushToken() {
      if (!serverUrl()) return { registered: false, reason: 'no server configured' };
      try {
        const permission = await adapters.notifications.getPermission();
        if (permission !== 'granted') return { registered: false, reason: 'notification permission not granted' };
        const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
        const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        await client().registerPushToken(token.data, Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown', Constants.deviceName ?? null);
        return { registered: true, reason: null };
      } catch (e) {
        return { registered: false, reason: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
