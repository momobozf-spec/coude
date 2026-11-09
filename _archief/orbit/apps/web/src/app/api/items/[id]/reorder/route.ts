import { reorderItem } from '@orbit/api-core';
import { reorderItemSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const POST = withAuth(
  { schema: reorderItemSchema, limit: 'write' },
  async ({ scope, params, body }) => ({
    item: await reorderItem(scope, params.id as string, body.beforeId ?? null, body.afterId ?? null),
  }),
);
