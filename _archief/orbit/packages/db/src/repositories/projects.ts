import { ItemType, TaskStatus, type IsoDate, type Project, type ProjectId, type ProjectProgress, type ProjectWithProgress } from '@orbit/types';
import { appendSortKey, ulid } from '@orbit/utils';
import type { Transactional } from '../client';
import { notFound } from '../errors';
import { assertCanWrite, scoped, type Scope } from '../scope';

/**
 * Projecten. De voortgang wordt berekend en niet opgeslagen: een opgeslagen
 * teller loopt onvermijdelijk uit de pas zodra twee devices tegelijk een taak
 * afvinken (zie DATA-MODEL.md, "Waarom afgeleide waarden niet worden opgeslagen").
 */

function toProject(row: {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: Project['status'];
  priority: Project['priority'];
  startDate: Date | null;
  endDate: Date | null;
  sortKey: string;
  favorite: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  serverSeq: bigint;
  revision: number;
}): Project {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
    endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
    sortKey: row.sortKey,
    favorite: row.favorite,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    serverSeq: row.serverSeq.toString(),
    revision: row.revision,
  };
}

export async function listProjects(scope: Scope, includeArchived = false): Promise<Project[]> {
  const rows = await scope.db.project.findMany({
    where: { ...scoped(scope), ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ favorite: 'desc' }, { sortKey: 'asc' }],
  });
  return rows.map(toProject);
}

export async function getProject(scope: Scope, projectId: ProjectId): Promise<Project> {
  const row = await scope.db.project.findFirst({ where: { id: projectId, ...scoped(scope) } });
  if (!row) throw notFound('Project');
  return toProject(row);
}

/**
 * Voortgang van meerdere projecten in vier queries in plaats van vier per
 * project. De sidebar toont dit bij elke paginalading, dus het moet goedkoop zijn.
 */
export async function progressForProjects(
  db: Transactional,
  workspaceId: string,
  projectIds: readonly string[],
  today: IsoDate,
): Promise<Map<string, ProjectProgress>> {
  const empty: ProjectProgress = {
    totalTasks: 0,
    completedTasks: 0,
    percent: 0,
    noteCount: 0,
    ideaCount: 0,
    overdueTasks: 0,
  };
  if (projectIds.length === 0) return new Map();

  const ids = [...projectIds];
  const base = { workspaceId, deletedAt: null, projectId: { in: ids } };

  const [byType, doneTasks, overdue] = await Promise.all([
    db.item.groupBy({ by: ['projectId', 'type'], where: base, _count: { _all: true } }),
    db.item.groupBy({
      by: ['projectId'],
      where: { ...base, type: ItemType.Task, task: { is: { status: TaskStatus.Done } } },
      _count: { _all: true },
    }),
    db.item.groupBy({
      by: ['projectId'],
      where: {
        ...base,
        type: ItemType.Task,
        task: {
          is: {
            status: { in: [TaskStatus.Todo, TaskStatus.InProgress] },
            dueDate: { lt: new Date(`${today}T00:00:00.000Z`) },
          },
        },
      },
      _count: { _all: true },
    }),
  ]);

  const result = new Map<string, ProjectProgress>(ids.map((id) => [id, { ...empty }]));

  for (const group of byType) {
    if (!group.projectId) continue;
    const progress = result.get(group.projectId);
    if (!progress) continue;
    if (group.type === ItemType.Task) progress.totalTasks += group._count._all;
    if (group.type === ItemType.Note) progress.noteCount += group._count._all;
    if (group.type === ItemType.Idea) progress.ideaCount += group._count._all;
  }
  for (const group of doneTasks) {
    if (!group.projectId) continue;
    const progress = result.get(group.projectId);
    if (progress) progress.completedTasks = group._count._all;
  }
  for (const group of overdue) {
    if (!group.projectId) continue;
    const progress = result.get(group.projectId);
    if (progress) progress.overdueTasks = group._count._all;
  }
  for (const progress of result.values()) {
    progress.percent =
      progress.totalTasks === 0
        ? 0
        : Math.round((progress.completedTasks / progress.totalTasks) * 100);
  }

  return result;
}

