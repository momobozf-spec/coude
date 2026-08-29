import { NextResponse, type NextRequest } from 'next/server';

import { resolveLocale } from '@/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkFeature } from '@/lib/billing/entitlements';
import { monthsOccupied, pairPhotos } from '@/lib/comparison/pairing';
import { getVisionAnalyzer } from '@/lib/vision';
import { roomDisplayName, slotDisplayName } from '@/lib/comparison/labels';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Bouwt de fotoparen en laat er zoveel mogelijk analyseren.
 *
 * In stukken, niet in één keer: bij veertig fotoparen zou één verzoek de
 * tijdslimiet halen. De client roept opnieuw aan zolang `remaining` groter is
 * dan nul, en toont ondertussen voortgang.
 */
const BATCH_SIZE = 6;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> },
) {
  const { inspectionId } = await params;
  const locale = resolveLocale(request.nextUrl.searchParams.get('locale'));

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  const { data: checkOut } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', inspectionId)
    .maybeSingle();

  if (!checkOut || checkOut.type !== 'CHECK_OUT') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const entitlement = await checkFeature(
    supabase,
    user.id,
    'CHECK_OUT_ANALYSIS',
    checkOut.property_id,
  );
  if (!entitlement.allowed) {
    return NextResponse.json(
      { error: 'NOT_ENTITLED', suggestedPlan: entitlement.suggestedPlan },
      { status: 402 },
    );
  }

  const { data: checkIn } = await supabase
    .from('inspections')
    .select('*')
    .eq('property_id', checkOut.property_id)
    .eq('type', 'CHECK_IN')
    .maybeSingle();

  if (!checkIn) {
    return NextResponse.json({ error: 'NO_CHECK_IN' }, { status: 409 });
  }

  const [{ data: property }, { data: checkInPhotos }, { data: checkOutPhotos }] =
    await Promise.all([
      supabase
        .from('properties')
        .select('lease_start')
        .eq('id', checkOut.property_id)
        .maybeSingle(),
      supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', checkIn.id),
      supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', checkOut.id),
    ]);

  const pairing = pairPhotos(checkInPhotos ?? [], checkOutPhotos ?? []);

  // Ontbrekende rijen aanmaken. Bestaande rijen blijven ongemoeid: een reeds
  // door de gebruiker beoordeeld paar mag nooit overschreven worden.
  if (pairing.pairs.length > 0) {
    await supabase.from('photo_comparisons').upsert(
      pairing.pairs.map((pair) => ({
        checkin_photo_id: pair.checkIn.id,
        checkout_photo_id: pair.checkOut.id,
      })),
      { onConflict: 'checkin_photo_id,checkout_photo_id', ignoreDuplicates: true },
    );
  }

  const analyzer = getVisionAnalyzer();
  if (!analyzer) {
    return NextResponse.json({
      pairs: pairing.pairs.length,
      analyzed: 0,
      remaining: 0,
      visionAvailable: false,
      unmatchedCheckIn: pairing.unmatchedCheckIn.length,
      unmatchedCheckOut: pairing.unmatchedCheckOut.length,
    });
  }

  const pairIds = pairing.pairs.map((pair) => pair.checkOut.id);
  const { data: existing } = await supabase
    .from('photo_comparisons')
    .select('id, checkin_photo_id, checkout_photo_id, ai_analyzed_at, user_reviewed_at')
    .in('checkout_photo_id', pairIds.length > 0 ? pairIds : ['00000000-0000-0000-0000-000000000000']);

  const pending = (existing ?? []).filter(
    (row) => row.ai_analyzed_at === null && row.user_reviewed_at === null,
  );

  const { data: costItems } = await supabase
    .from('vetuste_reference')
    .select('item_key');
  const allowedRepairItemKeys = (costItems ?? []).map((item) => item.item_key);

  const months = monthsOccupied(
    property?.lease_start ?? null,
    checkOut.inspection_date,
  );

  const batch = pending.slice(0, BATCH_SIZE);
  let analyzed = 0;

  for (const row of batch) {
    const pair = pairing.pairs.find(
      (candidate) =>
        candidate.checkIn.id === row.checkin_photo_id &&
        candidate.checkOut.id === row.checkout_photo_id,
    );
    if (!pair) continue;

    const [checkInFile, checkOutFile] = await Promise.all([
      supabase.storage
        .from('inspection-photos')
        .download(pair.checkIn.storage_path),
      supabase.storage
        .from('inspection-photos')
        .download(pair.checkOut.storage_path),
    ]);

    if (!checkInFile.data || !checkOutFile.data) continue;

    try {
      const result = await analyzer.comparePhotos({
        locale,
        monthsOccupied: months,
        allowedRepairItemKeys,
        checkIn: {
          bytes: new Uint8Array(await checkInFile.data.arrayBuffer()),
          contentType: pair.checkIn.content_type,
          roomLabel: roomDisplayName(pair.room, locale),
          slotLabel: slotDisplayName(pair.label, locale),
        },
        checkOut: {
          bytes: new Uint8Array(await checkOutFile.data.arrayBuffer()),
          contentType: pair.checkOut.content_type,
          roomLabel: roomDisplayName(pair.room, locale),
          slotLabel: slotDisplayName(pair.label, locale),
        },
      });

      await supabase
        .from('photo_comparisons')
        .update({
          ai_classification: result.classification,
          ai_confidence: result.confidence,
          ai_notes: result.reasoning,
          ai_observed_differences: result.observedDifferences,
          ai_forced_unclear: result.forcedUnclear,
          ai_refused: result.refused,
          ai_suggested_item_keys: result.suggestedRepairItemKeys,
          ai_provider: result.provider,
          ai_model: result.model,
          ai_analyzed_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (result.usage) {
        await supabase.from('vision_usage').insert({
          user_id: user.id,
          comparison_id: row.id,
          provider: result.provider,
          model: result.model,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
        });
      }

      analyzed += 1;
    } catch {
      // Eén mislukt paar mag de rest niet blokkeren. De rij blijft
      // ongeanalyseerd en de gebruiker beoordeelt hem zelf.
      continue;
    }
  }

  return NextResponse.json({
    pairs: pairing.pairs.length,
    analyzed,
    remaining: Math.max(0, pending.length - batch.length),
    visionAvailable: true,
    unmatchedCheckIn: pairing.unmatchedCheckIn.length,
    unmatchedCheckOut: pairing.unmatchedCheckOut.length,
  });
}
