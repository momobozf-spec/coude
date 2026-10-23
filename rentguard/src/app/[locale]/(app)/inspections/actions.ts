'use server';

import { randomBytes, createHash } from 'node:crypto';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveLocale } from '@/i18n/config';
import { toIsoDate } from '@/lib/date';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';
import { ROOM_PRESETS, customRoomKey } from '@/lib/inspections/rooms';
import { checkFeature, grantFreeCheckIn } from '@/lib/billing/entitlements';

export type InspectionErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_AUTHENTICATED'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'NOT_ENTITLED'
  | 'NO_CHECK_IN'
  | 'NOT_COMPLETE'
  | 'NO_LANDLORD_EMAIL'
  | 'EMAIL_NOT_CONFIGURED'
  | 'SAVE_FAILED';

export interface InspectionState {
  error: InspectionErrorCode | null;
  suggestedPlan?: string | null;
  fieldErrors?: Record<string, string[]>;
}

const createSchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(['CHECK_IN', 'CHECK_OUT']),
  inspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rooms: z.array(z.string().trim().min(1).max(80)).min(1),
  customRooms: z.array(z.string().trim().min(1).max(80)).default([]),
});

/**
 * Start een plaatsbeschrijving.
 *
 * Bij een intrek kent dit meteen het gratis dossier toe, als de gebruiker er
 * nog recht op heeft. Bij een vertrek moet er een afgerond intrekdossier zijn:
 * zonder vergelijkingsbasis heeft een uitcheckdossier weinig waarde, en dat
 * zeggen wij liever vooraf dan achteraf.
 */
export async function createInspectionAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = createSchema.safeParse({
    propertyId: formData.get('propertyId')?.toString(),
    type: formData.get('type')?.toString(),
    inspectionDate:
      formData.get('inspectionDate')?.toString() || toIsoDate(new Date()),
    rooms: formData.getAll('rooms').map(String),
    customRooms: formData
      .getAll('customRooms')
      .map(String)
      .filter((value) => value.trim() !== ''),
  });

  if (!parsed.success) {
    return {
      error: 'INVALID_INPUT',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'NOT_AUTHENTICATED' };

  const { propertyId, type, inspectionDate, rooms, customRooms } = parsed.data;

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .maybeSingle();
  if (!property) return { error: 'NOT_FOUND' };

  const { data: existing } = await supabase
    .from('inspections')
    .select('id, type, status')
    .eq('property_id', propertyId);

  if (existing?.some((row) => row.type === type)) {
    return { error: 'ALREADY_EXISTS' };
  }

  if (type === 'CHECK_OUT') {
    const checkIn = existing?.find((row) => row.type === 'CHECK_IN');
    if (!checkIn || checkIn.status === 'DRAFT') return { error: 'NO_CHECK_IN' };
  }

  if (type === 'CHECK_IN') {
    // Toekennen vóór de controle: dit is precies het gratis instapmoment.
    await grantFreeCheckIn(supabase, user.id, propertyId);
  }

  const feature = type === 'CHECK_IN' ? 'CHECK_IN_REPORT' : 'CHECK_OUT_ANALYSIS';
  const entitlement = await checkFeature(supabase, user.id, feature, propertyId);
  if (!entitlement.allowed) {
    return { error: 'NOT_ENTITLED', suggestedPlan: entitlement.suggestedPlan };
  }

  const { data: inspection, error } = await supabase
    .from('inspections')
    .insert({
      property_id: propertyId,
      type,
      status: 'DRAFT',
      inspection_date: inspectionDate,
    })
    .select('id')
    .single();

  if (error || !inspection) return { error: 'SAVE_FAILED' };

  const selected = rooms.filter((key) =>
    ROOM_PRESETS.some((preset) => preset.key === key),
  );

  const roomRows = [
    ...selected.map((key, index) => ({
      inspection_id: inspection.id,
      room_key: key,
      display_name:
        ROOM_PRESETS.find((preset) => preset.key === key)?.[locale] ?? key,
      position: index,
    })),
    ...customRooms.map((name, index) => ({
      inspection_id: inspection.id,
      room_key: customRoomKey(name, index),
      display_name: name,
      position: selected.length + index,
    })),
  ];

  if (roomRows.length > 0) {
    await supabase.from('inspection_rooms').insert(roomRows);
  }

  revalidatePath(`/${locale}/properties/${propertyId}`);
  redirect(`/${locale}/inspections/${inspection.id}`);
}

const addRoomSchema = z.object({
  inspectionId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80),
});

