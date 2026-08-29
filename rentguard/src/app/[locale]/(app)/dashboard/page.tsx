import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Alert, Card, CardHeader } from '@/components/ui/surface';
import { DisclaimerNotice } from '@/components/legal/legal-notices';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const profile = await requireProfile(locale);
  const t = getMessages(locale);

  const supabase = await createSupabaseServerClient();
  const { count: propertyCount } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true });

  const hasProperties = (propertyCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {locale === 'nl'
            ? `Welkom${profile.full_name ? `, ${profile.full_name}` : ''}`
            : `Bienvenue${profile.full_name ? `, ${profile.full_name}` : ''}`}
        </h1>
      </div>

      {!hasProperties ? (
        <Card>
          <CardHeader
            title={locale === 'nl' ? 'Begin hier' : 'Commencez ici'}
            description={
              locale === 'nl'
                ? 'Voeg uw woning toe. Daarna kunt u meteen beginnen met de ' +
                  'fotodocumentatie bij intrek.'
                : 'Ajoutez votre logement. Vous pourrez ensuite commencer ' +
                  'directement la documentation photographique d’entrée.'
            }
          />
          <Link
            href={`/${locale}/properties/new`}
            className={cn(buttonVariants({ size: 'lg' }))}
          >
            {locale === 'nl' ? 'Woning toevoegen' : 'Ajouter un logement'}
          </Link>
          <p className="mt-3 text-sm text-slate-600">{t.billing.freeCheckIn}</p>
        </Card>
      ) : (
        <Card>
          <CardHeader title={t.nav.properties} />
          <Link
            href={`/${locale}/properties`}
            className={cn(buttonVariants({ variant: 'secondary' }))}
          >
            {locale === 'nl'
              ? `${propertyCount} woning${propertyCount === 1 ? '' : 'en'} bekijken`
              : `Voir ${propertyCount} logement${propertyCount === 1 ? '' : 's'}`}
          </Link>
        </Card>
      )}

      <Alert
        tone="info"
        title={locale === 'nl' ? 'In opbouw' : 'En construction'}
      >
        <p>
          {locale === 'nl'
            ? 'De plaatsbeschrijvingswizard, de waarborgbewaking en de auditors ' +
              'zijn nog in ontwikkeling. Wat u hier ziet, werkt echt — wij tonen ' +
              'geen knoppen voor functies die er nog niet zijn.'
            : 'L’assistant d’état des lieux, le suivi de la garantie et les ' +
              'audits sont encore en développement. Ce que vous voyez ici ' +
              'fonctionne réellement — nous n’affichons pas de boutons pour des ' +
              'fonctions qui n’existent pas encore.'}
        </p>
      </Alert>

      <DisclaimerNotice locale={locale} />
    </div>
  );
}
