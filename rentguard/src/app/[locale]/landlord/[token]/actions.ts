'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { resolveLandlordToken, logLandlordAccess } from '@/lib/inspections/landlord-token';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export type SignErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'ALREADY_SIGNED'
  | 'SAVE_FAILED';

export interface SignState {
  error: SignErrorCode | null;
  signed?: boolean;
}

const signSchema = z.object({
  token: z.string().min(20),
  fullName: z.string().trim().min(2).max(120),
  confirmed: z.literal('on'),
});

/**
 * Medeondertekening door de verhuurder.
 *
 * Wij leggen naam, tijdstip en IP-adres vast. Dat is geen elektronische
 * handtekening in de zin van de eIDAS-verordening, en het rapport zegt dat ook:
 * het is een vaststelling dat iemand met deze naam, via deze link, op dit
 * moment bevestigd heeft de inhoud te hebben gezien en te aanvaarden.
 */
export async function signInspectionAction(
  _prev: SignState,
  formData: FormData,
): Promise<SignState> {
  const parsed = signSchema.safeParse({
    token: formData.get('token')?.toString(),
    fullName: formData.get('fullName')?.toString(),
    confirmed: formData.get('confirmed')?.toString(),
  });

  if (!parsed.success) return { error: 'INVALID_INPUT' };

  const resolved = await resolveLandlordToken(parsed.data.token);
  if (resolved === 'NOT_FOUND') return { error: 'NOT_FOUND' };
  if (resolved === 'EXPIRED') return { error: 'EXPIRED' };

  if (resolved.inspection.landlord_signed_at) {
    return { error: 'ALREADY_SIGNED' };
  }

  const headerList = await headers();
  const ip =
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip');

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('inspections')
    .update({
      status: 'SIGNED_BY_LANDLORD',
      landlord_signed_at: new Date().toISOString(),
      landlord_signature_name: parsed.data.fullName,
      landlord_signature_ip: ip,
    })
    .eq('id', resolved.inspection.id)
    .is('landlord_signed_at', null);

  if (error) return { error: 'SAVE_FAILED' };

  await logLandlordAccess(
    resolved.inspection.id,
    'LANDLORD_SIGNED',
    ip,
    headerList.get('user-agent'),
  );

  revalidatePath(`/nl/landlord/${parsed.data.token}`);
  revalidatePath(`/fr/landlord/${parsed.data.token}`);

  return { error: null, signed: true };
}
