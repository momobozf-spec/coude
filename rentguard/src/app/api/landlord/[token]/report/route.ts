import { NextResponse, type NextRequest } from 'next/server';

import { resolveLocale } from '@/i18n/config';
import {
  logLandlordAccess,
  resolveLandlordToken,
} from '@/lib/inspections/landlord-token';
import { buildInspectionReport, type PhotoWithBytes } from '@/lib/pdf/inspection-report';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Het rapport zoals de verhuurder het te zien krijgt.
 *
 * Loopt via de service role, met het token als enige autorisatie. Elke
 * raadpleging wordt gelogd: als er later discussie is over wat de verhuurder
 * gezien heeft, staat vast wanneer hij het dossier heeft opgevraagd.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const locale = resolveLocale(request.nextUrl.searchParams.get('locale'));

  const resolved = await resolveLandlordToken(token);
  if (resolved === 'NOT_FOUND') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  if (resolved === 'EXPIRED') {
    return NextResponse.json({ error: 'EXPIRED' }, { status: 410 });
  }

  const admin = createSupabaseAdminClient();
  const { inspection, property, tenantName } = resolved;

  const [{ data: rooms }, { data: photos }] = await Promise.all([
    admin
      .from('inspection_rooms')
      .select('*')
      .eq('inspection_id', inspection.id)
      .order('position', { ascending: true }),
    admin
      .from('inspection_photos')
      .select('*')
      .eq('inspection_id', inspection.id)
      .order('uploaded_at', { ascending: true }),
  ]);

  const withBytes: PhotoWithBytes[] = await Promise.all(
    (photos ?? []).map(async (photo) => {
      const { data } = await admin.storage
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
    tenantName,
  });

  await logLandlordAccess(
    inspection.id,
    'LANDLORD_REPORT_VIEW',
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    request.headers.get('user-agent'),
  );

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="rentguard-rapport.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
