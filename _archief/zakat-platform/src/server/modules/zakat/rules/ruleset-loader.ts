import 'server-only'

import { prisma } from '@/server/db/prisma'
import type { RuleSetSnapshot } from '@/server/modules/zakat/types'
import { RuleSetNotFoundError } from '@/server/modules/zakat/errors'

/**
 * Loads a ruleset with all of its rules in a single query and indexes them by
 * type (§35).
 *
 * The engine then does map lookups instead of a query per asset, so a
 * calculation costs one round-trip for the rules regardless of how many
 * positions the user holds — no N+1.
 */

const INCLUDE_RULES = {
  assetRules: true,
  liabilityRules: true,
} as const

type LoadedRuleSet = Awaited<ReturnType<typeof findActive>>

async function findActive() {
  return prisma.zakatRuleSet.findFirst({
    where: { active: true },
    orderBy: { validFrom: 'desc' },
    include: INCLUDE_RULES,
  })
}

function toSnapshot(row: NonNullable<LoadedRuleSet>): RuleSetSnapshot {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    methodology: row.methodology,
    zakatRate: row.zakatRate.toString(),
    goldNisabGrams: row.goldNisabGrams.toString(),
    silverNisabGrams: row.silverNisabGrams.toString(),
    allowLiabilityDeduction: row.allowLiabilityDeduction,
    assetRules: new Map(
      row.assetRules.map((rule) => [
        rule.assetType,
        {
          assetType: rule.assetType,
          zakatable: rule.zakatable,
          defaultZakatablePercentage: rule.defaultZakatablePercentage.toString(),
          rationale: rule.rationale,
        },
      ]),
    ),
    liabilityRules: new Map(
      row.liabilityRules.map((rule) => [
        rule.liabilityType,
        {
          liabilityType: rule.liabilityType,
          deductibleByDefault: rule.deductibleByDefault,
          maxMonthsAhead: rule.maxMonthsAhead,
          rationale: rule.rationale,
        },
      ]),
    ),
  }
}

/** The ruleset new calculations should use. */
export async function loadActiveRuleSet(): Promise<RuleSetSnapshot> {
  const row = await findActive()
  if (!row) {
    throw new RuleSetNotFoundError(
      'Er is geen actieve Zakat-regelset. Draai `npm run db:seed` of activeer er één.',
    )
  }
  return toSnapshot(row)
}

/**
 * A specific ruleset by id — used when reopening a finalised calculation, which
 * must be shown with the rules that were in force then, not the current ones.
 */
export async function loadRuleSetById(id: string): Promise<RuleSetSnapshot> {
  const row = await prisma.zakatRuleSet.findUnique({ where: { id }, include: INCLUDE_RULES })
  if (!row) throw new RuleSetNotFoundError()
  return toSnapshot(row)
}

export async function loadRuleSetByVersion(version: string): Promise<RuleSetSnapshot> {
  const row = await prisma.zakatRuleSet.findUnique({
    where: { version },
    include: INCLUDE_RULES,
  })
  if (!row) throw new RuleSetNotFoundError()
  return toSnapshot(row)
}
