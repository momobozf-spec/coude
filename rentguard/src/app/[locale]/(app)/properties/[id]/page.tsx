import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale, type Locale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Card, CardHeader } from '@/components/ui/surface';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatDate, formatEuro } from '@/lib/utils';
import { depositExceedsTwoMonths } from '@/lib/properties/schema';
import type { Property } from '@/lib/supabase/types';

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

interface InspectionSummary {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  status: 'DRAFT' | 'COMPLETED' | 'SIGNED_BY_LANDLORD';
  inspection_date: string;
  landlord_signed_at: string | null;
}

function InspectionRow({
  locale,
  propertyId,
  type,
  title,
  startLabel,
  inspection,
  blockedReason,
}: {
  locale: Locale;
  propertyId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  title: string;
  startLabel: string;
  inspection: InspectionSummary | null;
  blockedReason: string | null;
}) {
  const statusLabel = inspection
    ? inspection.status === 'DRAFT'
      ? locale === 'nl'
        ? 'In opmaak'
        : 'En cours'
      : inspection.status === 'SIGNED_BY_LANDLORD'
        ? locale === 'nl'
          ? 'Medeondertekend'
          : 'Cosigné'
        : locale === 'nl'
          ? 'Afgerond'
          : 'Clôturé'
    : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div>
        <p className="font-medium text-slate-900">{title}</p>
        {inspection ? (
          <p className="text-sm text-slate-600">
            {formatDate(inspection.inspection_date, locale)} — {statusLabel}
          </p>
        ) : blockedReason ? (
          <p className="text-sm text-slate-600">{blockedReason}</p>
        ) : (
          <p className="text-sm text-slate-600">
            {locale === 'nl' ? 'Nog niet gestart' : 'Pas encore démarré'}
          </p>
        )}
      </div>

      {inspection ? (
        <Link
          href={`/${locale}/inspections/${inspection.id}`}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
        >
          {locale === 'nl' ? 'Openen' : 'Ouvrir'}
        </Link>
      ) : blockedReason ? null : (
        <Link
          href={`/${locale}/inspections/new?property=${propertyId}&type=${type}`}
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          {startLabel}
        </Link>
      )}
    </div>
  );
}

