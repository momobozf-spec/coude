import { NextResponse, type NextRequest } from 'next/server';

import { resolveLocale } from '@/i18n/config';
import { sha256Hex } from '@/lib/evidence/hash';
import { monthsOccupied, pairPhotos } from '@/lib/comparison/pairing';
import { roomDisplayName, slotDisplayName } from '@/lib/comparison/labels';
import {
  buildComparisonReport,
  type ComparisonEntry,
} from '@/lib/pdf/comparison-report';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { checkFeature } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function GET(
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
    return NextResponse.json({ error: 'NOT_ENTITLED' }, { status: 402 });
  }

  const [{ data: property }, { data: checkIn }, { data: profile }] =
    await Promise.all([
      supabase
        .from('properties')
        .select('*')
        .eq('id', checkOut.property_id)
        .maybeSingle(),
      supabase
        .from('inspections')
        .select('*')
        .eq('property_id', checkOut.property_id)
        .eq('type', 'CHECK_IN')
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

  if (!property || !checkIn) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const [{ data: checkInPhotos }, { data: checkOutPhotos }, { data: vetuste }] =
    await Promise.all([
      supabase.from('inspection_photos').select('*').eq('inspection_id', checkIn.id),
      supabase.from('inspection_photos').select('*').eq('inspection_id', checkOut.id),
      supabase
        .from('vetuste_reference')
        .select('item_key, label_nl, label_fr'),
    ]);

  const pairing = pairPhotos(checkInPhotos ?? [], checkOutPhotos ?? []);
  const checkOutIds = pairing.pairs.map((pair) => pair.checkOut.id);

  const { data: comparisons } = await supabase
    .from('photo_comparisons')
    .select('*')
    .in(
      'checkout_photo_id',
      checkOutIds.length > 0 ? checkOutIds : ['00000000-0000-0000-0000-000000000000'],
    );

  async function download(path: string): Promise<Uint8Array | null> {
    const { data } = await supabase.storage
      .from('inspection-photos')
      .download(path);
    if (!data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  const vetusteLabels = new Map(
    (vetuste ?? []).map((item) => [
      item.item_key,
      locale === 'nl' ? item.label_nl : item.label_fr,
    ]),
  );

  const entries: ComparisonEntry[] = [];
  for (const pair of pairing.pairs) {
    const comparison = comparisons?.find(
      (row) =>
        row.checkin_photo_id === pair.checkIn.id &&
        row.checkout_photo_id === pair.checkOut.id,
    );
    if (!comparison) continue;

    entries.push({
      comparison,
      roomLabel: roomDisplayName(pair.room, locale),
      slotLabel: slotDisplayName(pair.label, locale),
      checkInPhoto: pair.checkIn,
      checkOutPhoto: pair.checkOut,
      checkInBytes: await download(pair.checkIn.storage_path),
      checkOutBytes: await download(pair.checkOut.storage_path),
      vetusteLabel: comparison.vetuste_item_key
        ? (vetusteLabels.get(comparison.vetuste_item_key) ?? null)
        : null,
    });
  }

  const unmatched = [
    ...pairing.unmatchedCheckIn.map((photo) => ({
      roomLabel: roomDisplayName(photo.room, locale),
      slotLabel: slotDisplayName(photo.label, locale),
      side: 'CHECK_IN' as const,
    })),
    ...pairing.unmatchedCheckOut.map((photo) => ({
      roomLabel: roomDisplayName(photo.room, locale),
      slotLabel: slotDisplayName(photo.label, locale),
      side: 'CHECK_OUT' as const,
    })),
  ];

  const pdfBytes = await buildComparisonReport({
    locale,
    property,
    checkIn,
    checkOut,
    entries,
    unmatched,
    monthsOccupied: monthsOccupied(
      property.lease_start,
      checkOut.inspection_date,
    ),
    tenantName: profile?.full_name ?? profile?.email ?? '',
  });

  await supabase.from('audit_log').insert({
    user_id: user.id,
    action: 'DOCUMENT_DOWNLOAD',
    resource_type: 'comparison_report',
    resource_id: inspectionId,
    metadata: { locale, pdf_sha256: sha256Hex(pdfBytes) },
  });

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vergelijkend-rapport-${property.postal_code}-${locale}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
