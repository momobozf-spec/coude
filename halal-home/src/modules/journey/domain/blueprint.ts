/**
 * De blauwdruk: welke taken hoort elk aankooptraject te bevatten?
 *
 * Dit is data, geen code — precies zoals checklists dat zijn. Het aankoopproces
 * verschilt per land en per gewest, en een wijziging mag geen React-component
 * raken.
 *
 * ─── STABIELE SLEUTELS ───────────────────────────────────────────────────────
 *
 * Elke taak heeft een `key` in de vorm `FASE_WERKWOORD_ONDERWERP`, bijvoorbeeld
 * `FINANCING_COMPARE_OPTIONS`. Die sleutel is het enige dat stabiel is: een
 * database-id verschilt per gebruiker, en een titel verandert zodra we hem
 * beter formuleren. Migraties, analytics, aanbevelingen en blauwdruk-upgrades
 * verwijzen allemaal naar déze sleutel.
 *
 * Een sleutel hernoemen is dus een breaking change. Wil je een taak vervangen,
 * voeg dan een nieuwe toe en laat de oude vervallen in een nieuwe
 * blauwdrukversie.
 *
 * ─── VERSIEBEHEER ────────────────────────────────────────────────────────────
 *
 * `HomeBuyingJourney.blueprintVersion` legt vast met welke versie een traject is
 * opgezet. Iemand die vandaag begint, mag over drie maanden geen taken zien
 * verdwijnen omdat wij de lijst hebben herzien. Nieuwe trajecten krijgen
 * `CURRENT_BLUEPRINT_VERSION`; bestaande blijven op de hunne tot iemand bewust
 * migreert.
 *
 * ─── AFHANKELIJKHEDEN ────────────────────────────────────────────────────────
 *
 * `dependsOn` verwijst naar andere sleutels binnen dezelfde blauwdruk. Alle
 * genoemde taken moeten afgehandeld zijn (ALL-semantiek).
 *
 * ─── BLOKKEREND OF ADVISEREND ────────────────────────────────────────────────
 *
 * `blockedBy` houdt een taak werkelijk tegen: hij kan niet afgerond worden
 * zolang de voorwaarde open staat. Dat is voor gevallen waar de omgekeerde
 * volgorde schade oplevert — een bod uitbrengen zonder financieringsbewijs is
 * precies de fout die dit platform hoort te voorkomen.
 *
 * `dependsOn` bepaalt alleen de volgorde in de interface. Nuttig, maar het
 * houdt niets tegen: wie zijn financieringsvormen vergelijkt vóór hij zijn
 * behoefte formeel vastlegde, heeft ze nog steeds vergeleken.
 *
 * Alles blokkerend maken klinkt veiliger maar is het niet: dan blijft een taak
 * die aantoonbaar gedaan is toch openstaan, en leert de gebruiker dat de
 * vinkjes niet kloppen.
 */
import { JourneyStage, TaskPriority } from '@prisma/client'

/**
 * De versie die nieuwe trajecten krijgen. Verhoog dit getal bij elke wijziging
 * in de takenlijst die bestaande trajecten niet mogen ondergaan.
 */
export const CURRENT_BLUEPRINT_VERSION = 1

export interface BlueprintTask {
  /** Stabiele identifier, UPPER_SNAKE_CASE. Zie de kop van dit bestand. */
  key: string
  stage: JourneyStage
  title: string
  description?: string
  priority?: TaskPriority
  /** Adviserende volgorde: bepaalt de weergave, houdt niets tegen. */
  dependsOn?: readonly string[]
  /**
   * Blokkerende voorwaarden: deze taak kan niet afgerond worden zolang er één
   * van open staat. Alleen gebruiken waar de omgekeerde volgorde schadelijk is.
   */
  blockedBy?: readonly string[]
  /**
   * Optionele taken blokkeren het afronden van een fase niet en wegen lichter
   * mee in de voortgang. Standaard is een taak verplicht.
   */
  optional?: boolean
  /** Alleen voor een eerste eigen woning. */
  firstHomeOnly?: boolean
  /**
   * Waar deze taak heen leidt in de app. Maakt van een takenlijst een werklijst
   * in plaats van een leeslijst.
   */
  href?: string
}

export interface JourneyBlueprint {
  version: number
  country: string
  tasks: readonly BlueprintTask[]
}

