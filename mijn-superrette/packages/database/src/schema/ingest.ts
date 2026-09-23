import { index, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ingest, ingestStage, syncKind, syncStatus } from './enums.js';

/** ProviderSync: one run of a provider import. */
export const providerSyncs = ingest.table(
  'provider_syncs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerKey: text('provider_key').notNull(),
    kind: syncKind('kind').notNull(),
    status: syncStatus('status').notNull().default('QUEUED'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    readCount: integer('read_count').notNull().default(0),
    createdCount: integer('created_count').notNull().default(0),
    updatedCount: integer('updated_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    errorSummary: text('error_summary'),
    triggeredBy: text('triggered_by').notNull().default('schedule'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('provider_syncs_provider_idx').on(t.providerKey, t.createdAt.desc())],
);

/** ImportJob: a queued unit of work (mirrors a BullMQ job for auditability). */
export const importJobs = ingest.table(
  'import_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syncId: uuid('sync_id').references(() => providerSyncs.id, { onDelete: 'cascade' }),
    queue: text('queue').notNull(),
    jobName: text('job_name').notNull(),
    externalJobId: text('external_job_id'),
    status: syncStatus('status').notNull().default('QUEUED'),
    attempts: integer('attempts').notNull().default(0),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('import_jobs_sync_idx').on(t.syncId)],
);

/** ProviderError: a record that failed a pipeline stage. One bad record never fails the sync. */
export const providerErrors = ingest.table(
  'provider_errors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syncId: uuid('sync_id').references(() => providerSyncs.id, { onDelete: 'cascade' }),
    providerKey: text('provider_key').notNull(),
    stage: ingestStage('stage').notNull(),
    externalId: text('external_id'),
    message: text('message').notNull(),
    raw: jsonb('raw').$type<unknown>(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('provider_errors_sync_idx').on(t.syncId), index('provider_errors_open_idx').on(t.providerKey, t.resolvedAt)],
);
