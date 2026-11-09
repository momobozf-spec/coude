/**
 * Financieringsaanbieders en -producten — DEMODATA.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  LEES DIT VOORDAT JE DEZE BESTANDEN AANPAST
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Alle aanbieders hieronder zijn VERZONNEN. De namen bevatten bewust het woord
 * "Voorbeeld" en de websites wijzen naar example.com.
 *
 * Waarom geen echte aanbieders in de seed? Omdat een seed-bestand geen bron is.
 * Een rij met "Bank X — CERTIFIED door orgaan Y" die uit het hoofd van een
 * ontwikkelaar komt, ziet er in de interface exact hetzelfde uit als een rij die
 * iemand heeft nagekeken bij de aanbieder. De gebruiker kan het verschil niet
 * zien, en juist dát is wat dit platform belooft te voorkomen.
 *
 * Echte producten komen erin via de redactieflow: iemand leest de publieke
 * documentatie, vult `sourceUrl` en `lastVerifiedAt` in, en kiest een
 * `shariahAssessmentStatus` die bij die onderbouwing past. `validateAssessment`
 * in src/modules/financing/domain/shariah.ts weigert combinaties die niet
 * kloppen.
 *
 * De tarieven hieronder zijn illustratief en zeggen niets over de markt.
 */
import { FinancingType, ShariahAssessmentStatus } from '@prisma/client'

export interface SeedFinancingProduct {
  slug: string
  name: string
  financingType: FinancingType
  description: string
  structureExplanation: string
  minAmount?: number
  maxAmount?: number
  minOwnContributionPercentage?: number
  termMinMonths?: number
  termMaxMonths?: number
  profitRateBasisPoints?: number
  rateBasisDescription?: string
  feesDescription?: string
  setupFeeAmount?: number
  shariahAssessmentStatus: ShariahAssessmentStatus
  certificationBody?: string
  certificationUrl?: string
  sourceUrl?: string
  disclaimer?: string
}

export interface SeedFinancingProvider {
  slug: string
  name: string
  country: string
  website: string
  description: string
  verified: boolean
  /** Verzonnen aanbieder. Zie src/modules/financing/domain/demo.ts. */
  isDemo: boolean
  products: SeedFinancingProduct[]
}

const DEMO_DISCLAIMER =
  'DEMODATA. Deze aanbieder is verzonnen voor de ontwikkelomgeving en bestaat niet. ' +
  'Gebruik deze gegevens nooit als basis voor een beslissing.'