export async function listProjectsWithProgress(
  scope: Scope,
  today: IsoDate,
  includeArchived = false,
): Promise<ProjectWithProgress[]> {
  const projects = await listProjects(scope, includeArchived);
  const progress = await progressForProjects(
    scope.db,
    scope.workspaceId,
    projects.map((project) => project.id),
    today,
  );
  return projects.map((project) => ({
    ...project,
    progress: progress.get(project.id) ?? {
      totalTasks: 0,
      completedTasks: 0,
      percent: 0,
      noteCount: 0,
      ideaCount: 0,
      overdueTasks: 0,
    },
  }));
}

export interface CreateProjectData {
  id?: string;
  name: string;
  description?: string | null;
  color?: string;
  icon?: string | null;
  status?: Project['status'];
  priority?: Project['priority'];
  startDate?: IsoDate | null;
  endDate?: IsoDate | null;
  favorite?: boolean;
  sortKey?: string;
}

export async function createProject(scope: Scope, data: CreateProjectData): Promise<Project> {
  assertCanWrite(scope);
  const last = await scope.db.project.findFirst({
    where: scoped(scope),
    orderBy: { sortKey: 'desc' },
    select: { sortKey: true },
  });

  const row = await scope.db.project.create({
    data: {
      id: data.id ?? ulid(),
      workspaceId: scope.workspaceId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? '#4f46e5',
      icon: data.icon ?? null,
      status: data.status ?? 'ACTIVE',
      priority: data.priority ?? 'NONE',
      startDate: data.startDate ? new Date(`${data.startDate}T00:00:00.000Z`) : null,
      endDate: data.endDate ? new Date(`${data.endDate}T00:00:00.000Z`) : null,
      favorite: data.favorite ?? false,
      sortKey: data.sortKey ?? appendSortKey(last?.sortKey ?? null),
    },
  });
  return toProject(row);
}

/** Voor quick capture: `#webshop` moet werken zonder het project eerst te maken. */
export async function findOrCreateProjectByName(scope: Scope, name: string): Promise<Project> {
  const existing = await scope.db.project.findFirst({
    where: { ...scoped(scope), name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return toProject(existing);
  return createProject(scope, { name });
}

export async function updateProject(
  scope: Scope,
  projectId: ProjectId,
  data: Partial<CreateProjectData> & { archived?: boolean },
): Promise<Project> {
  assertCanWrite(scope);
  await getProject(scope, projectId);
  const row = await scope.db.project.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.startDate !== undefined
        ? { startDate: data.startDate ? new Date(`${data.startDate}T00:00:00.000Z`) : null }
        : {}),
      ...(data.endDate !== undefined
        ? { endDate: data.endDate ? new Date(`${data.endDate}T00:00:00.000Z`) : null }
        : {}),
      ...(data.favorite !== undefined ? { favorite: data.favorite } : {}),
      ...(data.sortKey !== undefined ? { sortKey: data.sortKey } : {}),
      ...(data.archived !== undefined ? { archivedAt: data.archived ? scope.now : null } : {}),
      revision: { increment: 1 },
    },
  });
  return toProject(row);
}

export async function deleteProject(scope: Scope, projectId: ProjectId): Promise<void> {
  assertCanWrite(scope);
  const result = await scope.db.project.updateMany({
    where: { id: projectId, ...scoped(scope) },
    data: { deletedAt: scope.now, revision: { increment: 1 } },
  });
  if (result.count === 0) throw notFound('Project');
  // Items blijven bestaan; ze verliezen alleen hun projectkoppeling. Een project
  // weggooien mag nooit stilzwijgend het werk eronder weggooien.
  await scope.db.item.updateMany({
    where: { projectId, workspaceId: scope.workspaceId },
    data: { projectId: null, revision: { increment: 1 } },
  });
}
