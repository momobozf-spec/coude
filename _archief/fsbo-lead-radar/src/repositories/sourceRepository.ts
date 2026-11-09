/**
 * Bronrijen, hun gezondheid en hun runs.
 *
 * De claim-logica hieronder is het enige stukje concurrency-beheer in het
 * systeem, en het is bewust in SQL opgelost in plaats van in Node: twee workers
 * die tegelijk starten moeten niet dezelfde bron ophalen, en de enige plek waar
 * dat betrouwbaar te regelen is, is de database.
 */
import type { CollectorRunStatus, Prisma, Source, SourceHealth } from '@prisma/client'

import type { CollectorDefinition } from '@/collectors/types'

import { prisma } from './prisma'

export type SourceRow = Source

export async function listSources(): Promise<SourceRow[]> {
  return prisma.source.findMany({ orderBy: { key: 'asc' } })
}

export async function findSourceByKey(key: string): Promise<SourceRow | null> {
  return prisma.source.findUnique({ where: { key } })
}

/**
 * Zorgt dat elke geregistreerde collector een rij heeft.
 *
 * Bestaat de rij al, dan blijven `enabled` en de intervallen staan — die zijn
 * via het dashboard ingesteld en mogen niet bij elke start teruggezet worden
 * naar de standaard uit de code. Alleen de beschrijvende velden worden
 * bijgewerkt, want die horen bij de collector en niet bij de omgeving.
 */
export async function syncSourceRegistry(
  collectors: readonly CollectorDefinition[],
): Promise<SourceRow[]> {
  const rows: SourceRow[] = []

  for (const collector of collectors) {
    rows.push(
      await prisma.source.upsert({
        where: { key: collector.key },
        create: {
          key: collector.key,
          name: collector.name,
          accessMethod: collector.accessMethod,
          baseUrl: collector.baseUrl,
          accessNotes: collector.accessNotes,
          pollIntervalSeconds: collector.defaultPollIntervalSeconds,
          rateLimitPerMinute: collector.defaultRateLimitPerMinute,
          enabled: false,
        },
        update: {
          name: collector.name,
          accessMethod: collector.accessMethod,
          baseUrl: collector.baseUrl,
          accessNotes: collector.accessNotes,
        },
      }),
    )
  }

  return rows
}

/**
 * Claimt de bronnen die nu aan de beurt zijn, in één atomaire stap per bron.
 *
 * `updateMany` met de voorwaarden in de WHERE is hier het hele punt: twee
 * workers die op dezelfde milliseconde beginnen, doen beiden een UPDATE, en
 * PostgreSQL laat er precies één slagen (`count === 1`). Zou dit een SELECT
 * gevolgd door een UPDATE zijn, dan zouden beide workers de bron ophalen en
 * dezelfde advertenties twee keer verwerken.
 */
export async function claimDueSources(options: {
  workerId: string
  now: Date
  lockDurationMs: number
  allowedKeys: readonly string[]
  limit: number
}): Promise<SourceRow[]> {
  if (options.allowedKeys.length === 0) return []

  const candidates = await prisma.source.findMany({
    where: {
      key: { in: [...options.allowedKeys] },
      enabled: true,
      OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: options.now } }],
      AND: [{ OR: [{ lockedUntil: null }, { lockedUntil: { lte: options.now } }] }],
    },
    orderBy: { lastRunAt: { sort: 'asc', nulls: 'first' } },
    take: options.limit * 3,
  })

  const claimed: SourceRow[] = []
  const lockedUntil = new Date(options.now.getTime() + options.lockDurationMs)

  for (const candidate of candidates) {
    if (claimed.length >= options.limit) break

    // Is het interval verstreken? Een bron zonder eerdere run is meteen aan de beurt.
    const dueAt =
      candidate.lastRunAt === null
        ? options.now
        : new Date(candidate.lastRunAt.getTime() + candidate.pollIntervalSeconds * 1000)
    if (dueAt > options.now) continue

    const result = await prisma.source.updateMany({
      where: {
        id: candidate.id,
        enabled: true,
        // Dezelfde voorwaarden nog eens, nu binnen de UPDATE: tussen de SELECT
        // hierboven en deze regel kan een andere worker de bron geclaimd hebben.
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: options.now } }],
      },
      data: { lockedUntil, lockedBy: options.workerId },
    })

    if (result.count === 1) {
      claimed.push({ ...candidate, lockedUntil, lockedBy: options.workerId })
    }
  }

  return claimed
}

export async function releaseSource(sourceId: string): Promise<void> {
  await prisma.source.update({
    where: { id: sourceId },
    data: { lockedUntil: null, lockedBy: null },
  })
}

