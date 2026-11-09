/**
 * Het contract voor een financieringsberekening.
 *
 * ─── WAAROM PER CONSTRUCTIE EEN EIGEN CALCULATOR ─────────────────────────────
 *
 * Murabaha, ijara en diminishing musharaka leiden alle drie tot een vast
 * maandbedrag, maar dat bedrag betekent iets anders. Bij murabaha los je een
 * afgesproken totaalprijs af. Bij ijara betaal je huur. Bij musharaka koop je
 * maandelijks een stuk eigendom over én betaal je een vergoeding voor het deel
 * dat nog niet van jou is.
 *
 * Alles door één functie duwen die overal "rente" van maakt, is precies de
 * gelijkschakeling die dit platform hoort te vermijden. Elke calculator bepaalt
 * daarom zelf hoe hij zijn uitkomst benoemt en welke onderdelen hij toont.
 *
 * ─── CORRECTHEID GAAT VOOR DEKKING ───────────────────────────────────────────
 *
 * Een calculator die de benodigde gegevens niet heeft, geeft `unavailable`
 * terug mét een reden. Hij verzint geen formule zodat er toch een bedrag op het
 * scherm staat. Een verkeerd bedrag is erger dan geen bedrag: op een leeg veld
 * belt de gebruiker de aanbieder, op een fout getal rekent hij zich rijk.
 */
import type { FinancingType } from '@prisma/client'

/** De versie van de gezamenlijke rekenmotor. Wordt bij elke quote opgeslagen. */
export const FINANCING_CALCULATOR_VERSION = 'financing-engine@1'

export interface FinancingInput {
  /** Aankoopprijs in hele euro's. */
  purchasePrice: number
  /** Eigen inbreng in hele euro's. */
  ownContribution: number
  termMonths: number
  /**
   * Tarief in basispunten per jaar (1 % = 100 bp). De betékenis hangt af van de
   * constructie: winstmarge bij murabaha, huurcomponent bij ijara, vergoeding
   * over het aandeel van de financier bij musharaka.
   */
  profitRateBasisPoints: number | null
  /** Eenmalige dossierkosten in hele euro's. */
  setupFeeAmount?: number | null
  currency?: string
}

export interface FinancingAssumption {
  key: string
  label: string
  value: string
}

/** Eén regel in de uitkomst. De labels verschillen per constructie. */
export interface FinancingBreakdownLine {
  key: string
  label: string
  /** Bedrag in eurocent. Null wanneer de regel geen bedrag is. */
  amountCents: number | null
  /** Toelichting bij deze regel, wanneer die nodig is. */
  detail?: string
}

export interface FinancingResultAvailable {
  available: true
  financingType: FinancingType
  currency: string

  amountFinancedCents: number
  /**
   * Wat je periodiek betaalt. `paymentLabel` zegt wát het is — "maandelijkse
   * aflossing", "maandelijkse huur", "maandbedrag (huur + overname)".
   */
  periodicPaymentCents: number
  paymentLabel: string
  periodsPerYear: number

  totalPaymentCents: number
  /** Alles bovenop het gefinancierde bedrag: marge/huur plus kosten. */
  totalCostCents: number
  feesCents: number
  termMonths: number

  breakdown: FinancingBreakdownLine[]
  assumptions: FinancingAssumption[]
  version: string
}

export interface FinancingResultUnavailable {
  available: false
  financingType: FinancingType
  /** Wat we misten. Wordt letterlijk aan de gebruiker getoond. */
  reason: string
  /** Welke productgegevens ontbreken. Voor de redactie. */
  missingFields: string[]
  version: string
}

export type FinancingResult = FinancingResultAvailable | FinancingResultUnavailable

export interface FinancingCalculator {
  readonly name: string
  supports(type: FinancingType): boolean
  calculate(input: FinancingInput): FinancingResult
}

// ─────────────────────────────────────────────────────────────────────────────
// Gedeeld rekenwerk
// ─────────────────────────────────────────────────────────────────────────────

export const CENTS_PER_UNIT = 100
export const DEFAULT_CURRENCY = 'EUR'

