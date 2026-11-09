import { toggleChecklistItem } from '@orbit/api-core';
import { z } from 'zod';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const PATCH = withAuth(
  { schema: z.object({ done: z.boolean() }), limit: 'write' },
  async ({ scope, params, body }) => ({
    checklistItem: await toggleChecklistItem(scope, params.id as string, body.done),
  }),
);
