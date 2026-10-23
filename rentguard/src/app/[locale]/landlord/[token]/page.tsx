import { notFound } from 'next/navigation';

import { isLocale, type Locale } from '@/i18n/config';
import { resolveLandlordToken } from '@/lib/inspections/landlord-token';
import { Alert, Card, CardHeader } from '@/components/ui/surface';
import { buttonVariants } from '@/components/ui/button';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { DisclaimerNotice } from '@/components/legal/legal-notices';
import { LandlordSignForm } from '@/components/inspections/landlord-sign-form';
import { DISCLAIMER } from '@/lib/legal/disclaimer';

const COPY: Record<
  Locale,
  Record<string, string>
> = {
  nl: {
    title: 'Fotodossier van de woning',
    intro:
      'Uw huurder heeft een fotodossier van de woning opgemaakt en nodigt u uit ' +
      'om het te bekijken en, als u het eens bent met de vaststellingen, mee te ' +
      'ondertekenen.',
    notObliged:
      'U bent hiertoe niet verplicht. Ondertekenen betekent dat u bevestigt de ' +
      'inhoud te hebben gezien en te aanvaarden. Het is geen erkenning van ' +
      'aansprakelijkheid en geen afstand van welk recht dan ook.',
    whatIsIt: 'Wat is dit dossier?',
    whatIsItBody:
      'Het is een reeks foto’s die de huurder zelf heeft gemaakt. Bij elke foto ' +
      'is een gegevensvingerafdruk en het tijdstip van registratie vastgelegd. ' +
      'Het is geen tegensprekelijke plaatsbeschrijving door een deskundige.',
    property: 'Woning',
    type: 'Type',
    checkIn: 'Bij intrek',
    checkOut: 'Bij vertrek',
    date: 'Datum van vaststelling',
    tenant: 'Huurder',
    photos: 'Aantal foto’s',
    rooms: 'Aantal ruimtes',
    viewReport: 'Rapport bekijken (PDF)',
    signTitle: 'Mee ondertekenen',
    signedTitle: 'U hebt dit dossier ondertekend',
    signedBody: 'Ondertekend door {name} op {date}.',
    expiredTitle: 'Deze link is verlopen',
    expiredBody:
      'Uitnodigingslinks blijven dertig dagen geldig. Vraag uw huurder om een ' +
      'nieuwe link.',
    notFoundTitle: 'Deze link is niet geldig',
    notFoundBody:
      'Mogelijk is de link onvolledig gekopieerd of ingetrokken. Vraag uw ' +
      'huurder om een nieuwe link.',
    privacy:
      'Wij verwerken uw naam en, bij ondertekening, het tijdstip en uw ' +
      'IP-adres. Dat gebeurt uitsluitend om vast te leggen dat u dit dossier ' +
      'hebt bevestigd.',
  },
  fr: {
    title: 'Dossier photographique du logement',
    intro:
      'Votre locataire a établi un dossier photographique du logement et vous ' +
      'invite à le consulter et, si vous êtes d’accord avec les constatations, ' +
      'à le cosigner.',
    notObliged:
      'Vous n’y êtes pas obligé. Cosigner signifie que vous confirmez avoir vu ' +
      'et accepté le contenu. Ce n’est pas une reconnaissance de ' +
      'responsabilité ni une renonciation à un quelconque droit.',
    whatIsIt: 'Qu’est-ce que ce dossier ?',
    whatIsItBody:
      'Il s’agit d’une série de photos prises par le locataire lui-même. Pour ' +
      'chaque photo, une empreinte numérique et l’heure d’enregistrement ont ' +
      'été consignées. Ce n’est pas un état des lieux contradictoire établi par ' +
      'un expert.',
    property: 'Logement',
    type: 'Type',
    checkIn: 'À l’entrée',
    checkOut: 'À la sortie',
    date: 'Date de la constatation',
    tenant: 'Locataire',
    photos: 'Nombre de photos',
    rooms: 'Nombre de pièces',
    viewReport: 'Consulter le rapport (PDF)',
    signTitle: 'Cosigner',
    signedTitle: 'Vous avez signé ce dossier',
    signedBody: 'Signé par {name} le {date}.',
    expiredTitle: 'Ce lien a expiré',
    expiredBody:
      'Les liens d’invitation restent valables trente jours. Demandez un ' +
      'nouveau lien à votre locataire.',
    notFoundTitle: 'Ce lien n’est pas valide',
    notFoundBody:
      'Le lien a peut-être été copié de manière incomplète ou révoqué. ' +
      'Demandez un nouveau lien à votre locataire.',
    privacy:
      'Nous traitons votre nom et, en cas de signature, l’heure et votre ' +
      'adresse IP. Cela sert uniquement à établir que vous avez confirmé ce ' +
      'dossier.',
  },
};

export default async function LandlordPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();

  const t = COPY[locale];
  const resolved = await resolveLandlordToken(token);

  if (resolved === 'NOT_FOUND' || resolved === 'EXPIRED') {
    return (
      <main className="mx-auto max-w-2xl px-5 py-10">
        <Alert tone="warning" title={resolved === 'EXPIRED' ? t.expiredTitle : t.notFoundTitle}>
          <p>{resolved === 'EXPIRED' ? t.expiredBody : t.notFoundBody}</p>
        </Alert>
      </main>
    );
  }

  const { inspection, property, photoCount, roomCount, tenantName } = resolved;
  const isSigned = Boolean(inspection.landlord_signed_at);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 py-10">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-slate-700">{t.intro}</p>
      </header>

      <Alert tone="info" title={t.whatIsIt}>
        <p>{t.whatIsItBody}</p>
      </Alert>

      <Card>
        <dl className="space-y-2 text-sm">
          <Row label={t.property} value={`${property.address}, ${property.postal_code} ${property.municipality}`} />
          <Row
            label={t.type}
            value={inspection.type === 'CHECK_IN' ? t.checkIn : t.checkOut}
          />
          <Row
            label={t.date}
            value={formatDate(inspection.inspection_date, locale)}
          />
          <Row label={t.tenant} value={tenantName} />
          <Row label={t.rooms} value={String(roomCount)} />
          <Row label={t.photos} value={String(photoCount)} />
        </dl>

        <div className="mt-5">
          <a
            href={`/api/landlord/${token}/report?locale=${locale}`}
            className={cn(buttonVariants({ size: 'lg' }))}
          >
            {t.viewReport}
          </a>
        </div>
      </Card>

      {isSigned ? (
        <Alert tone="success" title={t.signedTitle}>
          <p>
            {t.signedBody
              .replace('{name}', inspection.landlord_signature_name ?? '—')
              .replace(
                '{date}',
                formatDateTime(inspection.landlord_signed_at, locale),
              )}
          </p>
        </Alert>
      ) : (
        <Card>
          <CardHeader title={t.signTitle} description={t.notObliged} />
          <LandlordSignForm locale={locale} token={token} />
          <p className="mt-4 text-xs text-slate-600">{t.privacy}</p>
        </Card>
      )}

      <DisclaimerNotice locale={locale} />
      <p className="text-xs text-slate-500">{DISCLAIMER[locale]}</p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
