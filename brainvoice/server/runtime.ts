import { promises as fs } from 'node:fs';
import path from 'node:path';

import { GmailAccountManager } from './accounts';
import { createServerAdapters } from './adapters';
import { EncryptedCredentialStore } from './db/EncryptedCredentialStore';
import { PostgresDriver } from './db/PostgresDriver';
import type { ServerEnv } from './env';
import { ExpoPushSink } from './push/ExpoPushSink';
import { LocalRepoTools } from './repo/LocalRepoTools';
import { AIGateway } from '../src/core/ai/AIGateway';
import { AnthropicProvider } from '../src/core/ai/AnthropicProvider';
import { AdminParser } from '../src/core/butler/AdminParser';
import { createDefaultButlerAdapters } from '../src/core/butler/adapters';
import { createToolRegistry } from '../src/core/butler/tools';
import { ActionRouter } from '../src/core/commands/ActionRouter';
import { openDatabase, type Database } from '../src/core/db/Database';
import type { SqlDriver } from '../src/core/db/SqlDriver';
import { NodeSqliteDriver } from '../src/core/db/testing/NodeSqliteDriver';
import type { WorkerKind } from '../src/core/domain/ops';
import { GmailAuth } from '../src/core/email/gmail/GmailAuth';
import { GmailProvider } from '../src/core/email/gmail/GmailProvider';
import { LocalEmailProvider, MicrosoftGraphEmailProvider, type EmailProvider } from '../src/core/email/EmailProvider';
import { DEFAULT_ENGINE_CONFIG } from '../src/core/intent/config';
import { IntentEngine } from '../src/core/intent/IntentEngine';
import { LLMParser } from '../src/core/intent/LLMParser';
import { addLogSink, createLogger, setMinLogLevel, type Logger } from '../src/core/logging/logger';
import { createOpsServices, EmailBriefingDelivery, HomeAssistantProvider, InMemoryCredentialStore, JOB_TYPES_BY_WORKER, NullHomeAutomationProvider, UnavailableRepoTools, WorkerSupervisor, type OpsServices } from '../src/core/ops';
import { LocalOpsClient } from '../src/core/ops/client';
import type { CredentialStore } from '../src/core/ops/providers/CredentialStore';
import { createClock, createCoreServices, type Clock, type CoreServices } from '../src/core/services';
import type { Language } from '../src/core/types/common';

export const SERVER_VERSION = '0.2.0';

export interface ReadyReport {
  ok: boolean;
  database: 'ok' | 'error';
  dialect: 'sqlite' | 'postgres';
  workersAlive: number;
  schedulerAlive: boolean;
  continuous: boolean;
  version: string;
  detail: string | null;
}

export interface ServerRuntime {
  env: ServerEnv;
  db: Database;
  clock: Clock;
  services: CoreServices;
  ops: OpsServices;
  client: LocalOpsClient;
  accounts: GmailAccountManager | null;
  logger: Logger;
  aiConfigured: boolean;
  credentialsPersistent: boolean;
  createSupervisor(options: { scheduler: boolean; workers: boolean }): WorkerSupervisor;
  ready(): Promise<ReadyReport>;
  dispose(): Promise<void>;
}

let logSinkInstalled = false;

const SECRET_KEY = /token|secret|password|authorization|credential|cookie|api[-_]?key/i;
const SECRET_VALUE = /^(?:Bearer\s+\S+|ya29\.\S+|1\/\/\S{20,}|sk-\S{10,}|[A-Fa-f0-9]{64})$/;

/** Structured logs never carry secrets: string values under suspicious keys and token-shaped values are masked (Phase 12). */
export function redactMeta(meta: Record<string, unknown>, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'string' && SECRET_KEY.test(key) && !/^https?:\/\//.test(value)) out[key] = '[redacted]';
    else if (typeof value === 'string' && SECRET_VALUE.test(value)) out[key] = '[redacted]';
    else if (value && typeof value === 'object' && !Array.isArray(value) && depth < 3) out[key] = redactMeta(value as Record<string, unknown>, depth + 1);
    else out[key] = value;
  }
  return out;
}