export async function addRoomAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = addRoomSchema.safeParse({
    inspectionId: formData.get('inspectionId')?.toString(),
    displayName: formData.get('displayName')?.toString(),
  });
  if (!parsed.success) return { error: 'INVALID_INPUT' };

  const supabase = await createSupabaseServerClient();
  const { inspectionId, displayName } = parsed.data;

  const { data: rooms } = await supabase
    .from('inspection_rooms')
    .select('id')
    .eq('inspection_id', inspectionId);

  const position = rooms?.length ?? 0;

  const { error } = await supabase.from('inspection_rooms').insert({
    inspection_id: inspectionId,
    room_key: customRoomKey(displayName, position),
    display_name: displayName,
    position,
  });

  if (error) return { error: 'SAVE_FAILED' };

  revalidatePath(`/${locale}/inspections/${inspectionId}`);
  return { error: null };
}

const noteSchema = z.object({
  roomId: z.string().uuid(),
  inspectionId: z.string().uuid(),
  notes: z.string().trim().max(4000),
});

export async function saveRoomNotesAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = noteSchema.safeParse({
    roomId: formData.get('roomId')?.toString(),
    inspectionId: formData.get('inspectionId')?.toString(),
    notes: formData.get('notes')?.toString() ?? '',
  });
  if (!parsed.success) return { error: 'INVALID_INPUT' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('inspection_rooms')
    .update({
      notes: parsed.data.notes === '' ? null : parsed.data.notes,
      completed_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.roomId);

  if (error) return { error: 'SAVE_FAILED' };

  revalidatePath(`/${locale}/inspections/${parsed.data.inspectionId}`);
  return { error: null };
}

/**
 * Rondt het dossier af.
 *
 * Een dossier met nul foto's afronden heeft geen zin; daarop weigeren wij. Een
 * dossier met ontbrekende aanbevolen foto's ronden wij wél af — het rapport
 * vermeldt dan zelf wat ontbreekt.
 */
export async function completeInspectionAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const locale = resolveLocale(formData.get('locale')?.toString());
  const inspectionId = formData.get('inspectionId')?.toString();
  if (!inspectionId) return { error: 'INVALID_INPUT' };

  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from('inspection_photos')
    .select('id', { count: 'exact', head: true })
    .eq('inspection_id', inspectionId);

  if ((count ?? 0) === 0) return { error: 'NOT_COMPLETE' };

  const { error } = await supabase
    .from('inspections')
    .update({ status: 'COMPLETED' })
    .eq('id', inspectionId)
    .eq('status', 'DRAFT');

  if (error) return { error: 'SAVE_FAILED' };

  revalidatePath(`/${locale}/inspections/${inspectionId}`);
  return { error: null };
}

/**
 * Nodigt de verhuurder uit om mee te ondertekenen.
 *
 * Het token bestaat maar één keer in leesbare vorm: in de link. In de databank
 * staat enkel de hash. Wie de databank leest, kan dus geen geldige link maken.
 */
export async function inviteLandlordAction(
  _prev: InspectionState,
  formData: FormData,
): Promise<InspectionState> {
  const locale = resolveLocale(formData.get('locale')?.toString());
  const inspectionId = formData.get('inspectionId')?.toString();
  if (!inspectionId) return { error: 'INVALID_INPUT' };

  const supabase = await createSupabaseServerClient();

  const { data: inspection } = await supabase
    .from('inspections')
    .select('id, status, property_id')
    .eq('id', inspectionId)
    .maybeSingle();

  if (!inspection) return { error: 'NOT_FOUND' };
  if (inspection.status === 'DRAFT') return { error: 'NOT_COMPLETE' };

  const { data: property } = await supabase
    .from('properties')
    .select('landlord_email')
    .eq('id', inspection.property_id)
    .maybeSingle();

  if (!property?.landlord_email) return { error: 'NO_LANDLORD_EMAIL' };

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);

  const { error } = await supabase
    .from('inspections')
    .update({
      landlord_invite_token_hash: tokenHash,
      landlord_invite_sent_at: new Date().toISOString(),
      landlord_invite_expires_at: expiresAt.toISOString(),
    })
    .eq('id', inspectionId);

  if (error) return { error: 'SAVE_FAILED' };

  const { sendLandlordInvite } = await import('@/lib/email/send');
  const sent = await sendLandlordInvite({
    to: property.landlord_email,
    locale,
    token,
    inspectionId,
  });

  // De uitnodiging is opgeslagen; alleen de verzending kan mislukt zijn. De UI
  // toont dan de link zodat de gebruiker hem zelf kan doorsturen.
  await createSupabaseAdminClient()
    .from('audit_log')
    .insert({
      action: 'NOTICE_SENT',
      resource_type: 'inspection_invite',
      resource_id: inspectionId,
      metadata: { delivered: sent.ok, reason: sent.ok ? null : sent.reason },
    });

  revalidatePath(`/${locale}/inspections/${inspectionId}`);
  return sent.ok ? { error: null } : { error: 'EMAIL_NOT_CONFIGURED' };
}
