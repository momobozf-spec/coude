'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { resolveLocale } from '@/i18n/config';
import { addMonthsUtc } from '@/lib/date';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { propertySchema } from '@/lib/properties/schema';

export type PropertyErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_AUTHENTICATED'
  | 'SAVE_FAILED';

export interface PropertyFormState {
  error: PropertyErrorCode | null;
  fieldErrors?: Record<string, string[]>;
}

function readForm(formData: FormData) {
  const get = (key: string) => formData.get(key)?.toString() ?? '';
  return {
    address: get('address'),
    postalCode: get('postalCode'),
    municipality: get('municipality'),
    monthlyRent: get('monthlyRent'),
    monthlyCharges: get('monthlyCharges'),
    depositAmount: get('depositAmount'),
    depositType: get('depositType') || 'UNKNOWN',
    leaseSignedOn: get('leaseSignedOn'),
    leaseStart: get('leaseStart'),
    leaseEnd: get('leaseEnd'),
    leaseRegistered: get('leaseRegistered'),
    pebCertificateProvided: get('pebCertificateProvided'),
    pebRating: get('pebRating'),
    surfaceM2: get('surfaceM2'),
    bedrooms: get('bedrooms'),
    landlordName: get('landlordName'),
    landlordAddress: get('landlordAddress'),
    landlordEmail: get('landlordEmail'),
    retentionYears: get('retentionYears') || '2',
  };
}

/**
 * Berekent wanneer het dossier automatisch verwijderd wordt.
 *
 * Zonder einddatum van de huur plannen wij nog niets: dan zou de teller op een
 * verzonnen datum starten. De planning volgt zodra de gebruiker een einddatum
 * invult.
 */
function scheduledDeletionAt(
  leaseEnd: string | null,
  retentionYears: number,
): string | null {
  if (!leaseEnd) return null;
  return addMonthsUtc(new Date(leaseEnd), retentionYears * 12).toISOString();
}

export async function createPropertyAction(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = propertySchema.safeParse(readForm(formData));
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

  const input = parsed.data;

  const { data, error } = await supabase
    .from('properties')
    .insert({
      user_id: user.id,
      address: input.address,
      postal_code: input.postalCode,
      municipality: input.municipality,
      monthly_rent: input.monthlyRent,
      monthly_charges: input.monthlyCharges,
      deposit_amount: input.depositAmount,
      deposit_type: input.depositType,
      lease_signed_on: input.leaseSignedOn,
      lease_start: input.leaseStart,
      lease_end: input.leaseEnd,
      lease_registered: input.leaseRegistered,
      peb_certificate_provided: input.pebCertificateProvided,
      peb_rating: input.pebRating,
      surface_m2: input.surfaceM2,
      bedrooms: input.bedrooms,
      landlord_name: input.landlordName,
      landlord_address: input.landlordAddress,
      landlord_email: input.landlordEmail,
      retention_years: input.retentionYears,
      scheduled_deletion_at: scheduledDeletionAt(
        input.leaseEnd,
        input.retentionYears,
      ),
    })
    .select('id')
    .single();

  if (error || !data) return { error: 'SAVE_FAILED' };

  revalidatePath(`/${locale}/properties`);
  redirect(`/${locale}/properties/${data.id}`);
}

export async function updatePropertyAction(
  propertyId: string,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const locale = resolveLocale(formData.get('locale')?.toString());

  const parsed = propertySchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      error: 'INVALID_INPUT',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const input = parsed.data;

  // RLS zorgt ervoor dat dit enkel de eigen woning raakt; een vreemd id levert
  // geen rijen op in plaats van een lek.
  const { error } = await supabase
    .from('properties')
    .update({
      address: input.address,
      postal_code: input.postalCode,
      municipality: input.municipality,
      monthly_rent: input.monthlyRent,
      monthly_charges: input.monthlyCharges,
      deposit_amount: input.depositAmount,
      deposit_type: input.depositType,
      lease_signed_on: input.leaseSignedOn,
      lease_start: input.leaseStart,
      lease_end: input.leaseEnd,
      lease_registered: input.leaseRegistered,
      peb_certificate_provided: input.pebCertificateProvided,
      peb_rating: input.pebRating,
      surface_m2: input.surfaceM2,
      bedrooms: input.bedrooms,
      landlord_name: input.landlordName,
      landlord_address: input.landlordAddress,
      landlord_email: input.landlordEmail,
      retention_years: input.retentionYears,
      scheduled_deletion_at: scheduledDeletionAt(
        input.leaseEnd,
        input.retentionYears,
      ),
    })
    .eq('id', propertyId);

  if (error) return { error: 'SAVE_FAILED' };

  revalidatePath(`/${locale}/properties/${propertyId}`);
  redirect(`/${locale}/properties/${propertyId}`);
}
