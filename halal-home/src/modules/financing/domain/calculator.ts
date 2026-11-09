/**
 * Financieringsberekeningen.
 *
 * VOLLEDIG DETERMINISTISCH. Geen AI, geen netwerk, geen `Date.now()` binnenin.
 * Dezelfde invoer geeft altijd dezelfde uitvoer, want dit is het getal waarop
 * iemand een aankoop van een half miljoen euro baseert. AI mag de constructie
 * uitleggen; hij mag hem niet berekenen.
 *
 * ─── EENHEDEN ────────────────────────────────────────────────────────────────
 * Invoer: hele euro's (Int). Uitvoer: eurocent (Int).
 * Reden: een maandlast ís een bedrag met centen, en Float over 300 maanden geeft
 * afrondingsdrift. We rekenen in cent en ronden één keer af, aan het eind.
 *
 * ─── AANNAMES ────────────────────────────────────────────────────────────────
 * Elke berekening geeft zijn aannames mee terug in `assumptions`. Die worden
 * opgeslagen bij de quote (`FinancingQuote.assumptions`), zodat een gebruiker
 * over drie maanden nog kan zien waarop hij zich baseerde — ook als het product
 * intussen gewijzigd is.
 *
 * ─── WAT DIT NIET IS ─────────────────────────────────────────────────────────
 * Geen aanbod, geen offerte, geen garantie. De werkelijke voorwaarden komen van
 * de aanbieder. De vermelde marge is die van het productblad; individuele
 * dossiers wijken af.
 */
import { FinancingType } from '@prisma/client'

/** Versie van de rekenformules. Verandert de formule, verhoog dit getal. */
export const CALCULATION_VERSION = 1

export interface CalculationInput {
  /** Aankoopprijs in hele euro's. */
  purchasePrice: number
  /** Eigen inbreng in hele euro's. */
  ownContribution: number
  /** Looptijd in maanden. */
  termMonths: number
  /**
   * Marge/tarief in basispunten per jaar (1 % = 100 bp). Int, geen Float:
   * 3,5 % is 350, en dat is exact.
   */
  profitRateBasisPoints: number
  /** Eenmalige dossierkosten in hele euro's. */
  setupFeeAmount?: number
  financingType?: FinancingType
}

export interface CalculationAssumption {
  key: string
  label: string
  value: string
}

export interface CalculationResult {
  amountFinancedCents: number
  monthlyPaymentCents: number
  totalPaymentCents: number
  /** Wat je bovenop het geleende bedrag betaalt: marge + kosten. */
  totalCostCents: number
  setupFeeCents: number
  termMonths: number
  version: number
  assumptions: CalculationAssumption[]
}

export class CalculationError extends Error {}

const CENTS = 100

function assertValid(input: CalculationInput): void {
  const { purchasePrice, ownContribution, termMonths, profitRateBasisPoints } = input

  if (!Number.isInteger(purchasePrice) || purchasePrice <= 0) {
    throw new CalculationError('Aankoopprijs moet een positief bedrag in hele euro’s zijn')
  }
  if (!Number.isInteger(ownContribution) || ownContribution < 0) {
    throw new CalculationError('Eigen inbreng mag niet negatief zijn')
  }
  if (ownContribution >= purchasePrice) {
    throw new CalculationError(
      'Eigen inbreng dekt de volledige aankoopprijs — er valt niets te financieren',
    )
  }
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 480) {
    throw new CalculationError('Looptijd moet tussen 1 en 480 maanden liggen')
  }
  if (!Number.isInteger(profitRateBasisPoints) || profitRateBasisPoints < 0) {
    throw new CalculationError('Tarief moet een geheel aantal basispunten zijn, minimaal 0')
  }
  if (profitRateBasisPoints > 3000) {
    throw new CalculationError('Tarief boven 30 % is vrijwel zeker een invoerfout')
  }
}

/**
 * De annuïteitenformule, in cent.
 *
 *   M = P · i / (1 − (1 + i)^−n)
 *
 * Bij i = 0 (renteloos, bijv. qard hasan) valt de formule uiteen door deling
 * door nul; dan is het simpelweg P/n. Die uitzondering staat expliciet in de
 * code omdat een NaN hier een maandlast van "NaN €" op iemands scherm is.
 *
 * Waarom dezelfde formule voor murabaha, ijara en musharaka? Omdat de
 * CONTRACTVORM verschilt, niet de kasstroom: alle drie leiden tot een vast
 * maandbedrag over een vaste looptijd. Wat verschilt is de juridische en
 * religieuze onderbouwing — en die staat in `shariah.ts` en in de
 * productbeschrijving, niet in een rekenformule.
 */
function annuityCents(principalCents: number, monthlyRate: number, months: number): number {
  if (monthlyRate === 0) return Math.round(principalCents / months)
  const factor = Math.pow(1 + monthlyRate, -months)
  return Math.round((principalCents * monthlyRate) / (1 - factor))
}

