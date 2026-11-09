import type { PullRequest, PushRequest, SyncOperation } from '@orbit/types';
import { z } from 'zod';
import { operationKindSchema, syncEntitySchema } from './enums';
import { LIMITS, serverSeqSchema, ulidSchema } from './primitives';

/**
 * De payload van een operatie wordt hier bewust *niet* per entiteit gevalideerd:
 * dat gebeurt in api-core, waar per tabel bekend is welke velden bestaan. Hier
 * bewaken we alleen de vorm en de grootte, zodat een kapotte client de server
 * niet kan laten omvallen.
 */
const operationPayloadSchema = z.record(z.string().max(64), z.unknown()).refine(
  (payload) => Object.keys(payload).length <= 80,
  'Een operatie mag maximaal 80 velden bevatten',
);

export const syncOperationSchema: z.ZodType<SyncOperation> = z.object({
  operationId: ulidSchema,
  entity: syncEntitySchema,
  entityId: ulidSchema,
  kind: operationKindSchema,
  payload: operationPayloadSchema,
  clientTs: z.string().datetime({ offset: true }),
  clientSeq: z.number().int().nonnegative(),
});

export const pushRequestSchema: z.ZodType<PushRequest> = z.object({
  deviceId: ulidSchema,
  workspaceId: ulidSchema,
  operations: z
    .array(syncOperationSchema)
    .max(LIMITS.syncBatchMax, `Maximaal ${LIMITS.syncBatchMax} operaties per push`),
  lastKnownSeq: serverSeqSchema,
});

export const pullRequestSchema: z.ZodType<PullRequest> = z.object({
  workspaceId: ulidSchema,
  since: serverSeqSchema,
  limit: z.number().int().min(1).max(1000).optional(),
  entities: z.array(syncEntitySchema).max(20).optional(),
});

export const pullQuerySchema = z.object({
  workspaceId: ulidSchema,
  since: serverSeqSchema.default('0'),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
