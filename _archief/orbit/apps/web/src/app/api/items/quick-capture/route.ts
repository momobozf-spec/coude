import { quickCapture } from '@orbit/api-core';
import { itemTypeSchema, ulidSchema } from '@orbit/validation';
import { z } from 'zod';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

const quickCaptureSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  type: itemTypeSchema.optional(),
  body: z.string().max(20_000).optional(),
  projectId: ulidSchema.nullish(),
});

/**
 * Universal quick capture. Ook de share-extensie op mobiel en straks een
 * e-mail-naar-inbox gebruiken dit endpoint; daarom parseert de server zelf en
 * vertrouwt hij niet op wat de webapp al herkend had.
 */
export const POST = withAuth(
  { schema: quickCaptureSchema, limit: 'write' },
  async ({ scope, body }) => quickCapture(scope, body),
);