export function calculateFinancing(input: CalculationInput): CalculationResult {
  assertValid(input)

  const { purchasePrice, ownContribution, termMonths, profitRateBasisPoints } = input
  const setupFee = input.setupFeeAmount ?? 0

  const amountFinancedCents = (purchasePrice - ownContribution) * CENTS
  const setupFeeCents = setupFee * CENTS

  // Basispunten per jaar → fractie per maand. 350 bp = 3,5 % per jaar.
  const monthlyRate = profitRateBasisPoints / 10_000 / 12

  const monthlyPaymentCents = annuityCents(amountFinancedCents, monthlyRate, termMonths)
  const totalPaymentCents = monthlyPaymentCents * termMonths
  const totalCostCents = totalPaymentCents - amountFinancedCents + setupFeeCents

  return {
    amountFinancedCents,
    monthlyPaymentCents,
    totalPaymentCents,
    totalCostCents,
    setupFeeCents,
    termMonths,
    version: CALCULATION_VERSION,
    assumptions: buildAssumptions(input, monthlyRate),
  }
}

function buildAssumptions(
  input: CalculationInput,
  monthlyRate: number,
): CalculationAssumption[] {
  const percent = (input.profitRateBasisPoints / 100).toFixed(2).replace('.', ',')

  const assumptions: CalculationAssumption[] = [
    {
      key: 'formula',
      label: 'Formule',
      value:
        monthlyRate === 0
          ? 'Gelijke maandelijkse aflossing zonder marge (bedrag ÷ looptijd)'
          : 'Annuïteit: gelijk maandbedrag over de volledige looptijd',
    },
    {
      key: 'rate',
      label: 'Gehanteerd tarief',
      value: `${percent} % per jaar (${input.profitRateBasisPoints} basispunten), maandelijks toegepast`,
    },
    {
      key: 'rate_fixed',
      label: 'Tariefzekerheid',
      value: 'Vast over de volledige looptijd. Een variabel tarief geeft een andere uitkomst.',
    },
    {
      key: 'term',
      label: 'Looptijd',
      value: `${input.termMonths} maanden (${Math.round(input.termMonths / 12)} jaar)`,
    },
    {
      key: 'excluded',
      label: 'Niet inbegrepen',
      value:
        'Registratierechten, notariskosten, schattingskosten, verzekeringen en onroerende voorheffing. Zie de kostenraming.',
    },
    {
      key: 'nature',
      label: 'Status van deze berekening',
      value:
        'Een raming op basis van publiek productinformatie. Geen aanbod en geen offerte; de aanbieder bepaalt de werkelijke voorwaarden.',
    },
    {
      key: 'version',
      label: 'Versie rekenmethode',
      value: String(CALCULATION_VERSION),
    },
  ]

  if (input.financingType) {
    assumptions.push({
      key: 'structure',
      label: 'Constructie',
      value: `${input.financingType}. De kasstroom is berekend als een vast maandbedrag; de juridische opbouw van het contract verschilt per constructie.`,
    })
  }

  if (input.setupFeeAmount) {
    assumptions.push({
      key: 'setup_fee',
      label: 'Dossierkosten',
      value: `${input.setupFeeAmount} € eenmalig, meegeteld in de totale kost maar niet gespreid over de maanden.`,
    })
  }

  return assumptions
}

/** Het aandeel eigen inbreng, in hele procenten. Voor de minimumcheck. */
export function ownContributionPercentage(purchasePrice: number, ownContribution: number): number {
  if (purchasePrice <= 0) return 0
  return Math.round((ownContribution / purchasePrice) * 100)
}

export interface EligibilityInput {
  purchasePrice: number
  ownContribution: number
  termMonths: number
}

export interface ProductConstraints {
  minAmount: number | null
  maxAmount: number | null
  minOwnContributionPercentage: number | null
  termMinMonths: number | null
  termMaxMonths: number | null
}

/**
 * Komt deze aanvraag binnen de grenzen van het product?
 *
 * Geeft redenen terug in plaats van een boolean: "je komt niet in aanmerking"
 * zonder te zeggen waarom is precies het soort ondoorzichtigheid waar dit
 * platform tegenover staat.
 */
export function checkEligibility(
  input: EligibilityInput,
  constraints: ProductConstraints,
): { eligible: boolean; reasons: string[] } {
  const amount = input.purchasePrice - input.ownContribution
  const reasons: string[] = []

  if (constraints.minAmount !== null && amount < constraints.minAmount) {
    reasons.push(`Minimaal te financieren bedrag is ${constraints.minAmount} €.`)
  }
  if (constraints.maxAmount !== null && amount > constraints.maxAmount) {
    reasons.push(`Maximaal te financieren bedrag is ${constraints.maxAmount} €.`)
  }
  if (constraints.minOwnContributionPercentage !== null) {
    const pct = ownContributionPercentage(input.purchasePrice, input.ownContribution)
    if (pct < constraints.minOwnContributionPercentage) {
      reasons.push(
        `Dit product vraagt minstens ${constraints.minOwnContributionPercentage} % eigen inbreng; je hebt er ${pct} %.`,
      )
    }
  }
  if (constraints.termMinMonths !== null && input.termMonths < constraints.termMinMonths) {
    reasons.push(`Kortste looptijd is ${constraints.termMinMonths} maanden.`)
  }
  if (constraints.termMaxMonths !== null && input.termMonths > constraints.termMaxMonths) {
    reasons.push(`Langste looptijd is ${constraints.termMaxMonths} maanden.`)
  }

  return { eligible: reasons.length === 0, reasons }
}