function yesNo(value: boolean | null, locale: Locale): string {
  if (value === null) return locale === 'nl' ? 'Onbekend' : 'Inconnu';
  if (locale === 'nl') return value ? 'Ja' : 'Nee';
  return value ? 'Oui' : 'Non';
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  await requireProfile(locale);
  const t = getMessages(locale);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  const property: Property = data;

  const { data: inspections } = await supabase
    .from('inspections')
    .select('id, type, status, inspection_date, landlord_signed_at')
    .eq('property_id', id);

  const checkIn = inspections?.find((row) => row.type === 'CHECK_IN') ?? null;
  const checkOut = inspections?.find((row) => row.type === 'CHECK_OUT') ?? null;

  const depositWarning = depositExceedsTwoMonths(
    property.monthly_rent,
    property.deposit_amount,
  );

  const missing: string[] = [];
  if (property.lease_signed_on === null) missing.push(t.property.leaseSignedOn);
  if (property.monthly_rent === null) missing.push(t.property.monthlyRent);
  if (property.deposit_amount === null) missing.push(t.property.depositAmount);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {property.address}
          </h1>
          <p className="text-slate-600">
            {property.postal_code} {property.municipality}
          </p>
        </div>
        <Link
          href={`/${locale}/properties/${property.id}/edit`}
          className={cn(buttonVariants({ variant: 'secondary' }))}
        >
          {locale === 'nl' ? 'Bewerken' : 'Modifier'}
        </Link>
      </div>

      {depositWarning ? (
        <Alert
          tone="warning"
          title={
            locale === 'nl'
              ? 'Uw waarborg lijkt hoger dan twee maanden huur'
              : 'Votre garantie semble dépasser deux mois de loyer'
          }
        >
          <p>
            {locale === 'nl'
              ? 'Voor Brusselse huurovereenkomsten gesloten of hernieuwd vanaf ' +
                '1 november 2024 bedraagt de waarborg maximaal twee maanden huur. ' +
                'Voor oudere contracten kan een hoger bedrag correct zijn. Dit is ' +
                'een signalering, geen juridisch oordeel.'
              : 'Pour les baux bruxellois conclus ou renouvelés à partir du ' +
                '1er novembre 2024, la garantie s’élève à maximum deux mois de ' +
                'loyer. Pour des baux plus anciens, un montant supérieur peut ' +
                'être correct. Ceci est un signalement, pas un jugement juridique.'}
          </p>
        </Alert>
      ) : null}

      {missing.length > 0 ? (
        <Alert tone="info">
          <p>
            {locale === 'nl'
              ? `Nog niet ingevuld: ${missing.join(', ')}. Wij vragen dit opnieuw ` +
                'zodra een berekening het nodig heeft.'
              : `Pas encore renseigné : ${missing.join(', ')}. Nous le ` +
                'redemanderons dès qu’un calcul en aura besoin.'}
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={t.nav.inspections}
          description={
            locale === 'nl'
              ? 'Documenteer de staat van de woning bij intrek en bij vertrek.'
              : 'Documentez l’état du logement à l’entrée et à la sortie.'
          }
        />
        <div className="space-y-3">
          <InspectionRow
            locale={locale}
            propertyId={property.id}
            type="CHECK_IN"
            title={t.inspection.checkIn}
            startLabel={t.inspection.startCheckIn}
            inspection={checkIn}
            blockedReason={null}
          />
          <InspectionRow
            locale={locale}
            propertyId={property.id}
            type="CHECK_OUT"
            title={t.inspection.checkOut}
            startLabel={t.inspection.startCheckOut}
            inspection={checkOut}
            blockedReason={
              !checkIn || checkIn.status === 'DRAFT'
                ? locale === 'nl'
                  ? 'Rond eerst het intrekdossier af.'
                  : 'Clôturez d’abord le dossier d’entrée.'
                : null
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={locale === 'nl' ? 'Huurprijs en waarborg' : 'Loyer et garantie'}
        />
        <dl>
          <Row
            label={t.property.monthlyRent}
            value={
              property.monthly_rent === null
                ? '—'
                : formatEuro(property.monthly_rent, locale)
            }
          />
          <Row
            label={t.property.monthlyCharges}
            value={
              property.monthly_charges === null
                ? '—'
                : formatEuro(property.monthly_charges, locale)
            }
          />
          <Row
            label={t.property.depositAmount}
            value={
              property.deposit_amount === null
                ? '—'
                : formatEuro(property.deposit_amount, locale)
            }
          />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title={locale === 'nl' ? 'Huurovereenkomst' : 'Contrat de bail'}
        />
        <dl>
          <Row
            label={t.property.leaseSignedOn}
            value={formatDate(property.lease_signed_on, locale)}
          />
          <Row
            label={t.property.leaseStart}
            value={formatDate(property.lease_start, locale)}
          />
          <Row
            label={t.property.leaseEnd}
            value={formatDate(property.lease_end, locale)}
          />
          <Row
            label={t.property.leaseRegistered}
            value={yesNo(property.lease_registered, locale)}
          />
          <Row
            label={t.property.pebCertificateProvided}
            value={yesNo(property.peb_certificate_provided, locale)}
          />
          <Row label={t.property.pebRating} value={property.peb_rating ?? '—'} />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title={locale === 'nl' ? 'Verhuurder' : 'Bailleur'}
          description={t.property.landlordDataPurpose}
        />
        <dl>
          <Row
            label={t.property.landlordName}
            value={property.landlord_name ?? '—'}
          />
          <Row
            label={t.property.landlordAddress}
            value={property.landlord_address ?? '—'}
          />
          <Row
            label={t.property.landlordEmail}
            value={property.landlord_email ?? '—'}
          />
        </dl>
      </Card>

      <Card>
        <CardHeader title={t.privacy.retentionTitle} />
        <dl>
          <Row
            label={
              locale === 'nl'
                ? 'Bewaartermijn na einde huur'
                : 'Conservation après la fin du bail'
            }
            value={`${property.retention_years} ${locale === 'nl' ? 'jaar' : 'ans'}`}
          />
          <Row
            label={
              locale === 'nl'
                ? 'Geplande verwijdering'
                : 'Suppression prévue'
            }
            value={
              property.scheduled_deletion_at
                ? formatDate(property.scheduled_deletion_at, locale)
                : locale === 'nl'
                  ? 'Nog niet gepland — vul een einddatum in'
                  : 'Pas encore planifiée — indiquez une date de fin'
            }
          />
        </dl>
      </Card>
    </div>
  );
}
