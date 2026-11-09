import {
  MemberRole,
  type MemberRole as MemberRoleType,
  type UserId,
  type Workspace,
  type WorkspaceId,
} from '@orbit/types';
import { generateSortKeys, slugify, ulid } from '@orbit/utils';
import type { Transactional } from '../client';
import { forbidden, notFound } from '../errors';

/** De mappen die elke nieuwe workspace meekrijgt (uit de requirements, par. 4). */
const DEFAULT_FOLDERS = [
  { name: 'Werk', icon: 'briefcase', color: '#4f46e5' },
  { name: 'Persoonlijk', icon: 'user', color: '#14b8a6' },
  { name: 'Business', icon: 'trending-up', color: '#f97316' },
  { name: 'Ideeën', icon: 'lightbulb', color: '#eab308' },
  { name: 'Projecten', icon: 'folder', color: '#8b5cf6' },
] as const;

/** De starttags uit de requirements, par. 9. */
const DEFAULT_TAGS = [
  { name: 'Werk', color: '#4f46e5' },
  { name: 'Privé', color: '#14b8a6' },
  { name: 'Business', color: '#f97316' },
  { name: 'Urgent', color: '#ef4444' },
  { name: 'Finance', color: '#22c55e' },
  { name: 'Klanten', color: '#8b5cf6' },
] as const;

function toWorkspace(row: {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  personal: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.ownerId,
    personal: row.personal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Slug uniek maken zonder een race: bij botsing een suffix, tot het lukt. */
async function uniqueSlug(db: Transactional, base: string): Promise<string> {
  const root = slugify(base) || 'workspace';
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const existing = await db.workspace.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${root}-${ulid().slice(-6).toLowerCase()}`;
}

/**
 * De persoonlijke workspace die elke gebruiker bij registratie krijgt.
 *
 * Ook een solo-gebruiker krijgt een volwaardige workspace met membership. Dat
 * kost nu niets en voorkomt dat teamfunctionaliteit later een datamigratie wordt.
 */
export async function createWorkspaceWithDefaults(
  db: Transactional,
  input: { ownerId: UserId; name: string; personal: boolean },
): Promise<Workspace> {
  const id = ulid();
  const slug = await uniqueSlug(db, input.name);

  const workspace = await db.workspace.create({
    data: {
      id,
      name: input.name,
      slug,
      ownerId: input.ownerId,
      personal: input.personal,
      memberships: {
        create: { userId: input.ownerId, role: MemberRole.Owner },
      },
    },
  });

  const folderKeys = generateSortKeys(null, null, DEFAULT_FOLDERS.length);
  await db.noteFolder.createMany({
    data: DEFAULT_FOLDERS.map((folder, index) => ({
      id: ulid(),
      workspaceId: id,
      name: folder.name,
      icon: folder.icon,
      color: folder.color,
      sortKey: folderKeys[index] as string,
    })),
  });

  await db.tag.createMany({
    data: DEFAULT_TAGS.map((tag) => ({
      id: ulid(),
      workspaceId: id,
      name: tag.name,
      slug: slugify(tag.name),
      color: tag.color,
    })),
  });

  return toWorkspace(workspace);
}

export async function findWorkspaceById(
  db: Transactional,
  workspaceId: WorkspaceId,
): Promise<Workspace | null> {
  const row = await db.workspace.findFirst({ where: { id: workspaceId, deletedAt: null } });
  return row ? toWorkspace(row) : null;
}

export interface WorkspaceMembership {
  workspace: Workspace;
  role: MemberRoleType;
}

export async function listWorkspacesForUser(
  db: Transactional,
  userId: UserId,
): Promise<WorkspaceMembership[]> {
  const rows = await db.membership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' },
  });
  return rows.map((row) => ({ workspace: toWorkspace(row.workspace), role: row.role }));
}

/**
 * Bepaalt of een gebruiker bij een workspace mag en met welke rol. Elke
 * geauthenticeerde request loopt hierlangs voordat er ook maar iets gelezen wordt.
 */
export async function requireMembership(
  db: Transactional,
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<MemberRoleType> {
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: { select: { deletedAt: true } } },
  });
  if (!membership) throw forbidden('Geen toegang tot deze workspace');
  if (membership.workspace.deletedAt) throw notFound('Workspace');
  return membership.role;
}

/** De workspace waar de app na inloggen in opent. */
export async function defaultWorkspaceForUser(
  db: Transactional,
  userId: UserId,
): Promise<Workspace> {
  const memberships = await listWorkspacesForUser(db, userId);
  const personal = memberships.find((entry) => entry.workspace.personal);
  const chosen = personal ?? memberships[0];
  if (!chosen) throw notFound('Workspace');
  return chosen.workspace;
}

export async function renameWorkspace(
  db: Transactional,
  workspaceId: WorkspaceId,
  name: string,
): Promise<Workspace> {
  const row = await db.workspace.update({ where: { id: workspaceId }, data: { name } });
  return toWorkspace(row);
}

export async function addMember(
  db: Transactional,
  workspaceId: WorkspaceId,
  userId: UserId,
  role: MemberRoleType,
): Promise<void> {
  await db.membership.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: { workspaceId, userId, role },
    update: { role },
  });
}

export async function removeMember(
  db: Transactional,
  workspaceId: WorkspaceId,
  userId: UserId,
): Promise<void> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (workspace?.ownerId === userId) {
    throw forbidden('De eigenaar kan niet uit de workspace worden verwijderd');
  }
  await db.membership.deleteMany({ where: { workspaceId, userId } });
}
