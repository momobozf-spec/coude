import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages, format } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Badge, Card, CardHeader } from '@/components/ui/surface';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { InspectionWizard } from '@/components/inspections/inspection-wizard';
import { EvidenceLevelNotice } from '@/components/legal/legal-notices';
import {
  CompleteInspectionForm,
  InviteLandlordForm,
} from '@/components/inspections/inspection-forms';
import { saveRoomNotesAction } from '@/app/[locale]/(app)/inspections/actions';

export default async function InspectionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  await requireProfile(locale);
  const t = getMessages(locale);

  const supabase = await createSupabaseServerClient();
  const { data: inspection } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!inspection) notFound();

  const [{ data: property }, { data: rooms }, { data: photos }] =
    await Promise.all([
      supabase
        .from('properties')
        .select('*')
        .eq('id', inspection.property_id)
        .maybeSingle(),
      supabase
        .from('inspection_rooms')
        .select('*')
        .eq('inspection_id', id)
        .order('position', { ascending: true }),
      supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', id)
        .order('uploaded_at', { ascending: true }),
    ]);

  if (!property) notFound();

  const isDraft = inspection.status === 'DRAFT';
  const isSigned = inspection.status === 'SIGNED_BY_LANDLORD';
  const photoCount = photos?.length ?? 0;

  async function saveNotes(formData: FormData) {
    'use server';
    await saveRoomNotesAction({ error: null }, formData);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/properties/${property.id}`}
          className="text-sm text-slate-600 underline underline-offset-2"
        >
          {property.address}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {inspection.type === 'CHECK_IN'
            ? t.inspection.checkIn
            : t.inspection.checkOut}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>{formatDate(inspection.inspection_date, locale)}</span>
          <Badge tone={isDraft ? 'unverified' : isSigned ? 'verified' : 'neutral'}>
            {isDraft
              ? locale === 'nl'
                ? 'In opmaak'
                : 'En cours'
              : isSigned
                ? locale === 'nl'
                  ? 'Medeondertekend'
                  : 'Cosigné'
                : locale === 'nl'
                  ? 'Afgerond'
                  : 'Clôturé'}
          </Badge>
          <span>
            {photoCount} {locale === 'nl' ? "foto's" : 'photos'}
          </span>
        </p>
      </div>

      <EvidenceLevelNotice
        locale={locale}
        level={isSigned ? 'COUNTERSIGNED_REPORT' : 'UNILATERAL_REPORT'}
      />

      {isSigned && inspection.landlord_signed_at ? (
        <Alert tone="success">
          <p>
            {format(t.inspection.signedByLandlord, {
              name: inspection.landlord_signature_name ?? '—',
              date: formatDateTime(inspection.landlord_signed_at, locale),
            })}
          </p>
        </Alert>
      ) : null}

      <InspectionWizard
        locale={locale}
        inspectionId={id}
        rooms={rooms ?? []}
        initialPhotos={photos ?? []}
        readOnly={!isDraft}
        onNotesSave={saveNotes}
      />

      {isDraft ? (
        <Card>
          <CardHeader
            title={t.inspection.complete}
            description={
              locale === 'nl'
                ? 'Na afronding kunt u geen foto’s meer toevoegen of verwijderen. ' +
                  'Dat is bewust: een dossier dat achteraf nog kan wijzigen, ' +
                  'verliest zijn waarde.'
                : 'Après clôture, vous ne pourrez plus ajouter ni supprimer de ' +
                  'photos. C’est délibéré : un dossier modifiable après coup perd ' +
                  'sa valeur.'
            }
          />
          <CompleteInspectionForm
            locale={locale}
            inspectionId={id}
            disabled={photoCount === 0}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title={t.inspection.downloadReport} />
            <a
              href={`/api/inspections/${id}/report?locale=${locale}`}
              className={cn(buttonVariants({ size: 'lg' }))}
            >
              {t.inspection.downloadReport} (PDF)
            </a>
            <p className="mt-3 text-sm text-slate-600">
              {locale === 'nl'
                ? 'Het rapport wordt bij elke download opnieuw opgebouwd uit uw ' +
                  'dossier, en controleert daarbij van elke foto of de bewaarde ' +
                  'bytes nog met de vingerafdruk overeenkomen.'
                : 'Le rapport est reconstruit à chaque téléchargement à partir de ' +
                  'votre dossier et vérifie pour chaque photo que les octets ' +
                  'conservés correspondent toujours à l’empreinte.'}
            </p>
          </Card>

          {!isSigned ? (
            <Card>
              <CardHeader
                title={t.inspection.inviteLandlord}
                description={t.inspection.whyCosign}
              />
              <InviteLandlordForm
                locale={locale}
                inspectionId={id}
                landlordEmail={property.landlord_email}
                propertyId={property.id}
                alreadySentAt={inspection.landlord_invite_sent_at}
              />
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
