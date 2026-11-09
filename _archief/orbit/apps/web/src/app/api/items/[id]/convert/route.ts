import { convertItem } from '@orbit/api-core';
import { convertItemSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const POST = withAuth(
  { schema: convertItemSchema, limit: 'write' },
  async ({ scope, params, body }) => ({
    item: await convertItem(scope, params.id as string, body),
  }),
);
