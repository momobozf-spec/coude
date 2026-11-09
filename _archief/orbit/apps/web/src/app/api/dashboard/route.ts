import { getDashboard } from '@orbit/api-core';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const GET = withAuth({ limit: 'read' }, async ({ scope }) => getDashboard(scope));
