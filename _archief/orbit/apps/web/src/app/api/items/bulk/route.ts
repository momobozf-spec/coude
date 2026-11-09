import { bulkItemAction } from '@orbit/api-core';
import { bulkItemActionSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const POST = withAuth(
  // Een bulkactie kost meer dan een losse mutatie; anders kan één sleepbeweging
  // over honderd taken het quotum van een normale werkdag opeten.
  { schema: bulkItemActionSchema, limit: 'write', cost: 5 },
  async ({ scope, body }) => bulkItemAction(scope, body),
);
