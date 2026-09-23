import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { createDatabase, type DatabaseHandle } from '@superrette/database';
import {
  createNormalizer,
  EquivalenceIndexer,
  evaluatePriceAlerts,
  ExpoPushSender,
  IngestionPipeline,
  LogPushSender,
  QUEUES,
  type PriceAlertsJob,
  type ProviderSyncJob,
  type PushSender,
} from '@superrette/ingestion';
import { createDefaultRegistry } from '@superrette/store-providers';
import type { WorkerConfig } from './config.js';

export interface WorkerLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface RunningWorker {
  close(): Promise<void>;
  queues: { sync: Queue<ProviderSyncJob>; alerts: Queue<PriceAlertsJob> };
}

/** The API bumps this Redis key to invalidate cached catalogue responses. */
const CATALOG_VERSION_KEY = 'superrette:catalog-version';

/**
 * Worker process. Each provider sync runs in its own job, so one failing
 * supermarket provider never blocks the others; failures are recorded in
 * ingest.provider_syncs / provider_errors and retried with backoff.
 */
export async function startWorker(config: WorkerConfig, log: WorkerLogger): Promise<RunningWorker> {
  const handle: DatabaseHandle = createDatabase(config.databaseUrl, { max: config.concurrency + 2, applicationName: 'superrette-worker' });
  const connection = { url: config.redisUrl };
  const registry = createDefaultRegistry({
    environment: config.env,
    openPrices: config.openPricesEnabled ? { enabled: true, userAgent: config.userAgent } : null,
    developmentSeed: config.allowDevelopmentData ? {} : null,
  });
  const push: PushSender = config.pushMode === 'expo' ? new ExpoPushSender({ accessToken: config.expoAccessToken }) : new LogPushSender((m) => log.info(m));
  const syncQueue = new Queue<ProviderSyncJob>(QUEUES.providerSync, { connection });
  const alertsQueue = new Queue<PriceAlertsJob>(QUEUES.priceAlerts, { connection });
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

  const syncWorker = new Worker<ProviderSyncJob>(
    QUEUES.providerSync,
    async (job: Job<ProviderSyncJob>) => {
      const pipeline = new IngestionPipeline({
        db: handle.db,
        registry,
        normalizer: await createNormalizer(handle.db),
        logger: { info: (m) => log.info(m), warn: (m) => log.info(m), error: (m) => log.error(m) },
        hooks: {
          onVariantsChanged: async (variantIds) => {
            await redis.incr(CATALOG_VERSION_KEY);
            await alertsQueue.add('evaluate', { variantIds, reason: `sync:${job.data.providerKey}` }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 });
          },
        },
      });
      // Scheduled jobs have no pre-created sync record; queued API jobs do.
      const syncId = job.data.syncId || undefined;
      const report = await pipeline.runSync(job.data.providerKey, job.data.kind, { triggeredBy: job.data.triggeredBy, ...(syncId ? { syncId } : {}), ...(job.id ? { jobId: job.id } : {}) });
      if (job.data.kind === 'CATALOG' || job.data.kind === 'FULL') {
        await new EquivalenceIndexer(handle.db).refresh();
        await redis.incr(CATALOG_VERSION_KEY);
      }
      log.info(`sync ${report.providerKey}/${report.kind}: ${report.status} (read ${report.read}, failed ${report.failed})`);
      return report;
    },
    { connection, concurrency: config.concurrency },
  );

  const alertsWorker = new Worker<PriceAlertsJob>(
    QUEUES.priceAlerts,
    async (job) => {
      const report = await evaluatePriceAlerts(handle.db, job.data.variantIds, { origins: config.dataOrigins, push });
      log.info(`alerts: evaluated ${report.evaluated}, triggered ${report.triggered}`);
      return report;
    },
    { connection, concurrency: 1 },
  );

  for (const w of [syncWorker, alertsWorker]) {
    w.on('failed', (job, err) => log.error(`job ${job?.name ?? '?'} failed: ${err.message}`));
  }

  // Scheduled provider syncs (idempotent upserts of job schedulers).
  for (const s of config.schedules) {
    const provider = registry.get(s.providerKey);
    if (!provider || provider.info.supportStatus === 'UNSUPPORTED') {
      log.error(`schedule ignored: provider "${s.providerKey}" is unknown or UNSUPPORTED`);
      continue;
    }
    await syncQueue.upsertJobScheduler(`${s.providerKey}:${s.kind}`, { pattern: s.pattern, tz: 'UTC' }, {
      name: `${s.providerKey}:${s.kind}`,
      data: { syncId: '', providerKey: s.providerKey, kind: s.kind, triggeredBy: 'schedule' },
      opts: { attempts: 2, backoff: { type: 'exponential', delay: 60_000 }, removeOnComplete: 200, removeOnFail: 500 },
    });
    log.info(`scheduled ${s.providerKey}:${s.kind} at "${s.pattern}"`);
  }

  return {
    queues: { sync: syncQueue, alerts: alertsQueue },
    async close() {
      await syncWorker.close();
      await alertsWorker.close();
      await syncQueue.close();
      await alertsQueue.close();
      await redis.quit();
      await handle.close();
    },
  };
}
