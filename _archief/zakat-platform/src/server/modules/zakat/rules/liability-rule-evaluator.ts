import type { LiabilityInput, RuleSetSnapshot } from '@/server/modules/zakat/types'

/**
 * Decides whether an obligation may be deducted (§5, §10).
 *
 * A liability is never deductible merely because it exists. The ruleset decides
 * per category, a `maxMonthsAhead` window decides whether a dated obligation
 * falls inside the year, and the user may override — but every one of those
 * paths reports its reason, which the UI shows next to the line.
 */

export interface LiabilityRuleDecision {
  deductible: boolean
  reason: string
  ruleBasis: string
}

export function evaluateLiability(
  liability: LiabilityInput,
  ruleSet: RuleSetSnapshot,
  calculationDate: Date,
  deductLiabilities: boolean,
): LiabilityRuleDecision {
  // The profile-level switch turns deduction off entirely.
  if (!deductLiabilities) {
    return {
      deductible: false,
      reason: 'Je hebt in je Zakat-profiel ingesteld dat schulden niet worden afgetrokken.',
      ruleBasis: 'Profielinstelling',
    }
  }

  if (!ruleSet.allowLiabilityDeduction) {
    return {
      deductible: false,
      reason: `De regelset ${ruleSet.version} trekt geen verplichtingen af.`,
      ruleBasis: `${ruleSet.version} — geen aftrek`,
    }
  }

  const rule = ruleSet.liabilityRules.get(liability.type)

  if (!rule) {
    return {
      deductible: false,
      reason: `De regelset ${ruleSet.version} bevat geen regel voor deze categorie, dus deze verplichting wordt niet afgetrokken.`,
      ruleBasis: `${ruleSet.version} — geen regel`,
    }
  }

  // An explicit user choice wins, in both directions.
  if (liability.deductibleForZakat !== null) {
    return {
      deductible: liability.deductibleForZakat,
      reason: liability.deductibleForZakat
        ? 'Je hebt deze verplichting zelf als aftrekbaar gemarkeerd.'
        : 'Je hebt deze verplichting zelf uitgesloten van aftrek.',
      ruleBasis: 'Eigen aanpassing',
    }
  }

  if (!rule.deductibleByDefault) {
    return {
      deductible: false,
      reason:
        rule.rationale ??
        'Deze categorie is volgens de gekozen regelset niet automatisch aftrekbaar.',
      ruleBasis: `${ruleSet.version} — ${liability.type}`,
    }
  }

  // A dated obligation outside the window is a long-term debt, and deducting the
  // whole of it in one year is precisely what the window exists to prevent.
  if (rule.maxMonthsAhead !== null && liability.dueDate) {
    const cutoff = addMonths(calculationDate, rule.maxMonthsAhead)
    if (liability.dueDate.getTime() > cutoff.getTime()) {
      return {
        deductible: false,
        reason:
          `Deze verplichting vervalt pas na ${rule.maxMonthsAhead} maanden en valt daarmee ` +
          'buiten het venster voor aftrekbare korte termijn schulden.',
        ruleBasis: `${ruleSet.version} — ${liability.type} (max ${rule.maxMonthsAhead} maanden)`,
      }
    }
  }

  return {
    deductible: true,
    reason: rule.rationale ?? 'Aftrekbaar volgens de gekozen regelset.',
    ruleBasis: `${ruleSet.version} — ${liability.type}`,
  }
}

/**
 * Add whole months in UTC, clamping to the last day of the target month so that
 * 31 January + 1 month is 28/29 February rather than rolling into March.
 */
export function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + months
  const day = date.getUTCDate()

  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDayOfTarget),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  )
}