const BE_TASKS_V1: readonly BlueprintTask[] = [
  // ── Oriëntatie ─────────────────────────────────────────────────────────────
  {
    key: 'ORIENTATION_DEFINE_AREA',
    stage: JourneyStage.ORIENTATION,
    title: 'Bepaal in welke gemeenten je wil zoeken',
    description: 'Kies één of meer gemeenten en een straal daaromheen.',
    priority: TaskPriority.HIGH,
  },
  {
    key: 'ORIENTATION_SET_NEIGHBORHOOD_PRIORITIES',
    stage: JourneyStage.ORIENTATION,
    title: 'Stel je buurtvoorkeuren in',
    description:
      'Geef aan hoe zwaar een moskee, school, halal winkel en openbaar vervoer voor je wegen.',
    href: '/neighborhood/preferences',
  },
  {
    key: 'ORIENTATION_CHOOSE_PROPERTY_TYPE',
    stage: JourneyStage.ORIENTATION,
    title: 'Kies welk type woning je zoekt',
    description: 'Huis, appartement, nieuwbouw of te renoveren.',
  },

  // ── Budget ─────────────────────────────────────────────────────────────────
  {
    key: 'BUDGET_SET_OWN_FUNDS',
    stage: JourneyStage.BUDGET,
    title: 'Breng je eigen middelen in kaart',
    description: 'Spaargeld, schenking, verkoop van een andere woning.',
    priority: TaskPriority.HIGH,
  },
  {
    key: 'BUDGET_ESTIMATE_COSTS',
    stage: JourneyStage.BUDGET,
    title: 'Bereken de bijkomende aankoopkosten',
    description:
      'Registratierechten, notariskosten en dossierkosten komen bovenop de aankoopprijs.',
    priority: TaskPriority.HIGH,
    dependsOn: ['BUDGET_SET_OWN_FUNDS'],
    href: '/financing/costs',
  },
  {
    key: 'BUDGET_SET_MAX_PRICE',
    stage: JourneyStage.BUDGET,
    title: 'Leg je maximale aankoopprijs vast',
    dependsOn: ['BUDGET_ESTIMATE_COSTS'],
  },

  // ── Financiering ───────────────────────────────────────────────────────────
  {
    key: 'FINANCING_DETERMINE_NEED',
    stage: JourneyStage.FINANCING,
    title: 'Bepaal je financieringsbehoefte',
    description: 'Het verschil tussen je aankoopprijs en je eigen middelen.',
    priority: TaskPriority.HIGH,
    dependsOn: ['BUDGET_SET_MAX_PRICE'],
  },
  {
    key: 'FINANCING_COMPARE_OPTIONS',
    stage: JourneyStage.FINANCING,
    title: 'Vergelijk financieringsvormen',
    description:
      'Bekijk per aanbieder hoe de constructie werkt, wat de bron is en wie ze eventueel certificeert.',
    priority: TaskPriority.HIGH,
    dependsOn: ['FINANCING_DETERMINE_NEED'],
    href: '/financing',
  },
  {
    key: 'FINANCING_UPLOAD_IDENTITY',
    stage: JourneyStage.FINANCING,
    title: 'Upload je identiteitsdocumenten',
    priority: TaskPriority.HIGH,
    href: '/documents?category=IDENTITY',
  },
  {
    key: 'FINANCING_UPLOAD_INCOME',
    stage: JourneyStage.FINANCING,
    title: 'Upload je inkomensdocumenten',
    description: 'Meestal de laatste drie loonfiches of je recentste aanslagbiljet.',
    priority: TaskPriority.HIGH,
    href: '/documents?category=INCOME',
  },
  {
    key: 'FINANCING_UPLOAD_BANK_STATEMENTS',
    stage: JourneyStage.FINANCING,
    title: 'Upload je bankafschriften',
    description: 'Vaak de laatste drie maanden.',
    href: '/documents?category=BANK',
  },
  {
    key: 'FINANCING_CONTACT_PROVIDER',
    stage: JourneyStage.FINANCING,
    title: 'Contacteer een eerste aanbieder',
    dependsOn: ['FINANCING_COMPARE_OPTIONS', 'FINANCING_UPLOAD_INCOME'],
  },
  {
    key: 'FINANCING_OBTAIN_PROOF',
    stage: JourneyStage.FINANCING,
    title: 'Vraag een financieringsbewijs aan',
    description:
      'Een schriftelijke bevestiging van wat je kan financieren. Verkopers vragen hier vaak naar.',
    priority: TaskPriority.CRITICAL,
    dependsOn: ['FINANCING_CONTACT_PROVIDER'],
  },

  // ── Zoeken ─────────────────────────────────────────────────────────────────
  {
    key: 'SEARCH_CREATE_FIRST',
    stage: JourneyStage.PROPERTY_SEARCH,
    title: 'Maak je eerste zoekopdracht',
    description: 'Beschrijf in gewone taal wat je zoekt; wij zetten het om in criteria.',
    priority: TaskPriority.HIGH,
    dependsOn: ['ORIENTATION_DEFINE_AREA'],
    href: '/search/new',
  },
  {
    key: 'SEARCH_ENABLE_ALERTS',
    stage: JourneyStage.PROPERTY_SEARCH,
    title: 'Zet meldingen aan voor nieuwe woningen',
    dependsOn: ['SEARCH_CREATE_FIRST'],
    optional: true,
  },
  {
    key: 'SEARCH_BUILD_SHORTLIST',
    stage: JourneyStage.PROPERTY_SEARCH,
    title: 'Maak een shortlist van woningen',
    description: 'Bewaar de woningen die je echt wil bezoeken.',
    dependsOn: ['SEARCH_CREATE_FIRST'],
    href: '/saved',
  },

  // ── Bezichtigingen ─────────────────────────────────────────────────────────
  {
    key: 'VIEWINGS_PLAN_FIRST',
    stage: JourneyStage.VIEWINGS,
    title: 'Plan je eerste bezichtiging',
    priority: TaskPriority.HIGH,
    dependsOn: ['SEARCH_BUILD_SHORTLIST'],
  },
  {
    key: 'VIEWINGS_PREPARE_CHECKLIST',
    stage: JourneyStage.VIEWINGS,
    title: 'Neem een bezichtigingschecklist mee',
    description: 'Vocht, isolatie, elektriciteit, ramen, dak, verwarmingsketel.',
    optional: true,
  },
  {
    key: 'VIEWINGS_REQUEST_CERTIFICATES',
    stage: JourneyStage.VIEWINGS,
    title: 'Vraag het EPC en de keuringsattesten op',
    description: 'De verkoper is verplicht het EPC te tonen.',
  },
  {
    key: 'VIEWINGS_VISIT_NEIGHBORHOOD',
    stage: JourneyStage.VIEWINGS,
    title: 'Bezoek de buurt op een ander moment van de dag',
    optional: true,
  },

  // ── Bod ────────────────────────────────────────────────────────────────────
  {
    key: 'OFFER_CONFIRM_FINANCING',
    stage: JourneyStage.OFFER,
    title: 'Bevestig dat je financiering rond is',
    description: 'Bied nooit zonder te weten wat je kan financieren.',
    priority: TaskPriority.CRITICAL,
    // Blokkerend: bieden zonder financieringsbewijs kan een schadevergoeding
    // van 10 % van de aankoopprijs kosten.
    blockedBy: ['FINANCING_OBTAIN_PROOF'],
  },
  {
    key: 'OFFER_ADD_SUSPENSIVE_CONDITION',
    stage: JourneyStage.OFFER,
    title: 'Neem een opschortende voorwaarde op',
    description:
      'Hiermee vervalt je bod als je financiering niet rondkomt. Laat dit nakijken voor je tekent.',
    priority: TaskPriority.CRITICAL,
    // Blokkerend: zonder opschortende voorwaarde is er geen uitweg.
    blockedBy: ['OFFER_CONFIRM_FINANCING'],
  },
  {
    key: 'OFFER_SUBMIT',
    stage: JourneyStage.OFFER,
    title: 'Breng je bod schriftelijk uit',
    priority: TaskPriority.HIGH,
    // Blokkerend: een bod is bindend zodra het aanvaard wordt.
    blockedBy: ['OFFER_ADD_SUSPENSIVE_CONDITION'],
  },

  // ── Compromis ──────────────────────────────────────────────────────────────
  {
    key: 'AGREEMENT_REVIEW_CONTRACT',
    stage: JourneyStage.AGREEMENT,
    title: 'Lees de verkoopovereenkomst volledig na',
    description: 'Laat onduidelijke clausules uitleggen voor je tekent.',
    priority: TaskPriority.CRITICAL,
    dependsOn: ['OFFER_SUBMIT'],
  },
  {
    key: 'AGREEMENT_CHOOSE_NOTARY',
    stage: JourneyStage.AGREEMENT,
    title: 'Kies je notaris',
    description: 'Je mag een eigen notaris aanstellen; dat kost je niets extra.',
    priority: TaskPriority.HIGH,
  },
  {
    key: 'AGREEMENT_UPLOAD_SIGNED',
    stage: JourneyStage.AGREEMENT,
    title: 'Upload de getekende overeenkomst',
    // Blokkerend: een getekend compromis uploaden dat je niet gelezen hebt,
    // is precies de volgorde die dit platform moet voorkomen.
    blockedBy: ['AGREEMENT_REVIEW_CONTRACT'],
    href: '/documents?category=PURCHASE_AGREEMENT',
  },
  {
    key: 'AGREEMENT_ARRANGE_DEPOSIT',
    stage: JourneyStage.AGREEMENT,
    title: 'Regel het voorschot',
    description: 'Meestal 5 tot 10 % op de derdenrekening van de notaris.',
    dependsOn: ['AGREEMENT_UPLOAD_SIGNED'],
  },

  // ── Notaris ────────────────────────────────────────────────────────────────
  {
    key: 'NOTARY_COLLECT_DOCUMENTS',
    stage: JourneyStage.NOTARY,
    title: 'Verzamel de documenten voor de notaris',
    priority: TaskPriority.CRITICAL,
    dependsOn: ['AGREEMENT_CHOOSE_NOTARY'],
    href: '/checklists',
  },
  {
    key: 'NOTARY_CHECK_SOIL_CERTIFICATE',
    stage: JourneyStage.NOTARY,
    title: 'Controleer het bodemattest',
    description: 'De verkoper moet dit leveren voor de ondertekening.',
  },
  {
    key: 'NOTARY_CHECK_URBAN_INFO',
    stage: JourneyStage.NOTARY,
    title: 'Controleer de stedenbouwkundige inlichtingen',
    description: 'Kijk of er vergunningen, overtredingen of plannen zijn die je raken.',
  },
  {
    key: 'NOTARY_CHECK_ELECTRICAL_INSPECTION',
    stage: JourneyStage.NOTARY,
    title: 'Controleer het keuringsverslag elektriciteit',
  },
  {
    key: 'NOTARY_SCHEDULE_DEED',
    stage: JourneyStage.NOTARY,
    title: 'Plan de datum van de akte',
    priority: TaskPriority.HIGH,
    dependsOn: ['NOTARY_COLLECT_DOCUMENTS'],
  },
  {
    key: 'NOTARY_TRANSFER_FUNDS',
    stage: JourneyStage.NOTARY,
    title: 'Zorg dat het volledige bedrag op tijd bij de notaris staat',
    priority: TaskPriority.CRITICAL,
    // Blokkerend: geld overmaken vóór er een aktedatum is.
    blockedBy: ['NOTARY_SCHEDULE_DEED'],
  },

  // ── Verzekering & administratie ────────────────────────────────────────────
  {
    key: 'ADMIN_ARRANGE_FIRE_INSURANCE',
    stage: JourneyStage.INSURANCE_ADMIN,
    title: 'Sluit een brandverzekering af',
    description: 'Moet in orde zijn vanaf de dag van de akte.',
    priority: TaskPriority.CRITICAL,
    dependsOn: ['NOTARY_SCHEDULE_DEED'],
  },
  {
    key: 'ADMIN_TRANSFER_UTILITIES',
    stage: JourneyStage.INSURANCE_ADMIN,
    title: 'Zet water, gas en elektriciteit op je naam',
    priority: TaskPriority.HIGH,
  },
  {
    key: 'ADMIN_ARRANGE_INTERNET',
    stage: JourneyStage.INSURANCE_ADMIN,
    title: 'Regel internet en telefonie',
    optional: true,
  },
  {
    key: 'ADMIN_NOTE_PROPERTY_TAX',
    stage: JourneyStage.INSURANCE_ADMIN,
    title: 'Houd rekening met de onroerende voorheffing',
    description: 'Deze jaarlijkse belasting volgt na de aankoop.',
    optional: true,
  },

  // ── Verhuizen ──────────────────────────────────────────────────────────────
  {
    key: 'MOVING_BOOK_MOVER',
    stage: JourneyStage.MOVING,
    title: 'Boek een verhuisfirma of bestelwagen',
    priority: TaskPriority.HIGH,
  },
  {
    key: 'MOVING_RECORD_METER_READINGS',
    stage: JourneyStage.MOVING,
    title: 'Fotografeer de meterstanden',
    description: 'Doe dit op de dag van de sleuteloverdracht, samen met de verkoper.',
    priority: TaskPriority.CRITICAL,
  },
  {
    key: 'MOVING_CHECK_KEYS',
    stage: JourneyStage.MOVING,
    title: 'Controleer of je alle sleutels hebt',
  },
  {
    key: 'MOVING_REGISTER_ADDRESS',
    stage: JourneyStage.MOVING,
    title: 'Meld je adreswijziging bij de gemeente',
    description: 'Binnen acht dagen na de verhuis.',
    priority: TaskPriority.HIGH,
    dependsOn: ['MOVING_BOOK_MOVER'],
  },
  {
    key: 'MOVING_NOTIFY_INSTITUTIONS',
    stage: JourneyStage.MOVING,
    title: 'Informeer bank, werkgever, ziekenfonds en verzekeringen',
    dependsOn: ['MOVING_REGISTER_ADDRESS'],
  },
  {
    key: 'MOVING_DISCOVER_NEIGHBORHOOD',
    stage: JourneyStage.MOVING,
    title: 'Ontdek je nieuwe buurt',
    description: 'Zoek de dichtstbijzijnde moskee, school en halal winkels op.',
    priority: TaskPriority.LOW,
    optional: true,
    href: '/neighborhood',
  },
]

