import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  NEVER_EXPORTED,
  RETENTION_POLICY,
  rulesFor,
  type RetentionRule,
} from '@/server/modules/privacy/retention-policy'
import { EXPECTED_EXPORT_SECTIONS, EXPORT_VERSION } from '@/server/modules/privacy/export.service'

/**
 * Privacy guarantees.
 *
 * Several of these read source rather than executing it. That is deliberate:
 * "the export must never select a password hash" is a property of the query's
 * shape, and a runtime test would only prove it for whatever fixture happened
 * to be in the database.
 */

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

const exportSource = source('src/server/modules/privacy/export.service.ts')
const deletionSource = source('src/server/modules/privacy/deletion.service.ts')

describe('retention policy', () => {
  it('gives every rule an action and a motivation', () => {
    for (const rule of RETENTION_POLICY) {
      expect(['DELETE', 'ANONYMIZE', 'RETAIN'], rule.model).toContain(rule.action)
      // A rule nobody can explain is a rule nobody can defend to a regulator.
      expect(rule.motivation.length, rule.model).toBeGreaterThan(20)
    }
  })

  it('states a retention period for everything it keeps', () => {
    for (const rule of [...rulesFor('RETAIN'), ...rulesFor('ANONYMIZE')]) {
      expect(rule.retentionPeriod, rule.model).toBeTruthy()
    }
  })

  it('lists each model once', () => {
    const models = RETENTION_POLICY.map((rule) => rule.model)
    expect(new Set(models).size).toBe(models.length)
  })

  it('deletes worship data outright — never anonymises it', () => {
    // "Anonymous prayer records" is not something this product should hold, at
    // any scale, for any purpose.
    const worship = ['PrayerLog', 'HabitLog', 'DailyReflection']

    for (const model of worship) {
      const rule = RETENTION_POLICY.find((entry) => entry.model === model)
      expect(rule, model).toBeDefined()
      expect(rule!.action, model).toBe('DELETE')
    }
  })

  it('deletes assistant conversations outright', () => {
    const rule = RETENTION_POLICY.find((entry) => entry.model === 'AIConversation')
    expect(rule?.action).toBe('DELETE')
  })

  it('keeps the audit log, because it proves the deletion happened', () => {
    const rule = RETENTION_POLICY.find((entry) => entry.model === 'AuditLog')
    expect(rule?.action).toBe('RETAIN')
    expect(rule?.exportSection).toBeNull()
  })

  it('keeps the webhook ledger so an old event cannot be replayed', () => {
    const rule = RETENTION_POLICY.find((entry) => entry.model === 'WebhookEvent')
    expect(rule?.action).toBe('RETAIN')
  })
})

