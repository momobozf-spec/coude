import { replaceChecklist } from '@orbit/api-core';
import { replaceChecklistSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const PUT = withAuth(
  { schema: replaceChecklistSchema, limit: 'write' },
  async ({ scope, params, body }) => ({
    checklist: await replaceChecklist(scope, params.id as string, body.items),
  }),
);