export const BE_BLUEPRINT_V1: JourneyBlueprint = {
  version: 1,
  country: 'BE',
  tasks: BE_TASKS_V1,
}

/**
 * Alle bekende blauwdrukken, per land en versie.
 *
 * Zodra er een v2 komt, blijft v1 hier staan. Een traject dat op v1 is opgezet
 * blijft dan reproduceerbaar — dat is het hele punt van `blueprintVersion`.
 */
const BLUEPRINTS: Record<string, Record<number, JourneyBlueprint>> = {
  BE: { 1: BE_BLUEPRINT_V1 },
}

/** Behouden voor bestaande imports; wijst naar de huidige versie. */
export const BE_BLUEPRINT = BE_BLUEPRINT_V1

export class BlueprintNotFoundError extends Error {}

/**
 * De blauwdruk voor een land en versie.
 *
 * Valt terug op België wanneer het land onbekend is — een gebruiker met een
 * afwijkend profiel hoort wél een traject te krijgen. Een ontbrekende VERSIE
 * is wél een harde fout: dan zou een bestaand traject stilzwijgend een andere
 * takenlijst krijgen dan waarmee het is opgezet, en dat is precies wat
 * versiebeheer moet voorkomen.
 */
export function getBlueprint(country: string, version = CURRENT_BLUEPRINT_VERSION): JourneyBlueprint {
  const forCountry = BLUEPRINTS[country.toUpperCase()] ?? BLUEPRINTS.BE!
  const blueprint = forCountry[version]

  if (!blueprint) {
    throw new BlueprintNotFoundError(
      `Geen blauwdruk voor ${country} versie ${version}. ` +
        'Een oude versie verwijderen breekt bestaande trajecten; voeg een nieuwe versie toe in plaats daarvan.',
    )
  }
  return blueprint
}

