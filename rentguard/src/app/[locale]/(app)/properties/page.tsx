import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/surface';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatDate, formatEuro } from '@/lib/utils';

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireProfile(locale);
  const t = getMessages(locale);

  const supabase = await createSupabaseServerClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {t.nav.properties}
        </h1>
        <Link
          href={`/${locale}/properties/new`}
          className={cn(buttonVariants())}
        >
          {locale === 'nl' ? 'Woning toevoegen' : 'Ajouter un logement'}
        </Link>
      </div>

      {!properties || properties.length === 0 ? (
        <Card>
          <p className="text-slate-700">
            {locale === 'nl'
              ? 'U hebt nog geen woning toegevoegd. Voeg er een toe om te ' +
                'beginnen met uw plaatsbeschrijving.'
              : 'Vous n’avez pas encore ajouté de logement. Ajoutez-en un pour ' +
                'commencer votre état des lieux.'}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/${locale}/properties/${property.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-400"
              >
                <p className="font-medium text-slate-900">{property.address}</p>
                <p className="text-sm text-slate-600">
                  {property.postal_code} {property.municipality}
                </p>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                  {property.monthly_rent !== null ? (
                    <div className="flex gap-1">
                      <dt>{t.property.monthlyRent}:</dt>
                      <dd className="font-medium text-slate-800">
                        {formatEuro(property.monthly_rent, locale)}
                      </dd>
                    </div>
                  ) : null}
                  {property.lease_start ? (
                    <div className="flex gap-1">
                      <dt>{t.property.leaseStart}:</dt>
                      <dd className="font-medium text-slate-800">
                        {formatDate(property.lease_start, locale)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
