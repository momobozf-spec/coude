import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale, type Locale } from '@/i18n/config';
import { Alert, Card } from '@/components/ui/surface';
import { DisclaimerNotice } from '@/components/legal/legal-notices';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COPY: Record<
  Locale,
  {
    lead: string;
    pillars: { title: string; body: string }[];
    honesty: { title: string; body: string };
    cta: string;
    ctaSecondary: string;
  }
> = {
  nl: {
    lead:
      'Documenteer uw woning bij intrek en vertrek, bewaak de termijn waarbinnen ' +
      'uw huurwaarborg moet worden vrijgegeven, en controleer of uw huurprijs en ' +
      'indexatie kloppen.',
    pillars: [
      {
        title: 'Plaatsbeschrijving met bewijsintegriteit',
        body:
          'Kamer per kamer een geleide fotochecklist. Elke foto krijgt bij ' +
          'ontvangst een gegevensvingerafdruk (SHA-256) en een tijdstempel van ' +
          'onze server. Beide staan in het rapport.',
      },
      {
        title: 'Waarborg-terugeis',
        body:
          'Wij berekenen de wettelijke termijn uit de Brusselse regelgeving, ' +
          'sturen u herinneringen, en stellen een ingebrekestelling op uit een ' +
          'vaste template met bronvermelding.',
      },
      {
        title: 'Huurprijs en indexatie',
        body:
          'Vergelijk uw huurprijs met het indicatieve Brusselse huurrooster en ' +
          'controleer of een indexatie correct berekend is.',
      },
      {
        title: 'Contract en gebreken',
        body:
          'Een scan van uw huurcontract tegen een checklist van clausules die ' +
          'nazicht verdienen, plus kant-en-klare brieven om een gebrek te melden.',
      },
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
      "Documentez votre logement à l'entrée et à la sortie, surveillez le délai " +
      'dans lequel votre garantie locative doit être libérée, et vérifiez que ' +
      'votre loyer et son indexation sont corrects.',
    pillars: [
      {
        title: "État des lieux avec intégrité de preuve",
        body:
          'Une liste de photos guidée, pièce par pièce. Chaque photo reçoit à la ' +
          "réception une empreinte numérique (SHA-256) et un horodatage de notre " +
          'serveur. Les deux figurent dans le rapport.',
      },
      {
        title: 'Récupération de la garantie',
        body:
          'Nous calculons le délai légal à partir de la réglementation ' +
          'bruxelloise, vous envoyons des rappels, et rédigeons une mise en ' +
          'demeure à partir d’un modèle fixe avec indication des sources.',
      },
      {
        title: 'Loyer et indexation',
        body:
          'Comparez votre loyer à la grille indicative bruxelloise et vérifiez ' +
          "qu'une indexation a été correctement calculée.",
      },
      {
        title: 'Bail et défauts',
        body:
          'Une analyse de votre bail au regard d’une liste de clauses qui ' +
          'méritent vérification, ainsi que des courriers prêts à l’emploi pour ' +
          'signaler un défaut.',
      },
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
        {copy.pillars.map((pillar) => (
          <Card key={pillar.title}>
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              {pillar.title}
            </h2>
            <p className="text-sm text-slate-700">{pillar.body}</p>
          </Card>
        ))}
      </section>

      <section className="mt-8 space-y-4">
        <Alert tone="warning" title={copy.honesty.title}>
          <p>{copy.honesty.body}</p>
        </Alert>
        <DisclaimerNotice locale={locale} />
      </section>

      <footer className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6 text-sm text-slate-600">
        <span>{t.common.tagline}</span>
        <Link
          href={`/${locale === 'nl' ? 'fr' : 'nl'}`}
          className="underline underline-offset-2"
          hrefLang={locale === 'nl' ? 'fr' : 'nl'}
        >
          {locale === 'nl' ? 'Français' : 'Nederlands'}
        </Link>
      </footer>
    </main>
  );
}