export const DEMO_FINANCING_PROVIDERS: SeedFinancingProvider[] = [
  {
    slug: 'voorbeeld-participatiehuis',
    name: 'Voorbeeld Participatiehuis (demo)',
    country: 'BE',
    website: 'https://example.com/participatiehuis',
    description:
      'Verzonnen aanbieder voor de ontwikkelomgeving. Illustreert hoe een afnemend partnerschap in de vergelijking verschijnt.',
    verified: false,
    isDemo: true,
    products: [
      {
        slug: 'voorbeeld-diminishing-musharaka',
        name: 'Woningpartnerschap (demo)',
        financingType: FinancingType.DIMINISHING_MUSHARAKA,
        description:
          'Je koopt de woning samen met de financier en koopt zijn aandeel maandelijks stukje bij beetje over.',
        structureExplanation:
          'Bij aanvang bezitten jij en de financier elk een deel van de woning, in verhouding tot de inbreng. ' +
          'Je maandbedrag bestaat uit een vergoeding voor het gebruik van het deel dat nog niet van jou is, ' +
          'plus een aflossing die je eigendomsaandeel vergroot. Naarmate je aandeel groeit, daalt de gebruiksvergoeding.',
        minAmount: 75_000,
        maxAmount: 750_000,
        minOwnContributionPercentage: 20,
        termMinMonths: 120,
        termMaxMonths: 300,
        profitRateBasisPoints: 385,
        rateBasisDescription:
          'Vergoeding voor het gebruik van het aandeel van de financier, uitgedrukt als jaarlijks percentage.',
        feesDescription: 'Eenmalige dossierkosten. Schattings- en notariskosten komen daarbovenop.',
        setupFeeAmount: 950,
        // PROVIDER_CLAIMED en niet CERTIFIED: er is geen derde partij die dit
        // beoordeelt. Precies het onderscheid dat dit platform zichtbaar maakt.
        shariahAssessmentStatus: ShariahAssessmentStatus.PROVIDER_CLAIMED,
        sourceUrl: 'https://example.com/participatiehuis/product',
        disclaimer: DEMO_DISCLAIMER,
      },
    ],
  },
  {
    slug: 'voorbeeld-vastgoedfinanciering',
    name: 'Voorbeeld Vastgoedfinanciering (demo)',
    country: 'BE',
    website: 'https://example.com/vastgoedfinanciering',
    description:
      'Verzonnen aanbieder voor de ontwikkelomgeving. Illustreert een murabaha- en een ijara-constructie naast elkaar.',
    verified: false,
    isDemo: true,
    products: [
      {
        slug: 'voorbeeld-murabaha',
        name: 'Woningaankoop met vaste marge (demo)',
        financingType: FinancingType.MURABAHA,
        description:
          'De financier koopt de woning en verkoopt hem aan jou door tegen een vooraf vastgelegde totaalprijs.',
        structureExplanation:
          'De totaalprijs — aankoopprijs plus marge — staat bij ondertekening vast en verandert daarna niet meer. ' +
          'Je betaalt die in gelijke maandelijkse termijnen. Omdat de marge vooraf vastligt, weet je vanaf dag één ' +
          'wat je in totaal betaalt.',
        minAmount: 50_000,
        maxAmount: 600_000,
        minOwnContributionPercentage: 15,
        termMinMonths: 60,
        termMaxMonths: 300,
        profitRateBasisPoints: 420,
        rateBasisDescription: 'Vaste winstmarge, herrekend naar een jaarlijks percentage.',
        feesDescription: 'Eenmalige dossierkosten.',
        setupFeeAmount: 750,
        shariahAssessmentStatus: ShariahAssessmentStatus.REVIEWED,
        sourceUrl: 'https://example.com/vastgoedfinanciering/murabaha',
        disclaimer: DEMO_DISCLAIMER,
      },
      {
        slug: 'voorbeeld-ijara',
        name: 'Huur met eigendomsopbouw (demo)',
        financingType: FinancingType.IJARA,
        description:
          'De financier is eigenaar en jij huurt, met de afspraak dat de eigendom aan het einde naar jou overgaat.',
        structureExplanation:
          'Je betaalt maandelijks een huurbedrag. In dit contract is afgesproken dat de eigendom bij het einde van ' +
          'de looptijd naar jou overgaat. De exacte vorm van die overdracht staat in het productblad van de aanbieder.',
        minAmount: 60_000,
        maxAmount: 500_000,
        minOwnContributionPercentage: 20,
        termMinMonths: 120,
        termMaxMonths: 240,
        profitRateBasisPoints: 445,
        rateBasisDescription: 'Huurcomponent, herrekend naar een jaarlijks percentage.',
        setupFeeAmount: 850,
        // UNVERIFIED: er is een bron, maar niemand heeft hem nagelezen. De UI
        // toont dat als zodanig in plaats van de status weg te laten.
        shariahAssessmentStatus: ShariahAssessmentStatus.UNVERIFIED,
        sourceUrl: 'https://example.com/vastgoedfinanciering/ijara',
        disclaimer: DEMO_DISCLAIMER,
      },
    ],
  },
  {
    slug: 'voorbeeld-referentiebank',
    name: 'Voorbeeld Referentiebank (demo)',
    country: 'BE',
    website: 'https://example.com/referentiebank',
    description:
      'Verzonnen aanbieder. Staat er als referentiepunt: een klassiek hypothecair krediet, zodat de vergelijking ' +
      'laat zien wat het verschil in constructie én in kostprijs is.',
    verified: false,
    isDemo: true,
    products: [
      {
        slug: 'voorbeeld-klassiek-krediet',
        name: 'Klassiek hypothecair krediet (demo, ter vergelijking)',
        financingType: FinancingType.CONVENTIONAL_MORTGAGE,
        description:
          'Een gewone woonlening met rente. Opgenomen als referentiepunt, niet als aanbeveling.',
        structureExplanation:
          'Je leent een bedrag en betaalt het terug met rente. Deze constructie staat in de vergelijking zodat je ' +
          'ziet hoe de andere producten zich ertoe verhouden qua kostprijs en opbouw.',
        minAmount: 25_000,
        maxAmount: 1_000_000,
        termMinMonths: 60,
        termMaxMonths: 360,
        profitRateBasisPoints: 340,
        rateBasisDescription: 'Vaste jaarlijkse rentevoet.',
        setupFeeAmount: 500,
        // UNKNOWN is hier het juiste antwoord, niet "niet halal": het platform
        // spreekt geen religieus oordeel uit — ook geen negatief.
        shariahAssessmentStatus: ShariahAssessmentStatus.UNKNOWN,
        disclaimer: DEMO_DISCLAIMER,
      },
    ],
  },
]
