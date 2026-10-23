import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale, type Locale } from '@/i18n/config';
import { Alert, Card } from '@/components/ui/surface';
import { DisclaimerNotice } from '@/components/legal/legal-notices';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isFeatureEnabled } from '@/lib/features';
import { SiteFooter } from '@/components/legal/site-footer';

const COPY: Record<
  Locale,
  {
    lead: string;
    pillars: { title: string; body: string }[];
    lettersPillar: { title: string; body: string };
    upcomingTitle: string;
    upcoming: string[];
    honesty: { title: string; body: string };
    cta: string;
    ctaSecondary: string;
  }
> = {
  nl: {
    lead:
      'Documenteer uw woning bij intrek en vertrek met foto’s die een ' +
      'gegevensvingerafdruk en servertijdstempel krijgen, en vergelijk beide ' +
      'dossiers wanneer u vertrekt.',
    pillars: [
      {
        title: 'Plaatsbeschrijving met bewijsintegriteit',
        body:
          'Kamer per kamer een geleide fotochecklist. Elke foto krijgt bij ' +
          'ontvangst een gegevensvingerafdruk (SHA-256) en een tijdstempel van ' +
          'onze server. Beide staan in het PDF-rapport.',
      },
      {
        title: 'Vergelijking intrek — vertrek',
        body:
          'Bij vertrek zetten wij elke foto naast de intrekfoto. Een AI-analyse ' +
          'stelt slijtage of schade voor; u bevestigt of corrigeert elk oordeel.',
      },
      {
        title: 'Medeondertekening door de verhuurder',
        body:
          'Stuur uw verhuurder een persoonlijke link om het dossier te bekijken ' +
          'en mee te ondertekenen.',
      },
    ],
    lettersPillar: {
      title: 'Waarborg-terugeis',
      body:
        'Wij berekenen de termijn uit de Brusselse regelgeving en stellen een ' +
        'ingebrekestelling op uit een vaste template met bronvermelding.',
    },
    upcomingTitle: 'In voorbereiding',
    upcoming: [
      'Opvolging van de waarborgtermijn en brieven (na juridische nalezing)',
      'Controle van huurprijs en indexatie',
      'Scan van het huurcontract',
    ],
    honesty: {
      title: 'Wat wij niet zijn',
      body:
        'Wij zijn geen advocatenkantoor en geven geen juridisch advies. Een ' +
        'fotodossier dat u alleen opmaakt, is bewijsmateriaal dat een rechter ' +
        'vrij beoordeelt — het vervangt geen tegensprekelijke plaatsbeschrijving. ' +
        'Wij beloven geen enkele uitkomst.',
    },
    cta: 'Account aanmaken',
    ctaSecondary: 'Aanmelden',
  },
  fr: {
    lead:
      "Documentez votre logement à l'entrée et à la sortie avec des photos " +
      'dotées d’une empreinte numérique et d’un horodatage serveur, et comparez ' +
      'les deux dossiers à votre départ.',
    pillars: [
      {
        title: "État des lieux avec intégrité de preuve",
        body:
          'Une liste de photos guidée, pièce par pièce. Chaque photo reçoit à la ' +
          "réception une empreinte numérique (SHA-256) et un horodatage de notre " +
          'serveur. Les deux figurent dans le rapport PDF.',
      },
      {
        title: 'Comparaison entrée — sortie',
        body:
          'À la sortie, nous plaçons chaque photo à côté de la photo d’entrée. ' +
          'Une analyse IA propose usure normale ou dégât ; vous confirmez ou ' +
          'corrigez chaque avis.',
      },
      {
        title: 'Contresignature par le bailleur',
        body:
          'Envoyez à votre bailleur un lien personnel pour consulter le dossier ' +
          'et le contresigner.',
      },
    ],
    lettersPillar: {
      title: 'Récupération de la garantie',
      body:
        'Nous calculons le délai à partir de la réglementation bruxelloise et ' +
        'rédigeons une mise en demeure à partir d’un modèle fixe avec ' +
        'indication des sources.',
    },
    upcomingTitle: 'En préparation',
    upcoming: [
      'Suivi du délai de libération de la garantie et courriers (après relecture juridique)',
      'Contrôle du loyer et de l’indexation',
      'Analyse du bail',
    ],
    honesty: {
      title: 'Ce que nous ne sommes pas',
      body:
        "Nous ne sommes pas un cabinet d'avocats et ne donnons pas de conseil " +
        'juridique. Un dossier photographique que vous établissez seul est un ' +
        'élément de preuve que le juge apprécie librement — il ne remplace pas ' +
        'un état des lieux contradictoire. Nous ne promettons aucun résultat.',
    },
    cta: 'Créer un compte',
    ctaSecondary: 'Se connecter',
  },
};

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getMessages(locale);
  const copy = COPY[locale];
  const lettersEnabled = isFeatureEnabled('depositLetters', {
    FEATURE_DEPOSIT_LETTERS: process.env.FEATURE_DEPOSIT_LETTERS === 'true',
    FEATURE_TENANT_PROTECT_SUBSCRIPTION: false,
  });
  const pillars = lettersEnabled ? [...copy.pillars, copy.lettersPillar] : copy.pillars;
  const upcoming = lettersEnabled ? copy.upcoming.slice(1) : copy.upcoming;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-10">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
          {locale === 'nl'
            ? 'Voor huurders in het Brussels Gewest'
            : 'Pour les locataires en Région bruxelloise'}
        </p>
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          {t.common.appName}
        </h1>
        <p className="mt-4 text-lg text-slate-700">{copy.lead}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/register`}
            className={cn(buttonVariants({ size: 'lg' }))}
          >
            {copy.cta}
          </Link>
          <Link
            href={`/${locale}/login`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}
          >
            {copy.ctaSecondary}
          </Link>
        </div>

        <p className="mt-3 text-sm text-slate-600">{t.billing.freeCheckIn}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {pillars.map((pillar) => (
          <Card key={pillar.title}>
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              {pillar.title}
            </h2>
            <p className="text-sm text-slate-700">{pillar.body}</p>
          </Card>
        ))}
      </section>

      {upcoming.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {copy.upcomingTitle}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {upcoming.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 space-y-4">
        <Alert tone="warning" title={copy.honesty.title}>
          <p>{copy.honesty.body}</p>
        </Alert>
        <DisclaimerNotice locale={locale} />
      </section>

      <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6 text-sm text-slate-600">
        <span>{t.common.tagline}</span>
        <Link
          href={`/${locale === 'nl' ? 'fr' : 'nl'}`}
          className="underline underline-offset-2"
          hrefLang={locale === 'nl' ? 'fr' : 'nl'}
        >
          {locale === 'nl' ? 'Français' : 'Nederlands'}
        </Link>
      </div>
      <SiteFooter locale={locale} />
    </main>
  );
}
