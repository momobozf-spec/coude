import { addMonthsUtc, startOfUtcDay } from '@/lib/date';
import type { LegalRule, LegalRuleStatus } from '@/lib/supabase/types';

/**
 * Toegang tot `legal_rules`.
 *
 * Elke juridische regel in de applicatie komt hier vandaan. Er staan geen
 * termijnen, percentages of artikelnummers hardgecodeerd in de businesslogica.
 */

/** Een VERIFIED-regel wordt STALE zodra ze meer dan zes maanden oud is. */
export const STALE_AFTER_MONTHS = 6;

export function effectiveStatus(
  rule: Pick<LegalRule, 'status' | 'verified_at'>,
  now: Date = new Date(),
): LegalRuleStatus {
  if (rule.status !== 'VERIFIED') return rule.status;

  const verifiedAt = startOfUtcDay(new Date(rule.verified_at));
  const threshold = addMonthsUtc(now, -STALE_AFTER_MONTHS);

  return verifiedAt < threshold ? 'STALE' : 'VERIFIED';
}

/**
 * Geldt deze regel voor een contract dat op `date` gesloten werd?
 *
 * Veel Brusselse regels zijn pas van toepassing op contracten vanaf een
 * bepaalde datum. Zonder deze controle zouden wij de regels van 2024 op een
 * contract uit 2019 toepassen.
 */
export function appliesToContract(
  rule: Pick<LegalRule, 'applies_from' | 'applies_to'>,
  contractDate: Date | string | null,
): boolean {
  if (!rule.applies_from && !rule.applies_to) return true;
  if (!contractDate) return false;

  const date = typeof contractDate === 'string' ? new Date(contractDate) : contractDate;
  if (Number.isNaN(date.getTime())) return false;

  if (rule.applies_from && date < new Date(rule.applies_from)) return false;
  if (rule.applies_to && date > new Date(rule.applies_to)) return false;
  return true;
}

export interface RuleSnapshotEntry {
  rule_key: string;
  status: LegalRuleStatus;
  verified_at: string;
  source_name: string;
  source_url: string;
  source_is_official: boolean;
  parameters: Record<string, unknown>;
}

/**
 * Bevriest de gebruikte regels op het moment van een berekening of brief, zodat
 * het dossier reproduceerbaar blijft nadat de regels bijgewerkt zijn.
 */
export function buildRuleSnapshot(
  rules: LegalRule[],
  now: Date = new Date(),
): Record<string, RuleSnapshotEntry> {
  const snapshot: Record<string, RuleSnapshotEntry> = {};

  for (const rule of rules) {
    snapshot[rule.rule_key] = {
      rule_key: rule.rule_key,
      status: effectiveStatus(rule, now),
      verified_at: rule.verified_at,
      source_name: rule.source_name,
      source_url: rule.source_url,
      source_is_official: rule.source_is_official,
      parameters: rule.parameters,
    };
  }

  return snapshot;
}

/**
 * Een resultaat heeft verificatie nodig zodra één gebruikte regel niet
 * VERIFIED is. De UI toont dat expliciet.
 */
export function needsVerification(
  snapshot: Record<string, RuleSnapshotEntry>,
): boolean {
  return Object.values(snapshot).some((entry) => entry.status !== 'VERIFIED');
}

/**
 * Mag een brief op deze regels steunen?
 *
 * Een brief die een UNVERIFIED-regel als juridische grondslag aanhaalt, mag
 * niet verstuurd worden. Een regel kan dat expliciet aangeven met
 * `parameters.may_ground_a_letter = false`.
 */
export function blockingRulesForLetter(
  snapshot: Record<string, RuleSnapshotEntry>,
): RuleSnapshotEntry[] {
  return Object.values(snapshot).filter((entry) => {
    if (entry.parameters?.may_ground_a_letter === false) return true;
    return entry.status === 'UNVERIFIED';
  });
}

/** Leest een numerieke parameter uit een regel, met expliciete fout bij ontbreken. */
export function ruleNumber(
  rule: Pick<LegalRule, 'rule_key' | 'parameters'>,
  key: string,
): number {
  const value = rule.parameters?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Regel ${rule.rule_key} mist een numerieke parameter "${key}". ` +
        'De berekening wordt afgebroken in plaats van een aanname te doen.',
    );
  }
  return value;
}
