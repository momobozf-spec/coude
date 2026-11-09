import { createTag, listTags } from '@orbit/db';
import { createTagSchema } from '@orbit/validation';
import { withAuth } from '@/lib/api/handler';

export const runtime = 'nodejs';

export const GET = withAuth({ limit: 'read' }, async ({ scope }) => ({
  tags: await listTags(scope),
}));

export const POST = withAuth({ schema: createTagSchema, limit: 'write' }, async ({ scope, body }) => ({
  tag: await createTag(scope, body),
}));
