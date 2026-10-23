import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { PropertyForm } from '@/components/properties/property-form';
import { createPropertyAction } from '@/app/[locale]/(app)/properties/actions';

export default async function NewPropertyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireProfile(locale);
  const t = getMessages(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {locale === 'nl' ? 'Woning toevoegen' : 'Ajouter un logement'}
        </h1>
        <p className="mt-1 text-sm text-slate-700">
          {locale === 'nl'
            ? 'Alleen het adres en de gemeente zijn nu verplicht. De rest kunt u ' +
              'later aanvullen — wij vragen het opnieuw op het moment dat een ' +
              'berekening het nodig heeft.'
            : 'Seuls l’adresse et la commune sont obligatoires maintenant. Vous ' +
              'pourrez compléter le reste plus tard — nous le redemanderons au ' +
              'moment où un calcul en aura besoin.'}
        </p>
      </div>

      <PropertyForm
        locale={locale}
        messages={t}
        action={createPropertyAction}
      />
    </div>
  );
}
