import { todayFor } from '@orbit/api-core';
import { createProject, listProjectsWithProgress } from '@orbit/db';
import { createProjectSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const GET = withAuth({ limit: 'read' }, async ({ request, scope }) => ({
  projects: await listProjectsWithProgress(
    scope,
    todayFor(scope),
    request.nextUrl.searchParams.get('includeArchived') === 'true',
  ),
}));

export const POST = withAuth(
  { schema: createProjectSchema, limit: 'write' },
  async ({ scope, body }) => ({ project: await createProject(scope, body) }),
);
