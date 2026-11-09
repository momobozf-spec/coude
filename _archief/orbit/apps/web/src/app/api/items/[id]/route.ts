import { deleteItem, getItem, updateItem } from '@orbit/api-core';
import { updateItemSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const GET = withAuth({ limit: 'read' }, async ({ scope, params }) =>
  getItem(scope, params.id as string),
);

export const PATCH = withAuth(
  { schema: updateItemSchema, limit: 'write' },
  async ({ scope, params, body }) => ({
    item: await updateItem(scope, params.id as string, body),
  }),
);

export const DELETE = withAuth({ limit: 'write' }, async ({ scope, params }) => {
  await deleteItem(scope, params.id as string);
  return { ok: true };
});
