'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { resolveLocale } from '@/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  InvalidVetusteInputError,
  calculateVetuste,
  type VetusteExclusion,
} from '@/lib/vetuste/calculate';

export type ComparisonErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'NO_COST_BASIS'
  | 'SAVE_FAILED';

export interface ComparisonState {
  error: ComparisonErrorCode | null;
  savedId?: string;
}

const verdictSchema = z.object({
  comparisonId: z.string().uuid(),
  inspectionId: z.string().uuid(),
  verdict: z.enum(['WEAR_AND_TEAR', 'DAMAGE', 'UNCLEAR']),
  note: z.string().trim().max(2000),
});

/**
 * Legt het oordeel van de gebruiker vast.
 *
 * Dit oordeel is leidend in het rapport. De AI-analyse blijft bewaard en komt
 * in de bijlage terecht, ook wanneer de gebruiker haar tegenspreekt — juist dan
 * is zichtbaar dat er een menselijke beoordeling is gebeurd.
 */
export async function saveVerdictAction(
  _prev: ComparisonState,
  formData: FormData,
): Promise<ComparisonState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = verdictSchema.safeParse({
    comparisonId: formData.get('comparisonId')?.toString(),
    inspectionId: formData.get('inspectionId')?.toString(),
    verdict: formData.get('verdict')?.toString(),
    note: formData.get('note')?.toString() ?? '',
  });

  if (!parsed.success) return { error: 'INVALID_INPUT' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('photo_comparisons')
    .update({
      user_verdict: parsed.data.verdict,
      user_note: parsed.data.note === '' ? null : parsed.data.note,
      user_reviewed_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.comparisonId);

  if (error) return { error: 'SAVE_FAILED' };

  revalidatePath(`/${locale}/inspections/${parsed.data.inspectionId}/comparison`);
  return { error: null, savedId: parsed.data.comparisonId };
}

const amountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, '').replace(',', '.'))
  .refine((value) => value === '' || /^\d+(\.\d{1,2})?$/.test(value), {
    message: 'INVALID_AMOUNT',
  });

const vetusteSchema = z.object({
  comparisonId: z.string().uuid(),
  inspectionId: z.string().uuid(),
  itemKey: z.string().trim().min(1),
  equipmentAgeYears: z.coerce.number().min(0).max(100),
  monthsOccupied: z.coerce.number().min(0).max(1200),
  repairCost: amountSchema,
  exclusion: z.string().trim().optional(),
});

/**
 * Berekent de verdeling van een herstelkost volgens de slijtagegrille.
 *
 * De kost komt van de gebruiker (uit een offerte) of uit de referentietabel.
 * Zonder kost wordt er niets berekend en niets getoond: een verdeling van een
 * onbekend bedrag is een verzonnen bedrag.
 */
export async function saveVetusteAction(
  _prev: ComparisonState,
  formData: FormData,
): Promise<ComparisonState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = vetusteSchema.safeParse({
    comparisonId: formData.get('comparisonId')?.toString(),
    inspectionId: formData.get('inspectionId')?.toString(),
    itemKey: formData.get('itemKey')?.toString(),
    equipmentAgeYears: formData.get('equipmentAgeYears')?.toString() || '0',
    monthsOccupied: formData.get('monthsOccupied')?.toString() || '0',
    repairCost: formData.get('repairCost')?.toString() ?? '',
    exclusion: formData.get('exclusion')?.toString() ?? '',
  });

  if (!parsed.success) return { error: 'INVALID_INPUT' };
  if (parsed.data.repairCost === '') return { error: 'NO_COST_BASIS' };

  const supabase = await createSupabaseServerClient();

  const { data: item } = await supabase
    .from('vetuste_reference')
    .select('item_key, lifetime_years, abattement_pct')
    .eq('item_key', parsed.data.itemKey)
    .maybeSingle();

  if (!item) return { error: 'NOT_FOUND' };

  const repairCostCents = Math.round(
    Number.parseFloat(parsed.data.repairCost) * 100,
  );

  try {
    const result = calculateVetuste({
      lifetimeYears: Number(item.lifetime_years),
      abattementPct: Number(item.abattement_pct),
      equipmentAgeAtEntryYears: parsed.data.equipmentAgeYears,
      tenantOccupancyYears: parsed.data.monthsOccupied / 12,
      repairCostCents,
      exclusion:
        parsed.data.exclusion && parsed.data.exclusion !== ''
          ? (parsed.data.exclusion as VetusteExclusion)
          : null,
    });

    const { error } = await supabase
      .from('photo_comparisons')
      .update({
        vetuste_item_key: item.item_key,
        equipment_age_at_entry_years: parsed.data.equipmentAgeYears,
        repair_cost_cents: repairCostCents,
        repair_cost_source: 'QUOTE',
        vetuste_exclusion: result.exclusion,
        vetuste_abattement_pct: result.abattementPct,
        tenant_share_cents: result.tenantShareCents,
        landlord_share_cents: result.landlordShareCents,
        vetuste_calculated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.comparisonId);

    if (error) return { error: 'SAVE_FAILED' };
  } catch (error) {
    if (error instanceof InvalidVetusteInputError) {
      return { error: 'INVALID_INPUT' };
    }
    return { error: 'SAVE_FAILED' };
  }

  revalidatePath(`/${locale}/inspections/${parsed.data.inspectionId}/comparison`);
  return { error: null, savedId: parsed.data.comparisonId };
}