export async function createServerRuntime(env: ServerEnv, options: { dbPath?: string; quiet?: boolean; fetchImpl?: typeof fetch } = {}): Promise<ServerRuntime> {
  if (!logSinkInstalled && !options.quiet) {
    setMinLogLevel(process.env.ALFRED_LOG_LEVEL === 'debug' ? 'debug' : 'info');
    addLogSink((entry) => {
      const meta = entry.meta ? redactMeta(entry.meta) : undefined;
      const line = env.logFormat === 'json' ? JSON.stringify({ time: entry.at, level: entry.level, scope: entry.scope, msg: entry.message, ...(meta ?? {}) }) : `${entry.at} [${entry.level}] [${entry.scope}] ${entry.message}${meta ? ` ${JSON.stringify(meta)}` : ''}`;
      if (entry.level === 'error') console.error(line);
      else if (entry.level === 'warn') console.warn(line);
      else process.stdout.write(`${line}\n`);
    });
    logSinkInstalled = true;
  }
  const logger = createLogger('server');

  // Persistence: PostgreSQL in production (DATABASE_URL), SQLite for local development and tests.
  let driver: SqlDriver;
  if (env.databaseUrl && !options.dbPath) {
    const pgDriver = new PostgresDriver({ connectionString: env.databaseUrl, ssl: env.databaseSsl, schema: env.databaseSchema });
    await pgDriver.prepare();
    driver = pgDriver;
  } else {
    const dbPath = options.dbPath ?? env.dbPath;
    if (dbPath !== ':memory:') await fs.mkdir(path.dirname(dbPath), { recursive: true });
    driver = new NodeSqliteDriver(dbPath);
  }
  const db = await openDatabase(driver);
  logger.info('database ready', { dialect: driver.dialect, version: db.migration.currentVersion, applied: db.migration.appliedVersions });

  const clock = createClock(() => env.timezone);
  const adapters = createServerAdapters();
  const ai = new AIGateway();
  const language = (): Language => env.language;
  let services: CoreServices;
  services = createCoreServices(db, clock, adapters.calendar, { ai, language, signature: () => env.userName ?? services.settings.get().userName });
  await services.settings.load();

  const tools = createToolRegistry();
  const butlerAdapters = createDefaultButlerAdapters();
  const router = new ActionRouter({ services, adapters, clock, language, logger: logger.child('router'), tools, butlerAdapters });

  // Cloud AI (optional): direct key or the BrainVoice proxy. Usage feeds cost tracking.
  let aiConfigured = false;
  let onUsage: ((usage: { provider: string; model: string; inputTokens: number; outputTokens: number }) => void) | undefined;
  const provider = env.anthropicApiKey || (env.proxyUrl && env.proxyToken)
    ? new AnthropicProvider({ transport: env.anthropicApiKey ? 'direct' : 'proxy', baseUrl: env.anthropicApiKey ? 'https://api.anthropic.com' : (env.proxyUrl ?? ''), getCredential: async () => env.anthropicApiKey ?? env.proxyToken, model: env.anthropicModel, effort: env.anthropicEffort, timeoutMs: 60_000, onUsage: (usage) => onUsage?.(usage), fetchImpl: options.fetchImpl })
    : null;
  if (provider && (await provider.isConfigured())) {
    ai.setProvider(provider);
    aiConfigured = true;
  }
  const engine = new IntentEngine({ config: { ...DEFAULT_ENGINE_CONFIG, llmEnabled: aiConfigured }, logger: logger.child('engine'), adminParser: new AdminParser(), llmParser: provider && aiConfigured ? new LLMParser(provider) : null });

  // Provider credentials stay server-side, encrypted at rest when ALFRED_SECRET_KEY is set.
  const credentialsPersistent = Boolean(env.secretKey);
  const credentials: CredentialStore = env.secretKey ? new EncryptedCredentialStore(db.driver, env.secretKey, clock) : new InMemoryCredentialStore();
  if (!credentialsPersistent) logger.warn('ALFRED_SECRET_KEY is not set: provider credentials are kept in memory and lost on restart');
  const gmailAuth = new GmailAuth(env.gmail, credentials, { fetchImpl: options.fetchImpl, now: () => clock.now().toJSDate() });
  const emailProvider: EmailProvider = env.emailProvider === 'gmail' ? new GmailProvider(gmailAuth, { fetchImpl: options.fetchImpl, baseUrl: env.gmail?.apiBaseUrl }) : env.emailProvider === 'microsoft-graph' ? new MicrosoftGraphEmailProvider(null) : new LocalEmailProvider();
  if (env.gmail?.apiBaseUrl || env.gmail?.tokenUrl) logger.warn('Gmail endpoints are overridden (staging mock) – this is NOT a real Gmail connection', { apiBaseUrl: env.gmail.apiBaseUrl ?? null, tokenUrl: env.gmail.tokenUrl ?? null });
  const accounts = env.emailProvider === 'gmail' ? new GmailAccountManager(db, clock, gmailAuth, () => emailProvider) : null;
  const homeProvider = env.hassUrl && env.hassToken ? new HomeAssistantProvider({ baseUrl: env.hassUrl, token: async () => env.hassToken, fetchImpl: options.fetchImpl }) : new NullHomeAutomationProvider();
  const repoTools = env.repoPath ? new LocalRepoTools(env.repoPath) : new UnavailableRepoTools();

  const ops = createOpsServices({ db, clock, services, tools, butlerAdapters, engine, router, language, logger: logger.child('ops'), providers: { email: () => emailProvider, home: () => homeProvider, repo: () => repoTools }, accounts: accounts ?? undefined });
  router.setOps(ops);
  onUsage = (usage) => void ops.costs.record(usage);
  if (env.expoPushEnabled) ops.notifications.addSink(new ExpoPushSink(db, options.fetchImpl));
  ops.briefings.addDeliveryProvider(new EmailBriefingDelivery(() => emailProvider, async () => (await services.companies.profile()).email ?? null, () => clock.nowISO()));

  const supervisors: WorkerSupervisor[] = [];
  const createSupervisor: ServerRuntime['createSupervisor'] = (opts) => {
    const workers = opts.workers ? (Object.keys(JOB_TYPES_BY_WORKER) as WorkerKind[]).filter((kind) => JOB_TYPES_BY_WORKER[kind].length > 0).map((kind) => ops.createWorker({ id: `${env.hostName}-${kind}`, kind, mode: 'server', host: env.hostName, version: SERVER_VERSION })) : [];
    const supervisor = new WorkerSupervisor({
      workers,
      scheduler: opts.scheduler ? ops.schedules : null,
      pollMs: env.pollMs,
      logger: logger.child(opts.workers && opts.scheduler ? 'supervisor' : opts.workers ? 'workers' : 'scheduler'),
      onSchedulerTick: opts.scheduler ? ops.schedulerHeartbeat({ host: env.hostName, mode: 'server', version: SERVER_VERSION }) : undefined,
      // Settings (autonomy, SLA, briefing times) are written by the API process; workers re-read them every tick.
      beforeTick: async () => void (await services.settings.reload().catch(() => undefined)),
    });
    supervisors.push(supervisor);
    return supervisor;
  };

  const client = new LocalOpsClient(ops, services, {
    tick: async () => {
      const supervisor = supervisors[0];
      return supervisor ? supervisor.tick() : { scheduled: (await ops.schedules.tick()).enqueued.length, processed: 0 };
    },
    engine,
    router,
    clock,
    deviceLanguage: env.language,
    language,
  });

  const ready = async (): Promise<ReadyReport> => {
    let database: 'ok' | 'error' = 'ok';
    let detail: string | null = null;
    try {
      await db.driver.get('SELECT 1 AS ok');
    } catch (e) {
      database = 'error';
      detail = e instanceof Error ? e.message : String(e);
    }
    const health = database === 'ok' ? await ops.health.check().catch(() => null) : null;
    return { ok: database === 'ok', database, dialect: db.driver.dialect, workersAlive: health?.activeWorkers ?? 0, schedulerAlive: health?.schedulerAlive ?? false, continuous: health?.continuous ?? false, version: SERVER_VERSION, detail };
  };

  return {
    env,
    db,
    clock,
    services,
    ops,
    client,
    accounts,
    logger,
    aiConfigured,
    credentialsPersistent,
    createSupervisor,
    ready,
    dispose: async () => {
      for (const supervisor of supervisors) await supervisor.stop();
      await db.driver.close();
    },
  };
}
