import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Korte geldigheidsduur: deze links mogen niet blijven rondslingeren. */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: photo } = await supabase
    .from('inspection_photos')
    .select('storage_path')
    .eq('id', photoId)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from('inspection-photos')
    .createSignedUrl(photo.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    return NextResponse.json({ error: 'SIGN_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    url: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: photo } = await supabase
    .from('inspection_photos')
    .select('id, storage_path, inspection_id')
    .eq('id', photoId)
    .maybeSingle();

  if (!photo) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const { data: inspection } = await supabase
    .from('inspections')
    .select('status')
    .eq('id', photo.inspection_id)
    .maybeSingle();

  if (inspection?.status !== 'DRAFT') {
    return NextResponse.json({ error: 'INSPECTION_CLOSED' }, { status: 409 });
  }

  const { error } = await supabase
    .from('inspection_photos')
    .delete()
    .eq('id', photoId);

  if (error) {
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }

  // Pas het bestand verwijderen nadat de rij weg is: andersom zou een fout een
  // rij achterlaten die naar een onbestaand bestand wijst.
  await supabase.storage.from('inspection-photos').remove([photo.storage_path]);

  return NextResponse.json({ ok: true });
}
