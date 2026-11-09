import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isLocale, type Locale } from '@/i18n/config';
import { LegalDocument, type LegalSection } from '@/components/legal/legal-document';
import { formatEntityAddress, getLegalEntity } from '@/lib/legal/entity';

export const metadata: Metadata = { title: 'Voorwaarden — RentGuard Brussels' };

const UPDATED = '2026-10-24';

function sections(locale: Locale): LegalSection[] {
  const e = getLegalEntity();
  const address = formatEntityAddress(e);

  if (locale === 'fr') {
    return [
      {
        title: '1. Exploitant',
        paragraphs: [
          `RentGuard Brussels est un service de ${e.name}, ${address}, numéro d’entreprise ${e.vatNumber}, e-mail ${e.email} (« nous »).`,
        ],
      },
      {
        title: '2. Le service',
        paragraphs: [
          'RentGuard vous aide à documenter votre logement à l’entrée et à la sortie (photos avec empreinte numérique et horodatage serveur, rapports PDF), à comparer les deux dossiers avec une analyse IA que vous validez, et à inviter votre bailleur à contresigner.',
          'Nous ne sommes pas un cabinet d’avocats et ne donnons pas de conseil juridique. Un dossier photographique établi par vous seul est un élément de preuve que le juge apprécie librement ; il ne remplace pas un état des lieux contradictoire. Nous ne garantissons aucun résultat.',
        ],
      },
      {
        title: '3. Compte',
        paragraphs: [
          'Vous devez avoir 18 ans et fournir des données exactes. Vous êtes responsable de la confidentialité de votre mot de passe. Vous ne téléversez que des photos que vous avez le droit de prendre et évitez de photographier des tiers.',
        ],
      },
      {
        title: '4. Prix et paiement',
        paragraphs: [
          'Le premier dossier d’entrée pour un logement est gratuit. Les formules payantes, leur contenu et leur prix (TVA comprise) sont affichés sur la page « Formules » avant l’achat. Le paiement est traité par Stripe (carte, Bancontact). Un forfait unique vaut pour un seul logement. L’accès est activé après confirmation du paiement.',
        ],
      },
      {
        title: '5. Droit de rétractation',
        paragraphs: [
          'En tant que consommateur, vous disposez en principe d’un délai de 14 jours à compter de la conclusion du contrat pour vous rétracter, sans motif.',
          'Avant le paiement, vous demandez expressément que le service commence immédiatement et reconnaissez perdre votre droit de rétractation dès que le service a été entièrement exécuté (art. VI.53, 1° CDE). Si vous vous rétractez avant l’exécution complète, vous payez un montant proportionnel au service déjà fourni (art. VI.51 §3 CDE).',
          `Pour vous rétracter, envoyez une déclaration claire à ${e.email}, par exemple : « Je vous notifie par la présente ma rétractation du contrat portant sur le service suivant : [formule], commandé le [date], nom, adresse e-mail du compte, date. » Nous remboursons dans les 14 jours via le moyen de paiement utilisé.`,
        ],
      },
      {
        title: '6. Analyse IA',
        paragraphs: [
          'L’analyse IA est une aide : elle peut se tromper. Vous confirmez ou corrigez chaque classification ; c’est votre avis qui figure dans le rapport.',
        ],
      },
      {
        title: '7. Responsabilité',
        paragraphs: [
          'Nous mettons tout en œuvre pour un service fiable mais ne pouvons garantir une disponibilité ininterrompue. Sauf faute intentionnelle ou grave de notre part, notre responsabilité est limitée au montant que vous avez payé pour le service concerné au cours des 12 derniers mois. Cette limitation ne porte pas atteinte à vos droits impératifs de consommateur. Conservez une copie de vos rapports PDF.',
        ],
      },
      {
        title: '8. Fin',
        paragraphs: [
          'Vous pouvez supprimer votre compte à tout moment via une demande à notre adresse e-mail. Un abonnement peut être résilié à la fin de la période en cours. Nous pouvons suspendre un compte en cas d’abus.',
        ],
      },
      {
        title: '9. Plaintes et droit applicable',
        paragraphs: [
          `Plaintes : ${e.email}. Vous pouvez aussi vous adresser au Service de Médiation pour le Consommateur (www.mediationconsommateur.be). Le droit belge s’applique. Les litiges relèvent des tribunaux compétents selon les règles impératives de protection du consommateur.`,
        ],
      },
    ];
  }

  return [
    {
      title: '1. Uitbater',
      paragraphs: [
        `RentGuard Brussels is een dienst van ${e.name}, ${address}, ondernemingsnummer ${e.vatNumber}, e-mail ${e.email} ("wij").`,
      ],
    },
    {
      title: '2. De dienst',
      paragraphs: [
        'RentGuard helpt u uw woning te documenteren bij intrek en vertrek (foto’s met gegevensvingerafdruk en servertijdstempel, PDF-rapporten), beide dossiers te vergelijken met een AI-analyse die u zelf bevestigt, en uw verhuurder uit te nodigen om mee te ondertekenen.',
        'Wij zijn geen advocatenkantoor en geven geen juridisch advies. Een fotodossier dat u alleen opmaakt, is bewijsmateriaal dat een rechter vrij beoordeelt; het vervangt geen tegensprekelijke plaatsbeschrijving. Wij garanderen geen enkele uitkomst.',
      ],
    },
    {
      title: '3. Account',
      paragraphs: [
        'U bent minstens 18 jaar en geeft juiste gegevens op. U houdt uw wachtwoord geheim. U uploadt alleen foto’s die u mag maken en fotografeert liefst geen derden.',
      ],
    },
    {
      title: '4. Prijzen en betaling',
      paragraphs: [
        'Het eerste intrekdossier voor één woning is gratis. De betalende formules, hun inhoud en prijs (inclusief btw) staan vóór de aankoop op de pagina "Formules". De betaling verloopt via Stripe (kaart, Bancontact). Een eenmalig pakket geldt voor één woning. De toegang wordt geactiveerd zodra de betaling bevestigd is.',
      ],
    },
    {
      title: '5. Herroepingsrecht',
      paragraphs: [
        'Als consument hebt u in principe 14 dagen vanaf het sluiten van de overeenkomst om zonder opgave van reden af te zien van de aankoop.',
        'Vóór de betaling vraagt u uitdrukkelijk dat de dienst onmiddellijk start en erkent u dat u uw herroepingsrecht verliest zodra de dienst volledig is uitgevoerd (art. VI.53, 1° WER). Herroept u vóór de volledige uitvoering, dan betaalt u een bedrag in verhouding tot wat al geleverd is (art. VI.51 §3 WER).',
        `Om te herroepen stuurt u een duidelijke verklaring naar ${e.email}, bijvoorbeeld: "Hierbij deel ik mee dat ik de overeenkomst voor de volgende dienst herroep: [formule], besteld op [datum], naam, e-mailadres van het account, datum." Wij betalen binnen 14 dagen terug via het gebruikte betaalmiddel.`,
      ],
    },
    {
      title: '6. AI-analyse',
      paragraphs: [
        'De AI-analyse is een hulpmiddel en kan zich vergissen. U bevestigt of corrigeert elke classificatie; uw oordeel staat in het rapport.',
      ],
    },
    {
      title: '7. Aansprakelijkheid',
      paragraphs: [
        'Wij doen ons best voor een betrouwbare dienst, maar kunnen geen ononderbroken beschikbaarheid garanderen. Behalve bij opzet of zware fout is onze aansprakelijkheid beperkt tot het bedrag dat u in de voorbije 12 maanden voor de betrokken dienst betaalde. Dit doet geen afbreuk aan uw dwingende rechten als consument. Bewaar een kopie van uw PDF-rapporten.',
      ],
    },
    {
      title: '8. Einde',
      paragraphs: [
        'U kunt uw account altijd laten verwijderen via een verzoek aan ons e-mailadres. Een abonnement is opzegbaar tegen het einde van de lopende periode. Bij misbruik kunnen wij een account opschorten.',
      ],
    },
    {
      title: '9. Klachten en toepasselijk recht',
      paragraphs: [
        `Klachten: ${e.email}. U kunt ook terecht bij de Consumentenombudsdienst (www.consumentenombudsdienst.be). Het Belgisch recht is van toepassing. Geschillen behoren tot de bevoegde rechtbanken volgens de dwingende regels van consumentenbescherming.`,
      ],
    },
  ];
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <LegalDocument
      locale={locale}
      title={locale === 'nl' ? 'Algemene voorwaarden' : 'Conditions générales'}
      updated={UPDATED}
      sections={sections(locale)}
    />
  );
}