export interface BlueprintFilter {
  country: string
  firstHome: boolean
  version?: number
}

/** De taken die gelden voor dit traject, na toepassing van de filters. */
export function blueprintTasksFor(options: BlueprintFilter): readonly BlueprintTask[] {
  return getBlueprint(options.country, options.version ?? CURRENT_BLUEPRINT_VERSION).tasks.filter(
    (task) => !task.firstHomeOnly || options.firstHome,
  )
}

/** Alle afhankelijkheden van een taak, met hun type. */
export interface BlueprintDependency {
  dependsOnKey: string
  type: 'BLOCKING' | 'ADVISORY'
}

export function dependenciesOf(task: BlueprintTask): BlueprintDependency[] {
  return [
    ...(task.blockedBy ?? []).map((key) => ({ dependsOnKey: key, type: 'BLOCKING' as const })),
    ...(task.dependsOn ?? []).map((key) => ({ dependsOnKey: key, type: 'ADVISORY' as const })),
  ]
}

/** Elke sleutel waarvan deze taak afhangt, ongeacht het type. */
export function allDependencyKeys(task: BlueprintTask): string[] {
  return [...(task.blockedBy ?? []), ...(task.dependsOn ?? [])]
}

/** Eén taak opzoeken op zijn stabiele sleutel. */
export function findBlueprintTask(
  key: string,
  options: BlueprintFilter,
): BlueprintTask | undefined {
  return blueprintTasksFor(options).find((task) => task.key === key)
}

/** De sleutels van de taken in één fase, in volgorde. */
export function blueprintKeysForStage(
  stage: JourneyStage,
  options: BlueprintFilter,
): string[] {
  return blueprintTasksFor(options)
    .filter((task) => task.stage === stage)
    .map((task) => task.key)
}
