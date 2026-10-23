import 'server-only'

import { logger } from '@/lib/logger'
import { RateLimitError } from '@/lib/errors'
import type { Actor } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'
import { EXPORTED_RULES, RETENTION_POLICY } from '@/server/modules/privacy/retention-policy'
import { writeAudit } from '@/server/services/audit'

/**
 * Personal data export (GDPR art. 15 / art. 20).
 *
 * One synchronous JSON document. Not a background job with an emailed link,
 * because a link is a second thing to secure — the member is already
 * authenticated, so the file is streamed to them and never stored.
 *
 * What is *not* in it matters as much as what is: no password hash, no session
 * or OAuth tokens, no audit log, no provider secrets, and nothing belonging to
 * anyone else. Where a row references another member's content (a favourited
 * business), only the public identity of that content is included.
 */

/** Bumped whenever the shape changes, so an old file stays interpretable. */
export const EXPORT_VERSION = 2

/** One export per this window. Building the file is expensive and it is a full copy. */
export const EXPORT_COOLDOWN_HOURS = 6

export interface DataExport {
  exportVersion: number
  generatedAt: string
  /** Explains, in the file itself, what was left out and why. */
  notice: {
    excluded: string[]
    retained: { model: string; motivation: string; retentionPeriod: string | null }[]
  }
  account: Record<string, unknown>
  sections: Record<string, unknown>
}

export interface ExportEligibility {
  allowed: boolean
  lastExportAt: Date | null
  retryAfterHours: number
}

export async function getExportEligibility(
  actor: Actor,
  now: Date = new Date(),
): Promise<ExportEligibility> {
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { lastExportAt: true },
  })

  const last = user?.lastExportAt ?? null
  if (!last) return { allowed: true, lastExportAt: null, retryAfterHours: 0 }

  const elapsedHours = (now.getTime() - last.getTime()) / 3_600_000
  const remaining = EXPORT_COOLDOWN_HOURS - elapsedHours

  return {
    allowed: remaining <= 0,
    lastExportAt: last,
    retryAfterHours: Math.max(0, Math.ceil(remaining)),
  }
}

export async function buildDataExport(actor: Actor, now: Date = new Date()): Promise<DataExport> {
  const eligibility = await getExportEligibility(actor, now)
  if (!eligibility.allowed) {
    throw new RateLimitError(eligibility.retryAfterHours * 3600)
  }

  const userId = actor.userId

  // Claim the window before doing the work. A member double-clicking should get
  // one export and one rate-limit error, not two full table scans.
  await prisma.user.update({ where: { id: userId }, data: { lastExportAt: now } })

  const [
    account,
    preferences,
    subscription,
    tasks,
    habits,
    habitLogs,
    prayerLogs,
    goals,
    dailySummaries,
    plannerBlocks,
    reflections,
    favoriteBusinesses,
    favoriteDeals,
    redemptions,
    assistantConversations,
    assistantUsage,
    generatedPlans,
    notifications,
    analyticsEvents,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        role: true,
        locale: true,
        timezone: true,
        onboardedAt: true,
        createdAt: true,
        // Deliberately absent: passwordHash.
      },
    }),
    prisma.userPreference.findUnique({
      where: { userId },
      select: {
        calculationMethod: true,
        madhab: true,
        highLatitudeRule: true,
        prayerOffsets: true,
        latitude: true,
        longitude: true,
        interests: true,
        goals: true,
        dailyQuranPages: true,
        dailyDhikrTarget: true,
        weekStartsOn: true,
        theme: true,
        timeFormat: true,
        notificationPrefs: true,
        country: { select: { name: true, code: true } },
        city: { select: { name: true } },
      },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        plan: true,
        status: true,
        interval: true,
        provider: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
        createdAt: true,
        // Deliberately absent: externalCustomerId, externalSubscriptionId.
        // Those are the provider's identifiers for us, not facts about them.
      },
    }),
    prisma.task.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.habit.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.habitLog.findMany({ where: { userId }, orderBy: { localDate: 'asc' } }),
    prisma.prayerLog.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.dailySummary.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.plannerBlock.findMany({ where: { userId }, orderBy: { localDate: 'asc' } }),
    prisma.dailyReflection.findMany({ where: { userId }, orderBy: { localDate: 'asc' } }),
    prisma.favoriteBusiness.findMany({
      where: { userId },
      select: {
        createdAt: true,
        // The business's public identity only — not the partner's contract,
        // owner or internal flags.
        business: { select: { name: true, slug: true, city: { select: { name: true } } } },
      },
    }),
    prisma.favoriteDeal.findMany({
      where: { userId },
      select: { createdAt: true, deal: { select: { title: true } } },
    }),
    prisma.dealRedemption.findMany({
      where: { userId },
      select: {
        code: true,
        status: true,
        issuedAt: true,
        redeemedAt: true,
        expiresAt: true,
        deal: { select: { title: true } },
      },
    }),
    prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        title: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true, createdAt: true },
        },
      },
    }),
    prisma.aIUsage.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.generatedPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { items: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { type: true, title: true, body: true, readAt: true, createdAt: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { occurredAt: 'asc' },
      select: { name: true, properties: true, occurredAt: true },
    }),
  ])

  const sections: Record<string, unknown> = {
    preferences,
    subscription,
    tasks,
    habits,
    habitLogs,
    prayerLogs,
    goals,
    dailySummaries,
    plannerBlocks,
    reflections,
    favoriteBusinesses,
    favoriteDeals,
    redemptions,
    assistantConversations,
    assistantUsage,
    generatedPlans,
    notifications,
    analyticsEvents,
  }

  await writeAudit({
    actorId: userId,
    action: 'DATA_EXPORTED',
    entityType: 'User',
    entityId: userId,
    // Counts, not content.
    metadata: { sections: Object.keys(sections).length, version: EXPORT_VERSION },
  })

  logger.info('privacy.export.built', { sections: Object.keys(sections).length })

  return {
    exportVersion: EXPORT_VERSION,
    generatedAt: now.toISOString(),
    notice: {
      excluded: [
        'Password hash',
        'Session tokens and OAuth provider tokens',
        'Security and audit records',
        'Payment provider customer and subscription identifiers',
        'Any data belonging to another member',
      ],
      retained: RETENTION_POLICY.filter((rule) => rule.action === 'RETAIN').map((rule) => ({
        model: rule.model,
        motivation: rule.motivation,
        retentionPeriod: rule.retentionPeriod ?? null,
      })),
    },
    account,
    sections,
  }
}

/**
 * Section names the export must contain, derived from the retention policy.
 *
 * The test asserts `Object.keys(sections)` matches this exactly, so adding a
 * model to the policy without exporting it — or exporting something the policy
 * never approved — fails rather than shipping.
 */
export const EXPECTED_EXPORT_SECTIONS: readonly string[] = EXPORTED_RULES.map(
  (rule) => rule.exportSection,
).filter((section): section is string => section !== null)
