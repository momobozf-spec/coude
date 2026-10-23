import 'server-only';

import { createHash } from 'node:crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import type { Inspection, Property } from '@/lib/supabase/types';

/**
 * Toegang van de verhuurder tot een dossier, via de uitnodigingslink.
 *
 * De verhuurder heeft geen account. De link zelf is de sleutel. Daarom:
 *
 *  - het token staat enkel gehasht in de databank;
 *  - de link verloopt na dertig dagen;
 *  - deze functies gebruiken de service role en doen dus hun **eigen**
 *    autorisatie: zonder geldig, niet-verlopen token komt er niets terug.
 */

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface LandlordView {
  inspection: Inspection;
  property: Property;
  photoCount: number;
  roomCount: number;
  tenantName: string;
}

export type TokenFailure = 'NOT_FOUND' | 'EXPIRED';

export async function resolveLandlordToken(
  token: string,
): Promise<LandlordView | TokenFailure> {
  if (!token || token.length < 20) return 'NOT_FOUND';

  const admin = createSupabaseAdminClient();

  const { data: inspection } = await admin
    .from('inspections')
    .select('*')
    .eq('landlord_invite_token_hash', hashToken(token))
    .maybeSingle();

  if (!inspection) return 'NOT_FOUND';

  if (
    inspection.landlord_invite_expires_at &&
    new Date(inspection.landlord_invite_expires_at) < new Date()
  ) {
    return 'EXPIRED';
  }

  const { data: property } = await admin
    .from('properties')
    .select('*')
    .eq('id', inspection.property_id)
    .maybeSingle();

  if (!property) return 'NOT_FOUND';

  const [{ count: photoCount }, { count: roomCount }, { data: profile }] =
    await Promise.all([
      admin
        .from('inspection_photos')
        .select('id', { count: 'exact', head: true })
        .eq('inspection_id', inspection.id),
      admin
        .from('inspection_rooms')
        .select('id', { count: 'exact', head: true })
        .eq('inspection_id', inspection.id),
      admin
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', property.user_id)
        .maybeSingle(),
    ]);

  return {
    inspection,
    property,
    photoCount: photoCount ?? 0,
    roomCount: roomCount ?? 0,
    tenantName: profile?.full_name ?? profile?.email ?? '',
  };
}

export async function logLandlordAccess(
  inspectionId: string,
  action: 'LANDLORD_REPORT_VIEW' | 'LANDLORD_SIGNED',
  ip: string | null,
  userAgent: string | null,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from('audit_log').insert({
    user_id: null,
    action,
    resource_type: 'inspection',
    resource_id: inspectionId,
    metadata: {},
    ip,
    user_agent: userAgent,
  });
}
