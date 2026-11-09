import { listWorkspacesForUser, requireUser, updateUser } from '@orbit/db';
import { updateProfileSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const GET = withAuth({ limit: 'read' }, async ({ scope }) => ({
  user: await requireUser(scope.db, scope.userId),
  workspaces: await listWorkspacesForUser(scope.db, scope.userId),
  currentWorkspaceId: scope.workspaceId,
}));

export const PATCH = withAuth(
  { schema: updateProfileSchema, limit: 'write' },
  async ({ scope, body }) => ({ user: await updateUser(scope.db, scope.userId, body) }),
);
