import { listByView } from '@orbit/api-core';
import { sortSpecSchema, taskViewSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

/** `/api/views/TODAY`, `/api/views/UPCOMING`, ... */
export const GET = withAuth({ limit: 'read' }, async ({ request, scope, params }) => {
  const view = taskViewSchema.parse(String(params.view).toUpperCase());
  const search = request.nextUrl.searchParams;

  return listByView(scope, view, {
    sort: search.get('sort') ? sortSpecSchema.parse(JSON.parse(search.get('sort') as string)) : undefined,
    cursor: search.get('cursor'),
    limit: search.get('limit') ? Number(search.get('limit')) : undefined,
  });
});
