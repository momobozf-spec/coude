import { NextResponse, type NextRequest } from 'next/server';

import { resolveLocale } from '@/i18n/config';
import { sha256Hex } from '@/lib/evidence/hash';
import { buildInspectionReport, type PhotoWithBytes } from '@/lib/pdf/inspection-report';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Genereert het PDF-rapport en levert het meteen af.
 *
 * Het rapport wordt bij elke aanvraag opnieuw opgebouwd uit de databank en de
 * opgeslagen bestanden. Zo kan een rapport nooit iets tonen dat niet meer in het
 * dossier zit, en wordt de integriteit van elke foto op dat moment nagerekend.
 */
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

  const { data: inspection } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', inspectionId)
    .maybeSingle();

  if (!inspection) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const [{ data: property }, { data: rooms }, { data: photos }, { data: profile }] =
    await Promise.all([
      supabase
        .from('properties')
        .select('*')
        .eq('id', inspection.property_id)
        .maybeSingle(),
      supabase
        .from('inspection_rooms')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('position', { ascending: true }),
      supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('uploaded_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

  if (!property) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const withBytes: PhotoWithBytes[] = await Promise.all(
    (photos ?? []).map(async (photo) => {
      const { data } = await supabase.storage
        .from('inspection-photos')
        .download(photo.storage_path);

      if (!data) return { photo, bytes: null };
      return { photo, bytes: new Uint8Array(await data.arrayBuffer()) };
    }),
  );

  const pdfBytes = await buildInspectionReport({
    locale,
    inspection,
    property,
    rooms: rooms ?? [],
    photos: withBytes,
    tenantName: profile?.full_name ?? profile?.email ?? '',
  });

  // Het rapport bewaren zodat de verhuurder-link naar dezelfde versie kan
  // verwijzen, en zodat het dossier ook zonder hergeneratie beschikbaar blijft.
  const reportPath = `${user.id}/${inspectionId}/${
    inspection.type === 'CHECK_IN' ? 'check-in' : 'check-out'
  }-${locale}.pdf`;

  await supabase.storage.from('reports').upload(reportPath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });

  await supabase
    .from('inspections')
    .update({
      pdf_path: reportPath,
      pdf_generated_at: new Date().toISOString(),
    })
    .eq('id', inspectionId);

  await supabase.from('audit_log').insert({
    user_id: user.id,
    action: 'DOCUMENT_DOWNLOAD',
    resource_type: 'inspection_report',
    resource_id: inspectionId,
    metadata: { locale, pdf_sha256: sha256Hex(pdfBytes) },
  });

  const fileName = `${
    inspection.type === 'CHECK_IN' ? 'plaatsbeschrijving-intrek' : 'plaatsbeschrijving-vertrek'
  }-${property.postal_code}-${locale}.pdf`;

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
