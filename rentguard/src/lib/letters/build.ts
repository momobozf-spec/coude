import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { isFeatureEnabled } from '@/lib/features';
import { DISCLAIMER } from '@/lib/legal/disclaimer';
import { assertNoForbiddenTerms, findForbiddenTerms } from '@/lib/legal/forbidden-terms';
import {
  blockingRulesForLetter,
  buildRuleSnapshot,
  needsVerification,
  type RuleSnapshotEntry,
} from '@/lib/legal/rules';
import { renderTemplate, type MergeFields } from '@/lib/letters/render';
import type {
  Database,
  LetterTemplate,
  NoticeType,
} from '@/lib/supabase/types';

/**
 * Bouwt een brief uit een versioneerde template.
 *
 * Drie sloten, in deze volgorde:
 *
 *  1. **Regels.** Een brief die steunt op een `UNVERIFIED`-regel, of op een
 *     regel die zichzelf ongeschikt verklaart voor brieven, wordt niet
 *     opgesteld. Zo kan de EPB-indexatieregel geen ingebrekestelling dragen.
 *  2. **Velden.** Een ontbrekend veld blokkeert; een brief met een zichtbare
 *     `{{iban}}` erin is erger dan geen brief.
 *  3. **Formulering.** De gerenderde tekst gaat door de verboden-termenlijst.
 *     Een gebruiker kan via een vrij veld geen claim als "gegarandeerd" in een
 *     brief krijgen.
 */

type Client = SupabaseClient<Database>;

export const TEMPLATE_KEY_BY_TYPE: Record<NoticeType, string> = {
  DEPOSIT_CLAIM: 'deposit_claim',
  INDEXATION_DISPUTE: 'indexation_dispute',
  DEFECT_NOTICE: 'defect_notice',
  RENT_GRID_DISCUSSION: 'rent_grid_discussion',
};

export type LetterBlockReason =
  | { kind: 'FEATURE_DISABLED' }
  | { kind: 'TEMPLATE_NOT_FOUND' }
  | { kind: 'RULES_NOT_VERIFIED'; ruleKeys: string[] }
  | { kind: 'MISSING_FIELDS'; fields: string[] }
  | { kind: 'FORBIDDEN_TERM'; matches: string[] };

export interface BuiltLetter {
  template: LetterTemplate;
  title: string;
  body: string;
  mergeFields: MergeFields;
  ruleSnapshot: Record<string, RuleSnapshotEntry>;
  needsVerification: boolean;
  /** Leeg wanneer de brief opgesteld en goedgekeurd mag worden. */
  blockers: LetterBlockReason[];
}

export async function loadActiveTemplate(
  supabase: Client,
  type: NoticeType,
  locale: Locale,
): Promise<LetterTemplate | null> {
  const { data } = await supabase
    .from('letter_templates')
    .select('*')
    .eq('template_key', TEMPLATE_KEY_BY_TYPE[type])
    .eq('language', locale)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1);

  return data?.[0] ?? null;
}

export async function buildLetter({
  supabase,
  type,
  locale,
  fields,
}: {
  supabase: Client;
  type: NoticeType;
  locale: Locale;
  fields: MergeFields;
}): Promise<BuiltLetter | { blockers: LetterBlockReason[] }> {
  // Feature-flag: brieven (ingebrekestelling waarborg e.a.) blijven uit tot
  // een jurist de templates heeft nagekeken. Zie README §Juridische review.
  if (!isFeatureEnabled('depositLetters')) {
    return { blockers: [{ kind: 'FEATURE_DISABLED' }] };
  }

  const template = await loadActiveTemplate(supabase, type, locale);
  if (!template) return { blockers: [{ kind: 'TEMPLATE_NOT_FOUND' }] };

  const blockers: LetterBlockReason[] = [];

  // 1. Regels
  const requiredKeys = template.required_rule_keys ?? [];
  const { data: rules } = await supabase
    .from('legal_rules')
    .select('*')
    .in('rule_key', requiredKeys.length > 0 ? requiredKeys : ['__none__']);

  const ruleSnapshot = buildRuleSnapshot(rules ?? []);
  const blocking = blockingRulesForLetter(ruleSnapshot);

  const missingRules = requiredKeys.filter((key) => !(key in ruleSnapshot));
  if (blocking.length > 0 || missingRules.length > 0) {
    blockers.push({
      kind: 'RULES_NOT_VERIFIED',
      ruleKeys: [...blocking.map((rule) => rule.rule_key), ...missingRules],
    });
  }

  // 2. Velden
  const allFields: MergeFields = {
    ...fields,
    disclaimer: DISCLAIMER[locale],
  };

  const rendered = renderTemplate(template.body, allFields);
  if (rendered.missingFields.length > 0) {
    blockers.push({ kind: 'MISSING_FIELDS', fields: rendered.missingFields });
  }

  // 3. Formulering
  const hits = findForbiddenTerms(rendered.text);
  if (hits.length > 0) {
    blockers.push({
      kind: 'FORBIDDEN_TERM',
      matches: hits.map((hit) => hit.match),
    });
  }

  return {
    template,
    title: template.title,
    body: rendered.text,
    mergeFields: allFields,
    ruleSnapshot,
    needsVerification: needsVerification(ruleSnapshot),
    blockers,
  };
}

/**
 * Controleert vrije tekst die de gebruiker zelf invoert vóór ze in een brief
 * belandt. Werpt bij een overtreding.
 */
export function assertUserTextIsAcceptable(
  value: string | null | undefined,
  label: string,
): void {
  if (!value) return;
  assertNoForbiddenTerms(value, label);
}
