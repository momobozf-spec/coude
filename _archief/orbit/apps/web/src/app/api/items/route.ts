import { createItem, listItems } from '@orbit/api-core';
import { createItemSchema, itemFilterSchema, sortSpecSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * Het filter reist als JSON in de queryparameter `filter`. Dat houdt precies
 * hetzelfde `ItemFilter`-object bruikbaar op de server, in de client-cache en
 * in de sync-laag, zonder een tweede querytaal met losse parameters.
 */
export const GET = withAuth({ limit: 'read' }, async ({ request, scope }) => {
  const params = request.nextUrl.searchParams;

  const filter = params.get('filter')
    ? itemFilterSchema.parse(JSON.parse(params.get('filter') as string))
    : {};
  const sort = params.get('sort')
    ? sortSpecSchema.parse(JSON.parse(params.get('sort') as string))
    : undefined;

  return listItems(scope, {
    filter,
    sort,
    cursor: params.get('cursor'),
    limit: params.get('limit') ? Number(params.get('limit')) : undefined,
    withTotal: params.get('withTotal') === 'true',
  });
});

export const POST = withAuth(
  { schema: createItemSchema, limit: 'write' },
  async ({ scope, body }) => ({ item: await createItem(scope, body) }),
);
