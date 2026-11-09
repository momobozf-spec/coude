import { setTaskCompleted } from '@orbit/api-core';
import { completeTaskSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

/**
 * De client stuurt `completedAt` mee. Offline afvinken gebeurt op het moment
 * dat de gebruiker het vinkje zet, niet op het moment dat de sync doorkomt —
 * anders schuift een herhalende taak naar de verkeerde volgende datum.
 */
export const POST = withAuth(
  { schema: completeTaskSchema, limit: 'write' },
  async ({ scope, params, body }) =>
    setTaskCompleted(scope, params.id as string, body.completed, body.completedAt),
);
