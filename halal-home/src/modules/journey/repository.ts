/**
 * Data-toegang voor trajecten.
 *
 * DE REGEL: elke functie hier neemt `userId` als eerste argument en gebruikt hem
 * in de WHERE-clausule. Niet "meestal", niet "waar het uitkomt" — altijd.
 *
 * Waarom niet vertrouwen op `journeyId` alleen? Omdat een id raden of afkijken
 * makkelijk is en de fout onzichtbaar: `findUnique({ where: { id } })` werkt
 * perfect, geeft nette data terug, en lekt het traject van iemand anders. Door
 * userId altijd mee te nemen is de veilige variant ook de kortste.
 */
import 'server-only'
import { JourneyStage, JourneyStatus, Prisma, TaskStatus } from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { NotFoundError } from '@/lib/errors'

export type JourneyWithTasks = Prisma.HomeBuyingJourneyGetPayload<{
  include: { tasks: true }
}>

export async function listJourneys(userId: string) {
  return prisma.homeBuyingJourney.findMany({
    where: { userId },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  })
}

/** Het actieve traject. De meeste gebruikers hebben er precies één. */
export async function findActiveJourney(userId: string) {
  return prisma.homeBuyingJourney.findFirst({
    where: { userId, status: JourneyStatus.ACTIVE },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function findJourney(userId: string, journeyId: string) {
  return prisma.homeBuyingJourney.findFirst({
    where: { id: journeyId, userId },
  })
}

export async function requireJourney(userId: string, journeyId: string) {
  const journey = await findJourney(userId, journeyId)
  // Bewust NotFound en niet Forbidden: wie geen toegang heeft, hoort niet te
  // kunnen afleiden dát het traject bestaat.
  if (!journey) throw new NotFoundError('Traject niet gevonden')
  return journey
}

export async function findJourneyWithTasks(
  userId: string,
  journeyId: string,
): Promise<JourneyWithTasks | null> {
  return prisma.homeBuyingJourney.findFirst({
    where: { id: journeyId, userId },
    include: { tasks: { orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }] } },
  })
}

export async function createJourney(
  userId: string,
  data: {
    name: string
    country?: string
    region?: string | null
    targetBudget?: number | null
    ownContribution?: number | null
    targetLocation?: string | null
    targetPostalCode?: string | null
    targetDate?: Date | null
    firstHome?: boolean
  },
) {
  return prisma.homeBuyingJourney.create({
    data: { ...data, userId },
  })
}

export async function updateJourney(
  userId: string,
  journeyId: string,
  data: Prisma.HomeBuyingJourneyUpdateInput,
) {
  // updateMany en niet update: `update` matcht alleen op unieke velden, en dan
  // zou userId niet in de WHERE passen. Zo blijft de eigendomscheck in de query
  // zelf zitten in plaats van in een losse lookup ervoor.
  const result = await prisma.homeBuyingJourney.updateMany({
    where: { id: journeyId, userId },
    data: data as Prisma.HomeBuyingJourneyUpdateManyMutationInput,
  })
  if (result.count === 0) throw new NotFoundError('Traject niet gevonden')

  return requireJourney(userId, journeyId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Taken
// ─────────────────────────────────────────────────────────────────────────────

export async function listTasks(
  userId: string,
  journeyId: string,
  filter?: { stage?: JourneyStage; status?: TaskStatus },
) {
  return prisma.journeyTask.findMany({
    where: {
      journeyId,
      userId,
      ...(filter?.stage ? { stage: filter.stage } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
    include: { dependencies: { select: { dependsOnId: true } } },
  })
}

export async function findTask(userId: string, taskId: string) {
  return prisma.journeyTask.findFirst({
    where: { id: taskId, userId },
    include: { dependencies: { select: { dependsOnId: true } } },
  })
}

export async function updateTaskStatus(userId: string, taskId: string, status: TaskStatus) {
  const result = await prisma.journeyTask.updateMany({
    where: { id: taskId, userId },
    data: {
      status,
      completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
    },
  })
  if (result.count === 0) throw new NotFoundError('Taak niet gevonden')
}

/** Alle openstaande taken van een gebruiker, over trajecten heen. */
export async function listOpenTasks(userId: string, limit = 20) {
  return prisma.journeyTask.findMany({
    where: { userId, status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] } },
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }],
    take: limit,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Gebeurtenissen
// ─────────────────────────────────────────────────────────────────────────────

export async function listUpcomingEvents(userId: string, options?: { limit?: number; from?: Date }) {
  const from = options?.from ?? new Date()
  return prisma.journeyEvent.findMany({
    where: {
      userId,
      completedAt: null,
      OR: [{ startsAt: { gte: from } }, { dueAt: { gte: from } }],
    },
    orderBy: [{ startsAt: { sort: 'asc', nulls: 'last' } }, { dueAt: { sort: 'asc', nulls: 'last' } }],
    take: options?.limit ?? 5,
  })
}