describe('export contents', () => {
  it('exports exactly the sections the policy approves', () => {
    // Both directions matter: a section the policy never approved must not
    // appear, and an approved one must not be silently dropped.
    const built = [...exportSource.matchAll(/^\s{4}(\w+),$/gm)].map((match) => match[1]!)
    const sectionsBlock = exportSource.slice(
      exportSource.indexOf('const sections: Record<string, unknown> = {'),
    )
    const declared = [...sectionsBlock.slice(0, sectionsBlock.indexOf('}')).matchAll(/^\s{4}(\w+),$/gm)].map(
      (match) => match[1]!,
    )

    expect(built.length).toBeGreaterThan(0)
    expect(declared.sort()).toEqual([...EXPECTED_EXPORT_SECTIONS].sort())
  })

  it('never selects a password hash', () => {
    expect(exportSource).not.toContain('passwordHash: true')
  })

  it('never selects session or OAuth tokens', () => {
    for (const field of ['sessionToken', 'access_token', 'refresh_token', 'id_token']) {
      expect(exportSource, field).not.toContain(`${field}: true`)
    }
  })

  it('never selects provider customer or subscription identifiers', () => {
    expect(exportSource).not.toContain('externalCustomerId: true')
    expect(exportSource).not.toContain('externalSubscriptionId: true')
  })

  it('never reads the audit log', () => {
    expect(exportSource).not.toContain('auditLog.find')
  })

  it('scopes every query to the caller', () => {
    // An export that forgot one `where: { userId }` would hand a member the
    // whole table. Every `findMany` in the file must be scoped.
    // Each call is inspected from its own start index rather than by a single
    // consuming regex — a fixed-width window would swallow the following call
    // and quietly reduce how much this test actually checks.
    const starts = [...exportSource.matchAll(/prisma\.\w+\.findMany\(/g)].map(
      (match) => match.index!,
    )

    expect(starts.length).toBeGreaterThan(10)
    for (const start of starts) {
      expect(exportSource.slice(start, start + 160)).toContain('where: { userId }')
    }
  })

  it('includes no model the policy marks as never exported', () => {
    for (const model of NEVER_EXPORTED) {
      const accessor = `prisma.${model.charAt(0).toLowerCase()}${model.slice(1)}.find`
      expect(exportSource, model).not.toContain(accessor)
    }
  })

  it('carries a version and a generation timestamp', () => {
    expect(EXPORT_VERSION).toBeGreaterThan(0)
    expect(exportSource).toContain('exportVersion: EXPORT_VERSION')
    expect(exportSource).toContain('generatedAt: now.toISOString()')
  })

  it('records only counts in the audit entry, never content', () => {
    const auditBlock = exportSource.slice(exportSource.indexOf("action: 'DATA_EXPORTED'"))
    const metadata = auditBlock.slice(auditBlock.indexOf('metadata:'), auditBlock.indexOf('})'))

    expect(metadata).toContain('sections:')
    expect(metadata).not.toContain('email')
    expect(metadata).not.toContain('name')
  })
})

describe('deletion policy', () => {
  it('refuses to delete an account with live billing', () => {
    expect(deletionSource).toContain('BLOCKED_BILLING')
    expect(deletionSource).toContain('grantsAccess(')
    // The guard appears in both the request and the completion path: cancelling
    // is checked when asked, and again when the policy actually runs.
    expect(deletionSource.match(/grantsAccess\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('never bypasses the billing guard, even with force', () => {
    // `force` exists for tests and for an operator skipping the grace window.
    // It must not be a way to delete an account a provider can still charge.
    const forceUse = deletionSource.slice(deletionSource.indexOf('if (!options.force'))
    expect(forceUse).toContain('DELETION_GRACE_DAYS')

    const billingGuard = deletionSource.indexOf("deletionStatus: 'BLOCKED_BILLING' }")
    const graceGuard = deletionSource.indexOf('if (!options.force')
    expect(billingGuard).toBeLessThan(graceGuard)
  })

  it('revokes sessions when deletion is requested, not when it completes', () => {
    const requestBlock = deletionSource.slice(
      deletionSource.indexOf('export async function requestAccountDeletion'),
      deletionSource.indexOf('export async function cancelAccountDeletion'),
    )

    expect(requestBlock).toContain('revokeSessions(')
  })

  it('is idempotent once completed', () => {
    expect(deletionSource).toContain("reason: 'ALREADY_COMPLETED'")
  })

  it('clears activity without touching the account or subscription', () => {
    const clearBlock = deletionSource.slice(
      deletionSource.indexOf('export async function clearActivity'),
      deletionSource.indexOf('// ─────────────────────────────────────────────────────────────────────────────\n// Account deletion'),
    )

    expect(clearBlock).toContain('habitLog.deleteMany')
    expect(clearBlock).toContain('prayerLog.deleteMany')
    // Clearing history is not leaving. These must survive.
    expect(clearBlock).not.toContain('subscription.')
    expect(clearBlock).not.toContain('userPreference.')
    expect(clearBlock).not.toContain('user.delete')
  })

  it('deletes every model the policy marks DELETE, except cascades', () => {
    const cascaded = new Set([
      // Removed by the parent row's cascade rather than by name.
      'RateLimitEntry',
    ])

    for (const rule of rulesFor('DELETE')) {
      if (cascaded.has(rule.model)) continue

      const accessor = `${rule.model.charAt(0).toLowerCase()}${rule.model.slice(1)}.deleteMany`
      // Prisma's accessor for `AIConversation` is `aIConversation`.
      const alternate = accessor.replace(/^ai/, 'aI')

      expect(
        deletionSource.includes(accessor) || deletionSource.includes(alternate),
        `${rule.model} is marked DELETE but never deleted`,
      ).toBe(true)
    }
  })

  it('severs the user link for every model the policy marks ANONYMIZE', () => {
    for (const rule of rulesFor('ANONYMIZE')) {
      const accessor = `${rule.model.charAt(0).toLowerCase()}${rule.model.slice(1)}.updateMany`
      const alternate = accessor.replace(/^ai/, 'aI')

      expect(
        deletionSource.includes(accessor) || deletionSource.includes(alternate),
        `${rule.model} is marked ANONYMIZE but never updated`,
      ).toBe(true)
    }
  })

  it('scrubs the account row rather than deleting it', () => {
    // Deleting it would cascade into the retained records and orphan the audit
    // trail's foreign key.
    expect(deletionSource).toContain("deletionStatus: 'COMPLETED'")
    expect(deletionSource).toContain('passwordHash: null')
    expect(deletionSource).toContain('anonymizedAt: now')
    expect(deletionSource).not.toMatch(/tx\.user\.delete\(/)
  })

  it('replaces the email with an irreversible digest', () => {
    expect(deletionSource).toContain("createHash('sha256')")
    expect(deletionSource).toContain('@deleted.invalid')
  })

  it('sends the closing notice before the address is scrubbed', () => {
    const notice = deletionSource.indexOf("type: 'ACCOUNT_DELETION_COMPLETED'")
    const scrub = deletionSource.indexOf('email: `deleted+')

    expect(notice).toBeGreaterThan(-1)
    expect(notice).toBeLessThan(scrub)
  })

  it('makes the tombstone account unusable', () => {
    const tombstone = deletionSource.slice(deletionSource.indexOf('async function ensureTombstone'))

    expect(tombstone).toContain('passwordHash: null')
    expect(tombstone).toContain("deletionStatus: 'COMPLETED'")
  })
})

describe('actor resolution honours deletion', () => {
  const actorSource = source('src/server/auth/actor.ts')

  it('refuses to resolve a completed deletion', () => {
    expect(actorSource).toContain("user.deletionStatus === 'COMPLETED'")
  })

  it('derives the plan from the shared billing policy', () => {
    // Not from `subscription.plan` directly — that skipped the grace window and
    // cut members off the moment a renewal failed.
    expect(actorSource).toContain('effectivePlan(user.subscription)')
    expect(actorSource).not.toMatch(/sub\.status === 'ACTIVE'/)
  })
})

describe('routes protecting the privacy operations', () => {
  const routes = {
    export: source('src/app/api/privacy/export/route.ts'),
    activity: source('src/app/api/privacy/activity/route.ts'),
    account: source('src/app/api/privacy/account/route.ts'),
  }

  it('requires an authenticated actor everywhere', () => {
    for (const [name, route] of Object.entries(routes)) {
      expect(route, name).toContain('requireActor()')
    }
  })

  it('enforces same-origin on every mutating handler', () => {
    for (const [name, route] of Object.entries(routes)) {
      expect(route, name).toContain('requireSameOrigin(request)')
    }
  })

  it('rate-limits every operation', () => {
    for (const [name, route] of Object.entries(routes)) {
      expect(route, name).toMatch(/enforce\('privacy\.\w+', actor\.userId\)/)
    }
  })

  it('never caches the export response', () => {
    expect(routes.export).toContain('no-store')
    expect(routes.export).toContain('private')
  })

  it('requires a typed confirmation for both destructive operations', () => {
    expect(routes.activity).toContain("'CLEAR'")
    expect(routes.account).toContain('confirmation')
  })
})

describe('maintenance job', () => {
  const job = source('src/app/api/jobs/maintenance/route.ts')

  it('refuses without a configured token', () => {
    expect(job).toContain('HEALTH_CHECK_TOKEN')
    expect(job).toContain('if (!expected) return false')
  })

  it('compares the token in constant time', () => {
    expect(job).toContain('timingSafeEqual')
  })

  it('hides its existence from unauthenticated callers', () => {
    expect(job).toContain('status: 404')
  })

  it('keeps going when one account fails', () => {
    expect(job).toContain('catch')
    expect(job).toContain('failed += 1')
  })
})

/** Type-level guard: the policy shape cannot drift without this failing. */
const _policyShape: readonly RetentionRule[] = RETENTION_POLICY
void _policyShape
