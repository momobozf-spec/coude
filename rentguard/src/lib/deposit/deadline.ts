import {
  MS_PER_DAY,
  addMonthsUtc,
  commencedMonthsBetween,
  daysBetween,
  startOfUtcDay,
} from '@/lib/date';
import type { LegalRule } from '@/lib/supabase/types';
import {
  type RuleSnapshotEntry,
  appliesToContract,
  buildRuleSnapshot,
  effectiveStatus,
  needsVerification,
  ruleNumber,
} from '@/lib/legal/rules';

/**
 * Termijnbewaking voor de vrijgave van de huurwaarborg.
 *
 * De termijn zelf staat NIET in deze code: hij komt uit de regel
 * `bxl.deposit.restitution_deadline_months`. Verandert de wet, dan verandert de
 * regel — niet dit bestand.
 */

export const DEADLINE_RULE_KEY = 'bxl.deposit.restitution_deadline_months';
export const PENALTY_RULE_KEY = 'bxl.deposit.late_penalty_pct_per_month';

export interface DepositDeadlineInput {
  keysReturnedOn: Date;
  /** Datum waarop het huurcontract gesloten werd, voor de werking in de tijd. */
  leaseSignedOn: Date | null;
  depositAmount: number;
  amountRefunded: number;
  now?: Date;
}

export interface DepositDeadlineResult {
  deadlineDate: Date;
  daysRemaining: number;
  isOverdue: boolean;
  monthsOverdue: number;
  outstandingAmount: number;
  /**
   * Vergoeding wegens laattijdigheid, ALS de regel geldt en van rechtswege
   * loopt. Dat laatste is nog niet bevestigd; zie docs/juridisch.md §1.
   * Daarom apart van `outstandingAmount` gehouden.
   */
  latePenaltyAmount: number | null;
  latePenaltyIsProvisional: boolean;
  ruleSnapshot: Record<string, RuleSnapshotEntry>;
  needsVerification: boolean;
  /** Waarschuwingen die de UI woordelijk moet tonen. */
  warnings: DeadlineWarning[];
}

export type DeadlineWarning =
  | { kind: 'RULE_NOT_APPLICABLE_TO_CONTRACT'; ruleKey: string }
  | { kind: 'RULE_STALE'; ruleKey: string; verifiedAt: string }
  | { kind: 'RULE_UNVERIFIED'; ruleKey: string }
  | { kind: 'LEASE_DATE_UNKNOWN' };

export class MissingLegalRuleError extends Error {
  constructor(ruleKey: string) {
    super(
      `Regel ${ruleKey} ontbreekt in legal_rules. De termijn wordt niet ` +
        'berekend; er wordt geen aanname gedaan over de wettelijke termijn.',
    );
    this.name = 'MissingLegalRuleError';
  }
}

export function calculateDepositDeadline(
  input: DepositDeadlineInput,
  rules: LegalRule[],
): DepositDeadlineResult {
  const now = input.now ?? new Date();
  const warnings: DeadlineWarning[] = [];

  const deadlineRule = rules.find((r) => r.rule_key === DEADLINE_RULE_KEY);
  if (!deadlineRule) throw new MissingLegalRuleError(DEADLINE_RULE_KEY);

  const penaltyRule = rules.find((r) => r.rule_key === PENALTY_RULE_KEY) ?? null;

  const months = ruleNumber(deadlineRule, 'months');

  // Werking in de tijd: de regels van 2024 gelden niet zonder meer op een
  // contract uit 2019.
  if (!input.leaseSignedOn) {
    warnings.push({ kind: 'LEASE_DATE_UNKNOWN' });
  } else if (!appliesToContract(deadlineRule, input.leaseSignedOn)) {
    warnings.push({
      kind: 'RULE_NOT_APPLICABLE_TO_CONTRACT',
      ruleKey: DEADLINE_RULE_KEY,
    });
  }

  for (const rule of [deadlineRule, penaltyRule].filter(Boolean) as LegalRule[]) {
    const status = effectiveStatus(rule, now);
    if (status === 'STALE') {
      warnings.push({
        kind: 'RULE_STALE',
        ruleKey: rule.rule_key,
        verifiedAt: rule.verified_at,
      });
    } else if (status === 'UNVERIFIED') {
      warnings.push({ kind: 'RULE_UNVERIFIED', ruleKey: rule.rule_key });
    }
  }

  const deadlineDate = addMonthsUtc(startOfUtcDay(input.keysReturnedOn), months);
  const today = startOfUtcDay(now);

  const daysRemaining = daysBetween(today, deadlineDate);
  const isOverdue = daysRemaining < 0;

  const monthsOverdue = isOverdue ? commencedMonthsBetween(deadlineDate, today) : 0;

  const outstandingAmount = Math.max(
    0,
    round2(input.depositAmount - input.amountRefunded),
  );

  let latePenaltyAmount: number | null = null;
  if (penaltyRule && isOverdue && monthsOverdue > 0) {
    const pct = ruleNumber(penaltyRule, 'pct_per_month');
    latePenaltyAmount = round2((input.depositAmount * pct * monthsOverdue) / 100);
  }

  const usedRules = [deadlineRule, penaltyRule].filter(Boolean) as LegalRule[];
  const ruleSnapshot = buildRuleSnapshot(usedRules, now);

  return {
    deadlineDate,
    daysRemaining,
    isOverdue,
    monthsOverdue,
    outstandingAmount,
    latePenaltyAmount,
    // De boete wordt altijd als aanspraak onder voorbehoud gepresenteerd zolang
    // niet bevestigd is dat ze van rechtswege loopt.
    latePenaltyIsProvisional:
      penaltyRule?.parameters?.claimable_without_confirmation !== true,
    ruleSnapshot,
    needsVerification: needsVerification(ruleSnapshot),
    warnings,
  };
}

/**
 * Momenten waarop de gebruiker een herinnering krijgt. Relatief aan de
 * deadline, zodat een wetswijziging de herinneringen meeneemt.
 */
export const REMINDER_OFFSETS_DAYS = [-30, -7, 0, 14] as const;

export interface PlannedReminder {
  kind: string;
  remindAt: Date;
}

export function planReminders(deadline: Date): PlannedReminder[] {
  return REMINDER_OFFSETS_DAYS.map((offset) => ({
    kind:
      offset < 0
        ? `BEFORE_${Math.abs(offset)}D`
        : offset === 0
          ? 'ON_DEADLINE'
          : `AFTER_${offset}D`,
    remindAt: new Date(deadline.getTime() + offset * MS_PER_DAY),
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
