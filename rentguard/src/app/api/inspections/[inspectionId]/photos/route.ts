import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  MAX_PHOTO_BYTES,
  photoUploadSchema,
  processPhoto,
  validateFile,
} from '@/lib/inspections/upload';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Upload van één foto.
 *
 * De bewijswaarde hangt aan wat hier gebeurt: de hash wordt over de ontvangen
 * bytes berekend en het tijdstempel komt van de databank (`uploaded_at` staat
 * op `now()`), niet van de client. Een client die een ander tijdstip meestuurt,
 * verandert daar niets aan.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> },
) {
  const { inspectionId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 });
  }

  // RLS beperkt dit tot eigen dossiers; een vreemd id geeft geen rij.
  const { data: inspection } = await supabase
    .from('inspections')
    .select('id, status')
    .eq('id', inspectionId)
    .maybeSingle();

  if (!inspection) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  if (inspection.status !== 'DRAFT') {
    // Een afgerond dossier mag niet meer wijzigen: dat zou de betekenis van het
    // reeds gegenereerde rapport ondergraven.
    return NextResponse.json({ error: 'INSPECTION_CLOSED' }, { status: 409 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const parsedFields = photoUploadSchema.safeParse({
    roomKey: formData.get('roomKey')?.toString(),
    label: formData.get('label')?.toString(),
    note: formData.get('note')?.toString() ?? '',
  });

  if (!parsedFields.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const file = formData.get('file');
  const rejection = validateFile(file instanceof File ? file : null);
  if (rejection) {
    return NextResponse.json(
      { error: rejection.kind, maxBytes: MAX_PHOTO_BYTES },
      { status: 400 },
    );
  }

  const processed = await processPhoto(file as File, user.id, inspectionId);

  const { data: room } = await supabase
    .from('inspection_rooms')
    .select('id, display_name')
    .eq('inspection_id', inspectionId)
    .eq('room_key', parsedFields.data.roomKey)
    .maybeSingle();

  const { error: uploadError } = await supabase.storage
    .from('inspection-photos')
    .upload(processed.storagePath, processed.bytes, {
      contentType: processed.contentType,
      // Dezelfde bytes leveren hetzelfde pad; overschrijven met identieke
      // inhoud is onschadelijk en voorkomt een fout bij een dubbele upload.
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 });
  }

  const { data: photo, error: insertError } = await supabase
    .from('inspection_photos')
    .insert({
      inspection_id: inspectionId,
      room_id: room?.id ?? null,
      room: parsedFields.data.roomKey,
      label: parsedFields.data.label,
      storage_path: processed.storagePath,
      sha256: processed.sha256,
      byte_size: processed.byteSize,
      content_type: processed.contentType,
      exif: processed.exif,
      captured_at: processed.capturedAt?.toISOString() ?? null,
      note: parsedFields.data.note ?? null,
    })
    .select('id, sha256, uploaded_at, captured_at, label, room, note')
    .single();

  if (insertError || !photo) {
    // De opslag is al gebeurd; de rij niet. Zonder rij is het bestand
    // onbereikbaar en dus zinloos, dus ruimen wij het op.
    await supabase.storage
      .from('inspection-photos')
      .remove([processed.storagePath]);
    return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 });
  }

  const { data: signed } = await supabase.storage
    .from('inspection-photos')
    .createSignedUrl(processed.storagePath, 60 * 10);

  return NextResponse.json(
    { photo, previewUrl: signed?.signedUrl ?? null },
    { status: 201 },
  );
}