export async function startRun(sourceId: string, attempt: number): Promise<string> {
  const run = await prisma.collectorRun.create({
    data: { sourceId, attempt, status: 'RUNNING' },
    select: { id: true },
  })
  return run.id
}

export interface RunOutcome {
  status: CollectorRunStatus
  itemsFetched: number
  itemsNew: number
  itemsUpdated: number
  itemsUnchanged: number
  itemsDuplicate: number
  itemsRejected: number
  leadsQualified: number
  alertsSent: number
  alertsSuppressed: number
  errorKind?: string
  error?: string
}

export async function finishRun(runId: string, outcome: RunOutcome, startedAt: Date): Promise<void> {
  await prisma.collectorRun.update({
    where: { id: runId },
    data: {
      ...outcome,
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
    },
  })
}

/**
 * Werkt de gezondheid van een bron bij na een run.
 *
 * ─── DE COOLDOWN-LADDER ──────────────────────────────────────────────────────
 *
 * Failure isolation zit hier. Een bron die blijft falen moet zichzelf uit de
 * planning halen, anders vult hij elke worker-tick met dezelfde mislukking en
 * verdringt hij de bronnen die het wél doen.
 *
 *   1–2 mislukkingen  → DEGRADED, geen cooldown (een dip mag)
 *   3–4               → FAILING, cooldown groeit exponentieel
 *   5+                → BLOCKED, volledige cooldown-periode
 *
 * Een blokkade of een robots-verbod springt meteen naar het einde van de ladder:
 * dat is geen storing die overgaat, en het opnieuw proberen zou precies het
 * gedrag zijn dat we niet willen vertonen.
 */
export async function recordSuccess(sourceId: string, at: Date): Promise<void> {
  await prisma.source.update({
    where: { id: sourceId },
    data: {
      health: 'HEALTHY',
      consecutiveFailures: 0,
      lastRunAt: at,
      lastSuccessAt: at,
      lastError: null,
      cooldownUntil: null,
      lockedUntil: null,
      lockedBy: null,
    },
  })
}

export async function recordFailure(options: {
  sourceId: string
  at: Date
  errorKind: string
  message: string
  cooldownMinutes: number
}): Promise<{ health: SourceHealth; consecutiveFailures: number }> {
  const current = await prisma.source.findUniqueOrThrow({
    where: { id: options.sourceId },
    select: { consecutiveFailures: true },
  })

  const failures = current.consecutiveFailures + 1
  const permanentlyBlocked =
    options.errorKind === 'ROBOTS_DISALLOWED' ||
    options.errorKind === 'ACCESS_BLOCKED' ||
    options.errorKind === 'CONFIG_ERROR'

  let health: SourceHealth
  let cooldownMs: number

  if (permanentlyBlocked) {
    health = 'BLOCKED'
    cooldownMs = options.cooldownMinutes * 60_000
  } else if (failures >= 5) {
    health = 'BLOCKED'
    cooldownMs = options.cooldownMinutes * 60_000
  } else if (failures >= 3) {
    health = 'FAILING'
    cooldownMs = Math.min(options.cooldownMinutes * 60_000, 60_000 * 2 ** (failures - 3))
  } else {
    health = 'DEGRADED'
    cooldownMs = 0
  }

  await prisma.source.update({
    where: { id: options.sourceId },
    data: {
      health,
      consecutiveFailures: failures,
      lastRunAt: options.at,
      lastFailureAt: options.at,
      lastError: `${options.errorKind}: ${options.message}`.slice(0, 500),
      cooldownUntil: cooldownMs > 0 ? new Date(options.at.getTime() + cooldownMs) : null,
      lockedUntil: null,
      lockedBy: null,
    },
  })

  return { health, consecutiveFailures: failures }
}

export async function recentRuns(limit = 20): Promise<
  Prisma.CollectorRunGetPayload<{ include: { source: { select: { key: true; name: true } } } }>[]
> {
  return prisma.collectorRun.findMany({
    include: { source: { select: { key: true, name: true } } },
    orderBy: { startedAt: 'desc' },
    take: limit,
  })
}

export async function updateSourceSettings(
  key: string,
  data: {
    enabled?: boolean
    pollIntervalSeconds?: number
    rateLimitPerMinute?: number
    timeoutMs?: number
    maxRetries?: number
  },
): Promise<void> {
  await prisma.source.update({
    where: { key },
    data: {
      ...data,
      // Handmatig aanzetten heft de cooldown op — anders zet je een bron aan en
      // gebeurt er een half uur niets zonder dat het dashboard uitlegt waarom.
      ...(data.enabled === true
        ? { cooldownUntil: null, consecutiveFailures: 0, health: 'UNKNOWN' as SourceHealth }
        : {}),
      ...(data.enabled === false ? { health: 'DISABLED' as SourceHealth } : {}),
    },
  })
}