export class FinancingInputError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'FinancingInputError'
    this.code = code
  }
}

/**
 * Controleert de invoer die voor élke constructie geldt.
 *
 * Gooit met een code, zodat de API-laag er een nette fout van kan maken zonder
 * de tekst te moeten herkennen.
 */
export function assertValidInput(input: FinancingInput): void {
  const { purchasePrice, ownContribution, termMonths } = input

  if (!Number.isInteger(purchasePrice) || purchasePrice <= 0) {
    throw new FinancingInputError(
      'INVALID_PURCHASE_PRICE',
      'Aankoopprijs moet een positief bedrag in hele euro’s zijn',
    )
  }
  if (!Number.isInteger(ownContribution) || ownContribution < 0) {
    throw new FinancingInputError(
      'INVALID_OWN_CONTRIBUTION',
      'Eigen inbreng mag niet negatief zijn',
    )
  }
  if (ownContribution >= purchasePrice) {
    throw new FinancingInputError(
      'INVALID_OWN_CONTRIBUTION',
      'Eigen inbreng dekt de volledige aankoopprijs — er valt niets te financieren',
    )
  }
  if (!Number.isInteger(termMonths) || termMonths < 1 || termMonths > 480) {
    throw new FinancingInputError(
      'TERM_NOT_SUPPORTED',
      'Looptijd moet tussen 1 en 480 maanden liggen',
    )
  }
  if (input.profitRateBasisPoints !== null && input.profitRateBasisPoints !== undefined) {
    if (!Number.isInteger(input.profitRateBasisPoints) || input.profitRateBasisPoints < 0) {
      throw new FinancingInputError(
        'INVALID_RATE',
        'Tarief moet een geheel aantal basispunten zijn, minimaal 0',
      )
    }
    if (input.profitRateBasisPoints > 3000) {
      throw new FinancingInputError(
        'INVALID_RATE',
        'Tarief boven 30 % is vrijwel zeker een invoerfout',
      )
    }
  }
}

/**
 * De annuïteitenformule, in cent:
 *
 *   M = P · i / (1 − (1 + i)^−n)
 *
 * Bij i = 0 valt de formule uiteen door deling door nul; dan is het simpelweg
 * P/n. Die uitzondering staat expliciet, want een NaN hier is een maandlast van
 * "NaN €" op iemands scherm.
 */
export function annuityCents(
  principalCents: number,
  monthlyRate: number,
  months: number,
): number {
  if (monthlyRate === 0) return Math.round(principalCents / months)
  const factor = Math.pow(1 + monthlyRate, -months)
  return Math.round((principalCents * monthlyRate) / (1 - factor))
}

/** Basispunten per jaar → fractie per maand. 350 bp = 3,5 % per jaar. */
export function monthlyRateFrom(basisPoints: number): number {
  return basisPoints / 10_000 / 12
}

/** Basispunten als leesbaar percentage: 385 → "3,85 %". */
export function formatBasisPoints(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace('.', ',')} %`
}

/** De aannames die voor elke constructie gelden. */
export function baseAssumptions(input: FinancingInput): FinancingAssumption[] {
  return [
    {
      key: 'term',
      label: 'Looptijd',
      value: `${input.termMonths} maanden (${Math.round(input.termMonths / 12)} jaar)`,
    },
    {
      key: 'rate_fixed',
      label: 'Tariefzekerheid',
      value: 'Vast over de volledige looptijd. Een variabel tarief geeft een andere uitkomst.',
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
        'Een raming op basis van publieke productinformatie. Geen aanbod en geen offerte; de aanbieder bepaalt de werkelijke voorwaarden.',
    },
    { key: 'version', label: 'Versie rekenmethode', value: FINANCING_CALCULATOR_VERSION },
  ]
}

/** Bouwt het `unavailable`-antwoord. */
export function unavailable(
  financingType: FinancingType,
  reason: string,
  missingFields: string[],
): FinancingResultUnavailable {
  return {
    available: false,
    financingType,
    reason,
    missingFields,
    version: FINANCING_CALCULATOR_VERSION,
  }
}
