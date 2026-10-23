/**
 * What happens to each kind of data when a member leaves, and why.
 *
 * This table is the specification. The export service and the deletion service
 * both read it, so "what we hand over" and "what we remove" can never quietly
 * disagree with each other — or with what the privacy page tells people.
 *
 * Three outcomes:
 *
 *  - `DELETE`     — the rows go. The default, and what applies to everything
 *                   the member actually created.
 *  - `ANONYMIZE`  — the row survives without anything identifying. Used where a
 *                   record has to keep existing for a reason that is not about
 *                   this person (an aggregate, a reconciliation trail).
 *  - `RETAIN`     — the row survives intact, because a law requires it. Every
 *                   entry here needs a legal basis written down, not a hunch
 *                   that it might be handy.
 */

export type RetentionAction = 'DELETE' | 'ANONYMIZE' | 'RETAIN'

export interface RetentionRule {
  /** Prisma model name, as it appears in the schema. */
  model: string
  /** Section name in the export file. `null` means it is not exported. */
  exportSection: string | null
  action: RetentionAction
  /** Why this action, in a sentence a non-engineer can check. */
  motivation: string
  /** For RETAIN, how long. `null` where the answer is "as long as the law says". */
  retentionPeriod?: string | null
}

export const RETENTION_POLICY: readonly RetentionRule[] = [
  // ── The member's own content ────────────────────────────────────────────────
  {
    model: 'Task',
    exportSection: 'tasks',
    action: 'DELETE',
    motivation: 'Written by the member. Nothing needs it once they are gone.',
  },
  {
    model: 'Habit',
    exportSection: 'habits',
    action: 'DELETE',
    motivation: 'Written by the member.',
  },
  {
    model: 'HabitLog',
    exportSection: 'habitLogs',
    action: 'DELETE',
    motivation: 'A private record of what someone did on a given day.',
  },
  {
    model: 'PrayerLog',
    exportSection: 'prayerLogs',
    action: 'DELETE',
    motivation:
      'The most sensitive data in the product — a record of someone’s worship. It is deleted outright and is never anonymised, because "anonymous prayer records" is not a thing this product should hold.',
  },
  {
    model: 'Goal',
    exportSection: 'goals',
    action: 'DELETE',
    motivation: 'Written by the member.',
  },
  {
    model: 'DailySummary',
    exportSection: 'dailySummaries',
    action: 'DELETE',
    motivation: 'Derived entirely from data that is itself being deleted.',
  },
  {
    model: 'PlannerBlock',
    exportSection: 'plannerBlocks',
    action: 'DELETE',
    motivation: 'Written by the member.',
  },
  {
    model: 'DailyReflection',
    exportSection: 'reflections',
    action: 'DELETE',
    motivation: 'Free-text personal writing. Deleted outright.',
  },
  {
    model: 'FavoriteBusiness',
    exportSection: 'favoriteBusinesses',
    action: 'DELETE',
    motivation: 'A private list of places.',
  },
  {
    model: 'FavoriteDeal',
    exportSection: 'favoriteDeals',
    action: 'DELETE',
    motivation: 'A private list of offers.',
  },
  {
    model: 'AIConversation',
    exportSection: 'assistantConversations',
    action: 'DELETE',
    motivation:
      'Includes the member’s own words. Deleted with its messages by cascade — no copy is kept for model improvement, because we do not do that.',
  },
  {
    model: 'GeneratedPlan',
    exportSection: 'generatedPlans',
    action: 'DELETE',
    motivation: 'Generated for one person, about their life.',
  },
  {
    model: 'UserPreference',
    exportSection: 'preferences',
    action: 'DELETE',
    motivation:
      'Settings, including approximate location and prayer calculation choices. Nothing depends on them afterwards.',
  },
  {
    model: 'Notification',
    exportSection: 'notifications',
    action: 'DELETE',
    motivation: 'Messages addressed to the member, with their deliveries, by cascade.',
  },

  // ── Sessions and credentials ────────────────────────────────────────────────
  {
    model: 'Session',
    exportSection: null,
    action: 'DELETE',
    motivation:
      'Deleted immediately on request, before anything else, so a stolen session cannot outlive the account. Never exported: a live session token in a downloadable file is a credential leak.',
  },
  {
    model: 'Account',
    exportSection: null,
    action: 'DELETE',
    motivation:
      'OAuth links, including provider refresh tokens. Never exported for the same reason.',
  },

  {
    model: 'PasswordResetToken',
    exportSection: null,
    action: 'DELETE',
    motivation:
      'Hashed one-time reset links. Deleted with the account by cascade; never exported, because even a used link is a credential artefact.',
  },

  // ── Records that must outlive the account ───────────────────────────────────
  {
    model: 'Subscription',
    exportSection: 'subscription',
    action: 'ANONYMIZE',
    motivation:
      'The row is kept, detached from the person, so a provider webhook arriving after deletion can still be reconciled rather than creating a phantom account. Provider customer and subscription ids are cleared.',
    retentionPeriod: 'Until the provider subscription is terminated',
  },
  {
    model: 'DealRedemption',
    exportSection: 'redemptions',
    action: 'ANONYMIZE',
    motivation:
      'A partner business is entitled to know a code was redeemed and honoured. They are not entitled to know who redeemed it once that person has left.',
    retentionPeriod: '24 months',
  },
  {
    model: 'AIUsage',
    exportSection: 'assistantUsage',
    action: 'ANONYMIZE',
    motivation:
      'Monthly counters only — no prompts, no content. Kept detached from the person for cost accounting.',
    retentionPeriod: '12 months',
  },
  {
    model: 'AnalyticsEvent',
    exportSection: 'analyticsEvents',
    action: 'ANONYMIZE',
    motivation:
      'Events carry no personal content by construction (numbers and booleans only). The user link is severed so retention curves survive without the person doing so.',
    retentionPeriod: '25 months',
  },
  {
    model: 'AuditLog',
    exportSection: null,
    action: 'RETAIN',
    motivation:
      'Security and billing record: who changed a subscription, when a deletion was requested. Removing it would erase the evidence that the deletion itself was performed correctly. Not exported, because it is a security artefact rather than personal content, and it references internal ids.',
    retentionPeriod: 'As required for security and accounting records',
  },
  {
    model: 'WebhookEvent',
    exportSection: null,
    action: 'RETAIN',
    motivation:
      'Provider event ledger, keyed by provider event id. It is what makes webhook processing exactly-once; deleting entries would let an old event be replayed.',
    retentionPeriod: '13 months',
  },
  {
    model: 'RateLimitEntry',
    exportSection: null,
    action: 'DELETE',
    motivation: 'Short-lived counters, pruned within a day regardless.',
  },
] as const

/** Rules that put something in the export file, in the order sections appear. */
export const EXPORTED_RULES = RETENTION_POLICY.filter((rule) => rule.exportSection !== null)

/** Model names that must never appear in an export, for the test to assert. */
export const NEVER_EXPORTED = RETENTION_POLICY.filter((rule) => rule.exportSection === null).map(
  (rule) => rule.model,
)

export function rulesFor(action: RetentionAction): readonly RetentionRule[] {
  return RETENTION_POLICY.filter((rule) => rule.action === action)
}
