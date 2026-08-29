/**
 * Registry-seed: reference-data, geen demo-data.
 *
 * Alles hieronder komt uit `docs/gemeenten.md` en is daar terug te voeren op een
 * officiële bron met raadpleegdatum. Wat daar niet gestaafd kon worden, staat
 * hier leeg met `verificationStatus: UNVERIFIED` en een `verificationNote` die
 * zegt wát er ontbreekt.
 *
 * ─── DE REGEL DIE HIER GELDT ────────────────────────────────────────────────
 *
 * Nooit een e-mailadres, tarief of documentvereiste invullen dat niet op een
 * officiële pagina gelezen is. Bij het onderzoek noemden zoekresultaten drie
 * gemeentelijke e-mailadressen; bij het rechtstreeks openen van de officiële
 * pagina's bleef er één van over. De andere twee staan daarom niet in deze
 * seed. Een verzonnen indieningsadres stuurt iemands identiteitskaart naar een
 * vreemde — dat is de ernstigste storing die dit product kan hebben.
 *
 * De seed is idempotent: hij draait op een bestaande database zonder dubbele
 * entries en zonder handmatige verificaties van een beheerder te overschrijven.
 */
import {
  CardManager,
  DocType,
  DossierType,
  Language,
  PrismaClient,
  SubmissionChannelType,
  VerificationStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

/** Datum waarop het onderzoek in docs/gemeenten.md is uitgevoerd. */
const RESEARCHED_AT = new Date('2026-08-29T00:00:00.000Z')
const RESEARCHED_BY = 'seed:onderzoek-2026-08-29'

const PARKING_BRUSSELS_POST = 'parking.brussels, Gasthuisstraat 31, 1000 Brussel'
const PARKING_BRUSSELS_PORTAL = 'https://parking.brussels/nl/e-loket'
const PARKING_BRUSSELS_FAQ =
  'https://parking.brussels/nl/contact-en-support/parkeerkaarten-faq'
const PARKING_BRUSSELS_INDEX =
  'https://parking.brussels/nl/je-auto-parkeren/gemeentelijke-parkeerkaarten'

interface RequiredDoc {
  dossierType: DossierType
  docType: DocType
  required?: boolean
  hintNl?: string
  hintFr?: string
  sourceUrl?: string
}

interface MunicipalitySeed {
  slug: string
  nameNl: string
  nameFr: string
  postcodes: string[]
  cardManager: CardManager
  primaryChannel?: SubmissionChannelType
  submissionEmail?: string
  portalUrl?: string
  postalAddress?: string
  counterInfo?: string
  firstCardPriceCents?: number
  secondCardPriceCents?: number
  validityMonths?: number
  maxCardsPerHousehold?: number
  notesNl?: string
  notesFr?: string
  verificationStatus: VerificationStatus
  sourceUrls: string[]
  verificationNote?: string
  requiredDocuments?: RequiredDoc[]
}

/**
 * De documentlijst die parking.brussels op elke gemeentepagina identiek
 * formuleert. Bevestigd op Anderlecht, Elsene, Vorst en Schaarbeek.
 */
function parkingBrusselsDocuments(sourceUrl: string): RequiredDoc[] {
  const base: Array<[DocType, string, string, boolean]> = [
    [DocType.ID_CARD, 'Recto-verso', 'Recto-verso', true],
    [
      DocType.VEHICLE_REGISTRATION,
      'Inschrijvingsbewijs, recto-verso',
      "Certificat d'immatriculation, recto-verso",
      true,
    ],
    [
      DocType.INSURANCE_POLICY,
      'Alleen bij een voertuig van een derde: polis met jou als hoofdbestuurder',
      "Uniquement pour un véhicule d'un tiers : police avec vous comme conducteur principal",
      false,
    ],
    [
      DocType.EMPLOYER_CERTIFICATE,
      'Alleen bij een bedrijfswagen: attest dat jij de hoofdgebruiker bent',
      'Uniquement pour un véhicule de société : attestation de conducteur principal',
      false,
    ],
    [
      DocType.LEASE_CONTRACT,
      'Alleen bij leasing of huur: contract op jouw naam',
      'Uniquement en cas de leasing ou location : contrat à votre nom',
      false,
    ],
  ]

  // Dezelfde stukken gelden voor elk aanvraagtype dat we ondersteunen. Bij een
  // adreswijziging vraagt de administratie bovendien een bewijs van de nieuwe
  // woonplaats.
  const types = [
    DossierType.NEW_CARD,
    DossierType.PLATE_CHANGE,
    DossierType.ADDRESS_CHANGE,
    DossierType.TEMPORARY_VEHICLE,
  ]

  const docs: RequiredDoc[] = []
  for (const dossierType of types) {
    for (const [docType, hintNl, hintFr, required] of base) {
      docs.push({ dossierType, docType, required, hintNl, hintFr, sourceUrl })
    }
  }

  docs.push({
    dossierType: DossierType.ADDRESS_CHANGE,
    docType: DocType.RESIDENCE_PROOF,
    required: true,
    hintNl: 'Bewijs van je nieuwe woonplaats in deze gemeente',
    hintFr: 'Preuve de votre nouvelle résidence dans cette commune',
    sourceUrl,
  })

  docs.push({
    dossierType: DossierType.TEMPORARY_VEHICLE,
    docType: DocType.GARAGE_CERTIFICATE,
    required: true,
    hintNl: 'Garageattest met de duur van de immobilisatie',
    hintFr: "Attestation du garage mentionnant la durée de l'immobilisation",
    sourceUrl,
  })

  return docs
}

/** Een parking.brussels-gemeente waarvan alleen beheerder en kanaal vaststaan. */
function unverifiedParkingBrussels(
  slug: string,
  nameNl: string,
  nameFr: string,
  postcodes: string[],
): MunicipalitySeed {
  return {
    slug,
    nameNl,
    nameFr,
    postcodes,
    cardManager: CardManager.PARKING_BRUSSELS,
    // Kanaal en postadres staan wél vast: ze zijn centraal geregeld en op de
    // index van parking.brussels terug te vinden.
    primaryChannel: SubmissionChannelType.POST,
    portalUrl: PARKING_BRUSSELS_PORTAL,
    postalAddress: PARKING_BRUSSELS_POST,
    verificationStatus: VerificationStatus.UNVERIFIED,
    sourceUrls: [PARKING_BRUSSELS_INDEX, PARKING_BRUSSELS_FAQ],
    verificationNote:
      'Beheerder en indieningskanaal zijn bevestigd via parking.brussels. Tarieven ' +
      'en de exacte documentlijst zijn niet individueel nagelezen en staan daarom leeg.',
  }
}

const MUNICIPALITIES: MunicipalitySeed[] = [
  // ── Volledig nagelezen parking.brussels-gemeenten ─────────────────────────
  {
    slug: 'anderlecht',
    nameNl: 'Anderlecht',
    nameFr: 'Anderlecht',
    postcodes: ['1070'],
    cardManager: CardManager.PARKING_BRUSSELS,
    primaryChannel: SubmissionChannelType.POST,
    portalUrl: PARKING_BRUSSELS_PORTAL,
    postalAddress: PARKING_BRUSSELS_POST,
    firstCardPriceCents: 3000,
    secondCardPriceCents: 15000,
    validityMonths: 12,
    maxCardsPerHousehold: 2,
    notesNl:
      'Maximaal 2 kaarten per gezin voor de hoofdverblijfplaats, plus 1 voor een ' +
      'tweede verblijf (€550/jaar). Voertuigen langer dan 5 m: +€150 per jaar. ' +
      'Geldig in de blauwe, groene en grijze zones van Anderlecht.',
    notesFr:
      'Maximum 2 cartes par ménage pour la résidence principale, plus 1 pour une ' +
      'seconde résidence (550 €/an). Véhicules de plus de 5 m : +150 €/an.',
    verificationStatus: VerificationStatus.VERIFIED,
    sourceUrls: [
      'https://parking.brussels/en/park-your-car/municipal-parking-permits-and-parking-information/anderlecht/anderlecht-resident-card',
      PARKING_BRUSSELS_FAQ,
    ],
    requiredDocuments: parkingBrusselsDocuments(
      'https://parking.brussels/en/park-your-car/municipal-parking-permits-and-parking-information/anderlecht/anderlecht-resident-card',
    ),
  },
  {
    slug: 'elsene',
    nameNl: 'Elsene',
    nameFr: 'Ixelles',
    postcodes: ['1050'],
    cardManager: CardManager.PARKING_BRUSSELS,
    primaryChannel: SubmissionChannelType.POST,
    portalUrl: PARKING_BRUSSELS_PORTAL,
    postalAddress: PARKING_BRUSSELS_POST,
    firstCardPriceCents: 2600,
    secondCardPriceCents: 21100,
    validityMonths: 12,
    maxCardsPerHousehold: 2,
    notesNl:
      'Maximaal 2 kaarten per gezin, plus 1 voor een tweede verblijf ' +
      '(€1.059/jaar, maximaal 1 aanvraag per jaar). Voertuigen langer dan 4,9 m: ' +
      '+€120 per jaar.',
    notesFr:
      'Maximum 2 cartes par ménage, plus 1 pour une seconde résidence ' +
      '(1.059 €/an, maximum 1 demande par an). Véhicules de plus de 4,9 m : +120 €/an.',
    verificationStatus: VerificationStatus.VERIFIED,
    sourceUrls: ['https://parking.brussels/en/ixelles-resident-permit', PARKING_BRUSSELS_FAQ],
    requiredDocuments: parkingBrusselsDocuments(
      'https://parking.brussels/en/ixelles-resident-permit',
    ),
  },
  {
    slug: 'vorst',
    nameNl: 'Vorst',
    nameFr: 'Forest',
    postcodes: ['1190'],
    cardManager: CardManager.PARKING_BRUSSELS,
    primaryChannel: SubmissionChannelType.POST,
    portalUrl: PARKING_BRUSSELS_PORTAL,
    postalAddress: PARKING_BRUSSELS_POST,
    firstCardPriceCents: 3000,
    secondCardPriceCents: 20000,
    validityMonths: 12,
    maxCardsPerHousehold: 2,
    notesNl:
      'Maximaal 2 kaarten per gezin, plus 1 voor een tweede verblijf (€529/jaar). ' +
      'Voertuigen langer dan 4,9 m: +€120 per jaar.',
    notesFr:
      'Maximum 2 cartes par ménage, plus 1 pour une seconde résidence (529 €/an). ' +
      'Véhicules de plus de 4,9 m : +120 €/an.',
    verificationStatus: VerificationStatus.VERIFIED,
    sourceUrls: [
      'https://parking.brussels/en/park-your-car/municipal-parking-permits-and-parking-information/forest/forest-resident-permit',
      PARKING_BRUSSELS_FAQ,
    ],
    requiredDocuments: parkingBrusselsDocuments(
      'https://parking.brussels/en/park-your-car/municipal-parking-permits-and-parking-information/forest/forest-resident-permit',
    ),
  },
  {
    slug: 'schaarbeek',
    nameNl: 'Schaarbeek',
    nameFr: 'Schaerbeek',
    postcodes: ['1030'],
    cardManager: CardManager.PARKING_BRUSSELS,
    primaryChannel: SubmissionChannelType.POST,
    portalUrl: PARKING_BRUSSELS_PORTAL,
    postalAddress: PARKING_BRUSSELS_POST,
    firstCardPriceCents: 3700,
    secondCardPriceCents: 15000,
    validityMonths: 12,
    maxCardsPerHousehold: 2,
    notesNl:
      'Maximaal 2 kaarten per gezin, plus 1 voor een tweede verblijf (€529/jaar). ' +
      'Het totaal mag nooit hoger zijn dan het aantal rijbewijzen in het gezin. ' +
      'Voertuigen langer dan 4,9 m: +€127 per jaar. Geldig in de groene zone van Schaarbeek.',
    notesFr:
      'Maximum 2 cartes par ménage, plus 1 pour une seconde résidence (529 €/an). ' +
      'Le total ne peut jamais dépasser le nombre de permis de conduire du ménage. ' +
      'Véhicules de plus de 4,9 m : +127 €/an.',
    verificationStatus: VerificationStatus.VERIFIED,
    sourceUrls: [
      'https://parking.brussels/nl/je-auto-parkeren/gemeentelijke-parkeerkaarten/schaarbeek/schaarbeek-bewonerskaart',
      PARKING_BRUSSELS_FAQ,
    ],
    requiredDocuments: parkingBrusselsDocuments(
      'https://parking.brussels/nl/je-auto-parkeren/gemeentelijke-parkeerkaarten/schaarbeek/schaarbeek-bewonerskaart',
    ),
  },

  // ── Overige parking.brussels-gemeenten: kanaal bekend, tarieven niet ──────
  unverifiedParkingBrussels('sint-agatha-berchem', 'Sint-Agatha-Berchem', 'Berchem-Sainte-Agathe', ['1082']),
  unverifiedParkingBrussels('evere', 'Evere', 'Evere', ['1140']),
  unverifiedParkingBrussels('ganshoren', 'Ganshoren', 'Ganshoren', ['1083']),
  unverifiedParkingBrussels('jette', 'Jette', 'Jette', ['1090']),
  unverifiedParkingBrussels('koekelberg', 'Koekelberg', 'Koekelberg', ['1081']),
  unverifiedParkingBrussels('sint-gillis', 'Sint-Gillis', 'Saint-Gilles', ['1060']),
  unverifiedParkingBrussels('sint-jans-molenbeek', 'Sint-Jans-Molenbeek', 'Molenbeek-Saint-Jean', ['1080']),
  unverifiedParkingBrussels('sint-pieters-woluwe', 'Sint-Pieters-Woluwe', 'Woluwe-Saint-Pierre', ['1150']),
  unverifiedParkingBrussels('watermaal-bosvoorde', 'Watermaal-Bosvoorde', 'Watermael-Boitsfort', ['1170']),

  // ── Zelf beherende gemeenten ──────────────────────────────────────────────
  {
    slug: 'oudergem',
    nameNl: 'Oudergem',
    nameFr: 'Auderghem',
    postcodes: ['1160'],
    cardManager: CardManager.MUNICIPALITY,
    // De enige gemeente waar wij vandaag namens de gebruiker kunnen indienen.
    // Het adres staat letterlijk op de officiële pagina, met e-mail expliciet
    // genoemd als aanvraagkanaal.
    primaryChannel: SubmissionChannelType.EMAIL,
    submissionEmail: 'mobilite@auderghem.brussels',
    portalUrl: 'https://irisbox.irisnet.be',
    counterInfo: 'Dienst Mobiliteit, Rue Emile Idiers 12, niveau -1, 1160 Oudergem',
    firstCardPriceCents: 1500,
    secondCardPriceCents: 12700,
    validityMonths: 12,
    notesNl:
      'De gemeente aanvaardt uitdrukkelijk een volmacht naast de identiteitskaart. ' +
      'Tweede verblijf: €530 per jaar. De kaart is virtueel sinds 2016; controle ' +
      'gebeurt op nummerplaat.',
    notesFr:
      "La commune accepte explicitement une procuration à côté de la carte d'identité. " +
      'Seconde résidence : 530 €/an. La carte est virtuelle depuis 2016.',
    verificationStatus: VerificationStatus.VERIFIED,
    sourceUrls: ['https://www.auderghem.be/carte-de-riverain'],
    requiredDocuments: [
      DossierType.NEW_CARD,
      DossierType.PLATE_CHANGE,
      DossierType.ADDRESS_CHANGE,
      DossierType.TEMPORARY_VEHICLE,
    ].flatMap((dossierType): RequiredDoc[] => [
      {
        dossierType,
        docType: DocType.ID_CARD,
        required: true,
        hintNl: 'Identiteitskaart, of de volmacht die je bij ons ondertekent',
        hintFr: "Carte d'identité, ou la procuration que vous signez chez nous",
        sourceUrl: 'https://www.auderghem.be/carte-de-riverain',
      },
      {
        dossierType,
        docType: DocType.VEHICLE_REGISTRATION,
        required: true,
        hintNl: 'Deel 1 van het inschrijvingsbewijs, voor- en achterzijde',
        hintFr: "Partie 1 du certificat d'immatriculation, recto-verso",
        sourceUrl: 'https://www.auderghem.be/carte-de-riverain',
      },
      {
        dossierType,
        docType: DocType.LEASE_CONTRACT,
        required: false,
        hintNl: 'Bewijs van permanent gebruik: leasecontract, werkgeversattest of verzekeringspolis',
        hintFr: "Preuve d'usage permanent : contrat de leasing, attestation employeur ou police d'assurance",
        sourceUrl: 'https://www.auderghem.be/carte-de-riverain',
      },
    ]),
  },
  {
    slug: 'brussel-stad',
    nameNl: 'Brussel-Stad',
    nameFr: 'Bruxelles-Ville',
    postcodes: ['1000', '1020', '1120', '1130'],
    cardManager: CardManager.MUNICIPALITY,
    // Geverifieerd, maar bewust géén kanaal waarlangs wij mogen indienen: de
    // online aanvraag vereist de eID mét pincode van de aanvrager zelf, en een
    // pincode is persoonlijk. Zie ADR 0005.
    primaryChannel: SubmissionChannelType.ONLINE_PORTAL,
    portalUrl: 'https://www.brussel.be/bewonerskaart',
    counterInfo:
      'Administratief Centrum Brucity, of de antennes Laken en Neder-Over-Heembeek. ' +
      'Alleen op afspraak, online te maken.',
    validityMonths: 12,
    maxCardsPerHousehold: 2,
    notesNl:
      'De online aanvraag vereist je elektronische identiteitskaart met pincode en ' +
      'een kaartlezer. Wij kunnen dit niet namens jou doen — een pincode is ' +
      'persoonlijk. Wij maken je dossier compleet; jij dient het zelf in. ' +
      'Voorwaarden: hoofdverblijf of tweede verblijf in Brussel-Stad, voertuig in ' +
      'België ingeschreven en niet zwaarder dan 3,5 ton. Kaart geldig 1 of 2 jaar.',
    notesFr:
      "La demande en ligne exige votre carte d'identité électronique avec code PIN et " +
      'un lecteur de cartes. Nous ne pouvons pas le faire à votre place — un code PIN ' +
      'est personnel. Nous préparons votre dossier ; vous le soumettez vous-même.',
    verificationStatus: VerificationStatus.VERIFIED,
    sourceUrls: ['https://www.brussel.be/bewonerskaart', 'https://www.brussel.be/parkeerkaarten'],
  },
  {
    slug: 'sint-lambrechts-woluwe',
    nameNl: 'Sint-Lambrechts-Woluwe',
    nameFr: 'Woluwe-Saint-Lambert',
    postcodes: ['1200'],
    cardManager: CardManager.MUNICIPALITY,
    counterInfo: 'Maison communale, avenue Paul Hymans 2, 1200 Sint-Lambrechts-Woluwe',
    firstCardPriceCents: 1500,
    secondCardPriceCents: 12000,
    validityMonths: 12,
    maxCardsPerHousehold: 2,
    notesNl: 'Tarieven van kracht sinds 01-05-2023. Maximaal 2 kaarten per gezin.',
    notesFr: 'Tarifs en vigueur depuis le 01-05-2023. Maximum 2 cartes par ménage.',
    verificationStatus: VerificationStatus.UNVERIFIED,
    sourceUrls: [
      'https://www.woluwe1200.be/demarches/demander-une-carte-de-riverain-stationnement/',
    ],
    verificationNote:
      'Tarieven, documentlijst en loketadres zijn bevestigd. Het indieningskanaal niet: ' +
      'de officiële procedurepagina noemt geen e-mailadres voor aanvragen, alleen ' +
      'infocom@woluwe1200.be voor algemene informatie. Zoekresultaten noemden ' +
      'controle-parking@woluwe1200.be, maar dat is op de officiële pagina niet ' +
      'bevestigd en is daarom niet overgenomen.',
  },
  {
    slug: 'ukkel',
    nameNl: 'Ukkel',
    nameFr: 'Uccle',
    postcodes: ['1180'],
    cardManager: CardManager.MUNICIPALITY,
    validityMonths: 12,
    maxCardsPerHousehold: 2,
    notesNl:
      'Aanvraag via het gemeentelijke PDF-formulier. De kaart wordt pas aangemaakt ' +
      'na controle van de documenten én ontvangst van de betaling op rekening ' +
      'BE87 0910 1976 5494. Kaart geldig 1 of 2 jaar, naar keuze.',
    notesFr:
      'Demande via le formulaire PDF communal. La carte est établie après vérification ' +
      'des documents et réception du paiement sur le compte BE87 0910 1976 5494.',
    verificationStatus: VerificationStatus.UNVERIFIED,
    sourceUrls: [
      'https://www.uccle.be/fr/vie-pratique/stationnement/cartes-de-derogation-riverains-handicaps-pros',
    ],
    verificationNote:
      'Formulier, rekeningnummer en geldigheidsduur zijn bevestigd. Het indieningskanaal ' +
      'is niet eenduidig: er wordt een e-mail genoemd voor het attest bij een tweede ' +
      'verblijf, maar geen algemeen indieningsadres voor de aanvraag zelf.',
  },
  {
    slug: 'sint-joost-ten-node',
    nameNl: 'Sint-Joost-ten-Node',
    nameFr: 'Saint-Josse-ten-Noode',
    postcodes: ['1210'],
    cardManager: CardManager.MUNICIPALITY,
    portalUrl: 'https://irisbox.irisnet.be',
    counterInfo:
      'Parkeerdienst, avenue de l\'Astronomie 12-13, 1210 Sint-Joost-ten-Node. ' +
      'Ma-vr 08:30-13:00, di ook 16:00-18:30. Tel. +32 2 220 26 11.',
    verificationStatus: VerificationStatus.UNVERIFIED,
    sourceUrls: [
      'https://sjtn.brussels/fr/actualites/carte-de-riverain',
      'https://sjtn.brussels/fr/la-commune/mobilite-stationnement',
    ],
    verificationNote:
      'Bezoekadres, openingsuren en telefoonnummer zijn bevestigd, en IRISbox wordt als ' +
      'kanaal genoemd. Tarieven en documentlijst voor de bewonerskaart niet. ' +
      'Zoekresultaten noemden cartestationnement@sjtn.brussels, maar dat adres staat ' +
      'niet op de geraadpleegde officiële pagina en is daarom niet overgenomen.',
  },
  {
    slug: 'etterbeek',
    nameNl: 'Etterbeek',
    nameFr: 'Etterbeek',
    postcodes: ['1040'],
    cardManager: CardManager.MUNICIPALITY,
    verificationStatus: VerificationStatus.UNVERIFIED,
    sourceUrls: [
      'https://www.etterbeek.be/nos-services/stationnement/plan-de-stationnement/plan-de-stationnement',
    ],
    verificationNote:
      'Alleen de regeling voor bezoekerskaarten is teruggevonden. De procedure, de ' +
      'documentlijst en het tarief voor de bewonerskaart zelf staan niet op een ' +
      'officiële pagina die tijdens dit onderzoek gevonden is.',
  },
]

async function main(): Promise<void> {
  let created = 0
  let updated = 0
  let skipped = 0

  for (const entry of MUNICIPALITIES) {
    const existing = await prisma.municipalityConfig.findUnique({
      where: { slug: entry.slug },
      select: { id: true, verifiedBy: true },
    })

    // Een beheerder die een entry handmatig geverifieerd heeft, wint van de
    // seed. Anders zou elke deploy zijn werk terugdraaien.
    if (existing && existing.verifiedBy && existing.verifiedBy !== RESEARCHED_BY) {
      skipped += 1
      continue
    }

    const data = {
      nameNl: entry.nameNl,
      nameFr: entry.nameFr,
      postcodes: entry.postcodes,
      languages: [Language.NL, Language.FR],
      cardManager: entry.cardManager,
      primaryChannel: entry.primaryChannel ?? null,
      submissionEmail: entry.submissionEmail ?? null,
      portalUrl: entry.portalUrl ?? null,
      postalAddress: entry.postalAddress ?? null,
      counterInfo: entry.counterInfo ?? null,
      firstCardPriceCents: entry.firstCardPriceCents ?? null,
      secondCardPriceCents: entry.secondCardPriceCents ?? null,
      validityMonths: entry.validityMonths ?? null,
      maxCardsPerHousehold: entry.maxCardsPerHousehold ?? null,
      notesNl: entry.notesNl ?? null,
      notesFr: entry.notesFr ?? null,
      verificationStatus: entry.verificationStatus,
      sourceUrls: entry.sourceUrls,
      verificationNote: entry.verificationNote ?? null,
      verifiedAt:
        entry.verificationStatus === VerificationStatus.VERIFIED ? RESEARCHED_AT : null,
      verifiedBy:
        entry.verificationStatus === VerificationStatus.VERIFIED ? RESEARCHED_BY : null,
    }

    const municipality = await prisma.municipalityConfig.upsert({
      where: { slug: entry.slug },
      create: { slug: entry.slug, ...data },
      update: data,
    })

    if (existing) updated += 1
    else created += 1

    // Documentvereisten opnieuw opbouwen: dat houdt de lijst gelijk aan
    // docs/gemeenten.md zonder resten van een vorige ronde.
    await prisma.municipalityRequiredDocument.deleteMany({
      where: { municipalityId: municipality.id },
    })

    if (entry.requiredDocuments?.length) {
      await prisma.municipalityRequiredDocument.createMany({
        data: entry.requiredDocuments.map((doc) => ({
          municipalityId: municipality.id,
          dossierType: doc.dossierType,
          docType: doc.docType,
          required: doc.required ?? true,
          hintNl: doc.hintNl ?? null,
          hintFr: doc.hintFr ?? null,
          sourceUrl: doc.sourceUrl ?? null,
        })),
      })
    }
  }

  const verified = MUNICIPALITIES.filter(
    (m) => m.verificationStatus === VerificationStatus.VERIFIED,
  )
  const sendable = MUNICIPALITIES.filter(
    (m) =>
      m.verificationStatus === VerificationStatus.VERIFIED &&
      (m.primaryChannel === SubmissionChannelType.EMAIL ||
        m.primaryChannel === SubmissionChannelType.POST),
  )

  process.stdout.write(
    [
      '',
      `  Gemeenten: ${created} aangemaakt, ${updated} bijgewerkt, ${skipped} overgeslagen`,
      `  (handmatig geverifieerd door een beheerder).`,
      '',
      `  Geverifieerd:            ${verified.length} van ${MUNICIPALITIES.length}`,
      `  Verzending toegestaan:   ${sendable.length}`,
      `  waarvan per e-mail:      ${sendable.filter((m) => m.primaryChannel === SubmissionChannelType.EMAIL).length}`,
      '',
      '  Bij alle andere gemeenten stellen we het dossier samen en dient de',
      '  gebruiker het zelf in. Zie docs/gemeenten.md en ADR 0005.',
      '',
      '',
    ].join('\n'),
  )
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seed mislukt: ${String(error)}\n`)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })
