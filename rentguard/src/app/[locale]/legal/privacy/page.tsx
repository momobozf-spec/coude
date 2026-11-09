import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isLocale, type Locale } from '@/i18n/config';
import { LegalDocument, type LegalSection } from '@/components/legal/legal-document';
import { formatEntityAddress, getLegalEntity } from '@/lib/legal/entity';

export const metadata: Metadata = { title: 'Privacy — RentGuard Brussels' };

const UPDATED = '2026-10-24';

function sections(locale: Locale): LegalSection[] {
  const e = getLegalEntity();
  const who = `${e.name}, ${formatEntityAddress(e)}, ${
    locale === 'nl' ? 'ondernemingsnummer' : 'numéro d’entreprise'
  } ${e.vatNumber}, ${e.email}`;

  if (locale === 'fr') {
    return [
      {
        title: '1. Responsable du traitement',
        paragraphs: [
          `RentGuard Brussels est exploité par ${who}. Pour toute question relative à vos données, écrivez à ${e.email}.`,
        ],
      },
      {
        title: '2. Données traitées, finalités et bases juridiques',
        paragraphs: [
          'Nous ne traitons que ce qui est nécessaire pour vous fournir le service.',
        ],
        list: [
          'Compte : nom, adresse e-mail, langue. Finalité : fournir le service et communiquer. Base : exécution du contrat (art. 6.1.b RGPD).',
          'Logement et bail : adresse, loyer, garantie, dates du bail, label PEB. Finalité : constituer votre dossier. Base : exécution du contrat.',
          'Photos du logement et métadonnées (EXIF, éventuellement la position GPS), empreinte SHA-256 et horodatage serveur. Finalité : dossier de preuve d’entrée et de sortie. Base : exécution du contrat. Les photos d’un intérieur peuvent révéler des informations personnelles : évitez de photographier des personnes ou des documents.',
          'Données du bailleur (nom, adresse, e-mail) que vous saisissez. Finalité : uniquement l’invitation à contresigner et l’adressage de vos courriers. Base : intérêt légitime (art. 6.1.f) à exercer vos droits de locataire.',
          'Paiements : traités par Stripe. Nous recevons le statut du paiement et un identifiant client, jamais vos données de carte. Base : exécution du contrat et obligations comptables (art. 6.1.c).',
          'Journal d’accès (qui a consulté ou envoyé quel document, date, adresse IP). Finalité : sécurité. Base : intérêt légitime. Sans contenu des documents.',
        ],
      },
      {
        title: '3. Analyse par IA',
        paragraphs: [
          'Uniquement lorsque vous lancez une comparaison entrée/sortie, les paires de photos concernées sont envoyées à Anthropic (États-Unis) pour une analyse usure/dégât. Anthropic agit en tant que sous-traitant. Le transfert hors UE repose sur les clauses contractuelles types de la Commission européenne ou le cadre UE–États-Unis de protection des données, selon le cas. Le résultat est une suggestion : vous décidez.',
        ],
      },
      {
        title: '4. Sous-traitants et destinataires',
        paragraphs: ['Nous faisons appel aux prestataires suivants, liés par un contrat de sous-traitance :'],
        list: [
          'Supabase — base de données, authentification et stockage des photos (région UE).',
          'Vercel — hébergement de l’application.',
          'Anthropic — analyse IA des photos, uniquement à votre demande.',
          'Resend — e-mails transactionnels (confirmation, invitation du bailleur).',
          'Stripe — traitement des paiements (également responsable de traitement pour ses propres obligations).',
        ],
      },
      {
        title: '5. Durées de conservation',
        list: [
          'Compte : jusqu’à sa suppression.',
          'Dossiers d’un logement : par défaut 2 ans après la fin du bail. Attention : les actions découlant d’un bail se prescrivent en principe par 10 ans ; vous pouvez demander une conservation plus longue.',
          'Données de facturation : pendant le délai légal de conservation comptable.',
          'Journal d’accès : 12 mois.',
        ],
        paragraphs: [],
      },
      {
        title: '6. Vos droits',
        paragraphs: [
          `Vous avez un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité. Envoyez votre demande à ${e.email} ; nous répondons dans un délai d’un mois. Le bailleur dont les données figurent dans un dossier peut exercer les mêmes droits via cette adresse.`,
          'Vous pouvez introduire une plainte auprès de l’Autorité de protection des données, rue de la Presse 35, 1000 Bruxelles, www.autoriteprotectiondonnees.be.',
        ],
      },
      {
        title: '7. Cookies',
        paragraphs: [
          'Nous n’utilisons que des cookies strictement nécessaires (session de connexion et choix de langue). Pas de cookies publicitaires ni de mesure d’audience.',
        ],
      },
      {
        title: '8. Sécurité',
        paragraphs: [
          'Connexions chiffrées (HTTPS), stockage privé des photos, contrôle d’accès par utilisateur au niveau de la base de données (Row Level Security), liens bailleur à usage limité et expirant.',
        ],
      },
    ];
  }

  return [
    {
      title: '1. Verwerkingsverantwoordelijke',
      paragraphs: [
        `RentGuard Brussels wordt uitgebaat door ${who}. Voor vragen over uw gegevens schrijft u naar ${e.email}.`,
      ],
    },
    {
      title: '2. Welke gegevens, waarom en op welke grondslag',
      paragraphs: ['Wij verwerken alleen wat nodig is om de dienst te leveren.'],
      list: [
        'Account: naam, e-mailadres, taal. Doel: de dienst leveren en communiceren. Grondslag: uitvoering van de overeenkomst (art. 6.1.b AVG).',
        'Woning en huur: adres, huurprijs, waarborg, contractdata, EPB-label. Doel: uw dossier opbouwen. Grondslag: uitvoering van de overeenkomst.',
        'Foto’s van de woning en metadata (EXIF, eventueel GPS-locatie), SHA-256-vingerafdruk en servertijdstempel. Doel: bewijsdossier bij intrek en vertrek. Grondslag: uitvoering van de overeenkomst. Foto’s van een interieur kunnen persoonlijke informatie onthullen: fotografeer liefst geen personen of documenten.',
        'Gegevens van de verhuurder (naam, adres, e-mail) die u invult. Doel: uitsluitend de uitnodiging tot medeondertekening en het adresseren van uw brieven. Grondslag: gerechtvaardigd belang (art. 6.1.f) om uw rechten als huurder uit te oefenen.',
        'Betalingen: verwerkt door Stripe. Wij ontvangen de betaalstatus en een klant-ID, nooit uw kaartgegevens. Grondslag: uitvoering van de overeenkomst en boekhoudkundige verplichtingen (art. 6.1.c).',
        'Toegangslogboek (wie welk document opende of verstuurde, tijdstip, IP-adres). Doel: beveiliging. Grondslag: gerechtvaardigd belang. Zonder inhoud van documenten.',
      ],
    },
    {
      title: '3. AI-analyse',
      paragraphs: [
        'Alleen wanneer u een vergelijking intrek/vertrek start, worden de betrokken fotoparen naar Anthropic (Verenigde Staten) gestuurd voor een analyse slijtage/schade. Anthropic treedt op als verwerker. De doorgifte buiten de EU steunt, naargelang het geval, op de modelcontractbepalingen van de Europese Commissie of het EU-VS-gegevensprivacykader. Het resultaat is een voorstel: u beslist.',
      ],
    },
    {
      title: '4. Verwerkers en ontvangers',
      paragraphs: ['Wij werken met de volgende dienstverleners, gebonden door een verwerkersovereenkomst:'],
      list: [
        'Supabase — databank, aanmelding en opslag van foto’s (EU-regio).',
        'Vercel — hosting van de applicatie.',
        'Anthropic — AI-analyse van foto’s, alleen op uw vraag.',
        'Resend — transactionele e-mails (bevestiging, uitnodiging verhuurder).',
        'Stripe — betalingsverwerking (voor eigen verplichtingen ook zelfstandig verantwoordelijke).',
      ],
    },
    {
      title: '5. Bewaartermijnen',
      paragraphs: [],
      list: [
        'Account: tot u het verwijdert.',
        'Dossiers van een woning: standaard 2 jaar na het einde van de huur. Let op: vorderingen uit een huurovereenkomst verjaren in principe pas na 10 jaar; u kunt een langere bewaring vragen.',
        'Facturatiegegevens: gedurende de wettelijke boekhoudkundige bewaartermijn.',
        'Toegangslogboek: 12 maanden.',
      ],
    },
    {
      title: '6. Uw rechten',
      paragraphs: [
        `U hebt recht op inzage, verbetering, wissing, beperking, bezwaar en overdraagbaarheid. Stuur uw verzoek naar ${e.email}; wij antwoorden binnen een maand. Een verhuurder wiens gegevens in een dossier staan, kan dezelfde rechten via dit adres uitoefenen.`,
        'U kunt klacht indienen bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel, www.gegevensbeschermingsautoriteit.be.',
      ],
    },
    {
      title: '7. Cookies',
      paragraphs: [
        'Wij gebruiken alleen strikt noodzakelijke cookies (aanmeldsessie en taalkeuze). Geen advertentie- of analysecookies.',
      ],
    },
    {
      title: '8. Beveiliging',
      paragraphs: [
        'Versleutelde verbindingen (HTTPS), private opslag van foto’s, toegangscontrole per gebruiker op databankniveau (Row Level Security), verhuurderslinks die beperkt geldig zijn en vervallen.',
      ],
    },
  ];
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <LegalDocument
      locale={locale}
      title={locale === 'nl' ? 'Privacyverklaring' : 'Déclaration de confidentialité'}
      updated={UPDATED}
      sections={sections(locale)}
    />
  );
}
