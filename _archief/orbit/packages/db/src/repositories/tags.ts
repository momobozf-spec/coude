import type { Tag, TagId, TagWithUsage } from '@orbit/types';
import { colorFromString, slugify, ulid } from '@orbit/utils';
import type { Transactional } from '../client';
import { notFound } from '../errors';
import { assertCanWrite, scoped, type Scope } from '../scope';

/** Het centrale tagsysteem: dezelfde tags op taken, notities, ideeën en projecten. */

const TAG_PALETTE = [
  '#4f46e5', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b',
] as const;

function toTag(row: {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  serverSeq: bigint;
  revision: number;
}): Tag {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    serverSeq: row.serverSeq.toString(),
    revision: row.revision,
  };
}

export async function listTags(scope: Scope): Promise<TagWithUsage[]> {
  const rows = await scope.db.tag.findMany({
    where: scoped(scope),
    orderBy: { name: 'asc' },
    include: { _count: { select: { items: { where: { deletedAt: null } } } } },
  });
  return rows.map((row) => ({ ...toTag(row), usageCount: row._count.items }));
}

export async function getTag(scope: Scope, tagId: TagId): Promise<Tag> {
  const row = await scope.db.tag.findFirst({ where: { id: tagId, ...scoped(scope) } });
  if (!row) throw notFound('Tag');
  return toTag(row);
}

/**
 * Zoekt een tag op naam of maakt hem aan. Quick capture leunt hierop: `@finance`
 * mag werken zonder dat de gebruiker die tag eerst ergens heeft aangemaakt.
 */
export async function findOrCreateTag(scope: Scope, name: string): Promise<Tag> {
  assertCanWrite(scope);
  const slug = slugify(name);
  if (!slug) throw notFound('Tag');

  const existing = await scope.db.tag.findFirst({
    where: { workspaceId: scope.workspaceId, slug },
  });
  if (existing) {
    // Een eerder verwijderde tag met dezelfde naam wordt hergebruikt in plaats
    // van te botsen op de unieke index (workspaceId, slug).
    if (existing.deletedAt) {
      const restored = await scope.db.tag.update({
        where: { id: existing.id },
        data: { deletedAt: null, name, revision: { increment: 1 } },
      });
      return toTag(restored);
    }
    return toTag(existing);
  }

  const row = await scope.db.tag.create({
    data: {
      id: ulid(),
      workspaceId: scope.workspaceId,
      name: name.trim().slice(0, 50),
      slug,
      color: colorFromString(slug, TAG_PALETTE),
    },
  });
  return toTag(row);
}

export async function findOrCreateTags(scope: Scope, names: readonly string[]): Promise<Tag[]> {
  const tags: Tag[] = [];
  for (const name of names) {
    tags.push(await findOrCreateTag(scope, name));
  }
  return tags;
}

export async function createTag(
  scope: Scope,
  input: { id?: string; name: string; color?: string },
): Promise<Tag> {
  assertCanWrite(scope);
  const slug = slugify(input.name);
  const row = await scope.db.tag.create({
    data: {
      id: input.id ?? ulid(),
      workspaceId: scope.workspaceId,
      name: input.name.trim(),
      slug,
      color: input.color ?? colorFromString(slug, TAG_PALETTE),
    },
  });
  return toTag(row);
}

export async function updateTag(
  scope: Scope,
  tagId: TagId,
  input: { name?: string; color?: string },
): Promise<Tag> {
  assertCanWrite(scope);
  await getTag(scope, tagId);
  const row = await scope.db.tag.update({
    where: { id: tagId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim(), slug: slugify(input.name) } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      revision: { increment: 1 },
    },
  });
  return toTag(row);
}

export async function deleteTag(scope: Scope, tagId: TagId): Promise<void> {
  assertCanWrite(scope);
  const result = await scope.db.tag.updateMany({
    where: { id: tagId, ...scoped(scope) },
    data: { deletedAt: scope.now, revision: { increment: 1 } },
  });
  if (result.count === 0) throw notFound('Tag');
  await scope.db.itemTag.updateMany({
    where: { tagId, workspaceId: scope.workspaceId },
    data: { deletedAt: scope.now },
  });
}

/** Voegt twee tags samen; alle koppelingen verhuizen naar de doeltag. */
export async function mergeTags(
  scope: Scope,
  sourceTagId: TagId,
  targetTagId: TagId,
): Promise<void> {
  assertCanWrite(scope);
  const links = await scope.db.itemTag.findMany({
    where: { tagId: sourceTagId, workspaceId: scope.workspaceId, deletedAt: null },
    select: { itemId: true },
  });

  if (links.length) {
    await scope.db.itemTag.createMany({
      data: links.map((link) => ({
        itemId: link.itemId,
        tagId: targetTagId,
        workspaceId: scope.workspaceId,
      })),
      skipDuplicates: true,
    });
  }
  await deleteTag(scope, sourceTagId);
}

export async function setItemTags(
  scope: Scope,
  itemId: string,
  tagIds: readonly TagId[],
): Promise<void> {
  assertCanWrite(scope);
  await scope.db.itemTag.deleteMany({ where: { itemId, workspaceId: scope.workspaceId } });
  if (tagIds.length) {
    await scope.db.itemTag.createMany({
      data: tagIds.map((tagId) => ({ itemId, tagId, workspaceId: scope.workspaceId })),
      skipDuplicates: true,
    });
  }
}

export async function tagsForItems(
  db: Transactional,
  workspaceId: string,
  itemIds: readonly string[],
): Promise<Map<string, Tag[]>> {
  if (itemIds.length === 0) return new Map();
  const rows = await db.itemTag.findMany({
    where: { workspaceId, itemId: { in: [...itemIds] }, deletedAt: null },
    include: { tag: true },
  });
  const grouped = new Map<string, Tag[]>();
  for (const row of rows) {
    const list = grouped.get(row.itemId) ?? [];
    list.push(toTag(row.tag));
    grouped.set(row.itemId, list);
  }
  return grouped;
}
