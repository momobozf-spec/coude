import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toIsoDate } from '@/lib/date';
import { Alert, Card } from '@/components/ui/surface';
import { StartInspectionForm } from '@/components/inspections/inspection-forms';

export default async function NewInspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ property?: string; type?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { property: propertyId, type } = await searchParams;
  if (!propertyId) redirect(`/${locale}/properties`);

  await requireProfile(locale);
  const t = getMessages(locale);

  const supabase = await createSupabaseServerClient();
  const { data: property } = await supabase
    .from('properties')
    .select('id, address, postal_code, municipality')
    .eq('id', propertyId)
    .maybeSingle();

  if (!property) notFound();

  const inspectionType = type === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN';

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
          {inspectionType === 'CHECK_IN'
            ? t.inspection.startCheckIn
            : t.inspection.startCheckOut}
        </h1>
      </div>

      <Alert tone="info">
        <p>
          {inspectionType === 'CHECK_IN'
            ? locale === 'nl'
              ? 'Doe dit zo snel mogelijk na uw intrek, en liefst vóór u meubels ' +
                'plaatst. Alles wat u nu niet vastlegt, kan bij uw vertrek aan u ' +
                'worden toegeschreven.'
              : 'Faites-le le plus tôt possible après votre entrée, de préférence ' +
                'avant d’installer vos meubles. Tout ce que vous ne documentez ' +
                'pas maintenant pourra vous être imputé à votre départ.'
            : locale === 'nl'
              ? 'Doe dit wanneer de woning leeg en schoongemaakt is. Wij koppelen ' +
                'uw foto’s automatisch aan de overeenkomstige intrekfoto’s.'
              : 'Faites-le lorsque le logement est vide et nettoyé. Nous relions ' +
                'automatiquement vos photos aux photos d’entrée correspondantes.'}
        </p>
      </Alert>

      <Card>
        <StartInspectionForm
          locale={locale}
          propertyId={property.id}
          type={inspectionType}
          defaultDate={toIsoDate(new Date())}
        />
      </Card>
    </div>
  );
}
