import type { Locale } from '@/i18n/config';

/**
 * Eén bron van waarheid voor de juridische disclaimer. Elke PDF, elk
 * audit-resultaat en elk antwoord van de assistent haalt de tekst hier op,
 * zodat ze nergens per ongeluk kan ontbreken.
 *
 * Zie docs/decisions/0003-bewijswaarde-framing.md.
 */

export const DISCLAIMER: Record<Locale, string> = {
  nl:
    'RentGuard levert informatie en hulpmiddelen, geen juridisch advies. ' +
    'Voor uw concrete situatie kunt u terecht bij de Huurdersbond of bij de ' +
    'juridische eerstelijnsbijstand.',
  fr:
    'RentGuard fournit des informations et des outils, pas de conseil ' +
    "juridique. Pour votre situation concrète, adressez-vous au Syndicat des " +
    "locataires ou à l'aide juridique de première ligne.",
};

/** Uitleg over wat een hash en tijdstempel wél en niet aantonen. */
export const EVIDENCE_EXPLAINER: Record<Locale, { proves: string[]; doesNotProve: string[] }> = {
  nl: {
    proves: [
      'Het bestand is sinds het geregistreerde tijdstip niet gewijzigd.',
      'Het tijdstip van registratie op onze server staat vast.',
      'De volgorde waarin de foto’s zijn geregistreerd staat vast.',
    ],
    doesNotProve: [
      'Wanneer de foto werkelijk genomen is — die datum komt uit de camera en is aanpasbaar.',
      'Waar de foto genomen is, tenzij de camera locatiegegevens meegaf.',
      'Dat de foto de woning in kwestie toont.',
      'Het is geen gekwalificeerd tijdstempel onder eIDAS.',
    ],
  },
  fr: {
    proves: [
      "Le fichier n'a pas été modifié depuis l'horodatage enregistré.",
      "L'heure d'enregistrement sur notre serveur est établie.",
      "L'ordre dans lequel les photos ont été enregistrées est établi.",
    ],
    doesNotProve: [
      "Quand la photo a réellement été prise — cette date provient de l'appareil et est modifiable.",
      "Où la photo a été prise, sauf si l'appareil a transmis des données de localisation.",
      'Que la photo montre bien le logement concerné.',
      "Il ne s'agit pas d'un horodatage qualifié au sens du règlement eIDAS.",
    ],
  },
};

/**
 * De drie niveaus van bewijskracht die de app onderscheidt. De UI toont altijd
 * op welk niveau de gebruiker zit.
 */
export type EvidenceLevel =
  | 'UNILATERAL_REPORT'
  | 'COUNTERSIGNED_REPORT'
  | 'EXPERT_INSPECTION';

export const EVIDENCE_LEVELS: Record<
  Locale,
  Record<EvidenceLevel, { title: string; description: string }>
> = {
  nl: {
    UNILATERAL_REPORT: {
      title: 'Eenzijdig fotodossier',
      description:
        'Door u alleen opgemaakt. Dit is bewijsmateriaal dat een rechter vrij ' +
        'beoordeelt. Het vervangt geen tegensprekelijke plaatsbeschrijving.',
    },
    COUNTERSIGNED_REPORT: {
      title: 'Medeondertekend fotodossier',
      description:
        'Uw verhuurder heeft de inhoud via de uitnodigingslink bevestigd. Dat ' +
        'is aanzienlijk sterker, want de tegenpartij heeft de vaststellingen ' +
        'aanvaard. Het blijft een dossier dat u zelf hebt opgemaakt.',
    },
    EXPERT_INSPECTION: {
      title: 'Tegensprekelijke plaatsbeschrijving door een deskundige',
      description:
        'Wat de wet bedoelt met een plaatsbeschrijving. Dit levert RentGuard ' +
        'niet. Voor een betwisting met veel op het spel is dit de aangewezen weg.',
    },
  },
  fr: {
    UNILATERAL_REPORT: {
      title: 'Dossier photographique unilatéral',
      description:
        "Établi par vous seul. Il s'agit d'un élément de preuve que le juge " +
        "apprécie librement. Il ne remplace pas un état des lieux contradictoire.",
    },
    COUNTERSIGNED_REPORT: {
      title: 'Dossier photographique cosigné',
      description:
        'Votre bailleur a confirmé le contenu via le lien d’invitation. ' +
        "C'est nettement plus solide, car la partie adverse a accepté les " +
        'constatations. Cela reste un dossier que vous avez établi vous-même.',
    },
    EXPERT_INSPECTION: {
      title: 'État des lieux contradictoire par un expert',
      description:
        "Ce que la loi entend par état des lieux. RentGuard ne le fournit pas. " +
        'Pour un litige aux enjeux importants, c’est la voie indiquée.',
    },
  },
};
