/**
 * Financieringsproducten naast elkaar.
 *
 * ─── GEEN "BESTE OPTIE" ──────────────────────────────────────────────────────
 *
 * Deze vergelijking wijst geen winnaar aan. Niet uit voorzichtigheid, maar omdat
 * er geen eerlijk criterium bestaat: de goedkoopste optie kan een zwakkere
 * shariah-onderbouwing hebben, de best gecertificeerde kan duurder zijn, en het
 * gewicht daarvan is een persoonlijke afweging.
 *
 * Wat we wél doen: per rij markeren welke waarde de gunstigste is, mét de
 * richting erbij, zodat de gebruiker ziet waaróp iets gunstig is. Rijen waarop
 * geen objectieve richting bestaat — zoals de shariah-status — krijgen géén
 * markering. Dat is de kern: de app rangschikt geen religieuze onderbouwing.
 *
 * ─── ONTBREKEND IS ONTBREKEND ────────────────────────────────────────────────
 *
 * Een product zonder gepubliceerde kosten toont "Niet beschikbaar", nooit "0".
 * Nul is een bewering; ontbrekend is de waarheid.
 */
import type { FinancingType, ShariahAssessmentStatus } from '@prisma/client'

import { ASSESSMENT_PRESENTATION } from './shariah'
import { getFinancingFreshness, type Freshness } from './freshness'
import type { FinancingResult } from './calculators/types'
import { financingErrors } from './errors'

export const MIN_FINANCING_COMPARE = 2
export const MAX_FINANCING_COMPARE = 4

export const COMPARISON_DISCLAIMER =
  'Deze vergelijking is gebaseerd op de gegevens die voor elk product beschikbaar zijn. ' +
  'Niet elke aanbieder publiceert dezelfde kostenstructuur of voorwaarden. ' +
  'Een ontbrekende waarde betekent dat de aanbieder die niet publiceert, niet dat ze nul is.'

export interface ComparableProduct {
  id: string
  name: string
  providerName: string
  providerId: string
  financingType: FinancingType
  currency: string
  isDemo: boolean
  providerVerified: boolean

  minOwnContributionPercentage: number | null
  termMinMonths: number | null
  termMaxMonths: number | null
  setupFeeAmount: number | null
  feesDescription: string | null

  shariahAssessmentStatus: ShariahAssessmentStatus
  certificationBody: string | null
  sourceUrl: string | null
  lastVerifiedAt: Date | null

  /** De doorrekening voor het gevraagde bedrag. Kan `unavailable` zijn. */
  calculation: FinancingResult
}

/** Richting: is hoger of lager gunstiger? `none` = geen objectief oordeel. */
export type CompareDirection = 'higher' | 'lower' | 'none'

export interface FinancingCompareCell {
  productId: string
  display: string
  /** Ruwe waarde voor de vergelijking. Null = niet beschikbaar. */
  value: number | null
  best: boolean
  /** Voor schermlezers, wanneer `display` een symbool bevat. */
  accessibleText?: string
}

export interface FinancingCompareRow {
  key: string
  label: string
  hint?: string
  direction: CompareDirection
  cells: FinancingCompareCell[]
  unavailableCount: number
}

export interface FinancingComparison {
  products: ComparableProduct[]
  rows: FinancingCompareRow[]
  /** Per product de herkomst van de shariah-bewering. Nooit gerangschikt. */
  assessments: {
    productId: string
    status: ShariahAssessmentStatus
    label: string
    statement: string
    certificationBody: string | null
    sourceUrl: string | null
    freshness: Freshness
  }[]
  disclaimer: string
  /** Zit er voorbeelddata bij? Dan hoort de UI dat prominent te zeggen. */
  containsDemo: boolean
}

const NOT_AVAILABLE = 'Niet beschikbaar'

const formatMoney = (cents: number | null, currency: string): string =>
  cents === null
    ? NOT_AVAILABLE
    : new Intl.NumberFormat('nl-BE', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(cents / 100)

interface RowDefinition {
  key: string
  label: string
  hint?: string
  direction: CompareDirection
  value: (p: ComparableProduct) => number | null
  display: (p: ComparableProduct) => string
}

const ROWS: RowDefinition[] = [
  {
    key: 'periodicPayment',
    label: 'Geschatte periodieke betaling',
    hint: 'Wat dit bedrag ís, verschilt per constructie: aflossing, huur, of huur plus overname.',
    direction: 'lower',
    value: (p) => (p.calculation.available ? p.calculation.periodicPaymentCents : null),
    display: (p) =>
      p.calculation.available
        ? `${formatMoney(p.calculation.periodicPaymentCents, p.currency)} — ${p.calculation.paymentLabel.toLowerCase()}`
        : NOT_AVAILABLE,
  },
  {
    key: 'totalPayment',
    label: 'Geschat totaal over de looptijd',
    direction: 'lower',
    value: (p) => (p.calculation.available ? p.calculation.totalPaymentCents : null),
    display: (p) =>
      p.calculation.available
        ? formatMoney(p.calculation.totalPaymentCents, p.currency)
        : NOT_AVAILABLE,
  },
  {
    key: 'totalCost',
    label: 'Kost bovenop het gefinancierde bedrag',
    hint: 'Marge of huur plus eenmalige kosten.',
    direction: 'lower',
    value: (p) => (p.calculation.available ? p.calculation.totalCostCents : null),
    display: (p) =>
      p.calculation.available
        ? formatMoney(p.calculation.totalCostCents, p.currency)
        : NOT_AVAILABLE,
  },
  {
    key: 'fees',
    label: 'Eenmalige kosten',
    direction: 'lower',
    value: (p) => (p.setupFeeAmount === null ? null : p.setupFeeAmount * 100),
    display: (p) =>
      p.setupFeeAmount === null ? NOT_AVAILABLE : formatMoney(p.setupFeeAmount * 100, p.currency),
  },
  {
    key: 'ownContribution',
    label: 'Vereiste eigen inbreng',
    direction: 'lower',
    value: (p) => p.minOwnContributionPercentage,
    display: (p) =>
      p.minOwnContributionPercentage === null
        ? NOT_AVAILABLE
        : `vanaf ${p.minOwnContributionPercentage} %`,
  },
  {
    key: 'termMax',
    label: 'Langste looptijd',
    direction: 'higher',
    value: (p) => p.termMaxMonths,
    display: (p) =>
      p.termMaxMonths === null ? NOT_AVAILABLE : `${Math.round(p.termMaxMonths / 12)} jaar`,
  },
]

/**
 * Bouwt de vergelijking.
 *
 * De shariah-status komt níet in `rows` maar in `assessments`: die hoort geen
 * "gunstigste" markering te krijgen. Een certificering vergelijken als was het
 * een rentevoet, is precies de gelijkschakeling die dit platform vermijdt.
 */
export function compareFinancingProducts(
  products: readonly ComparableProduct[],
  options: { now?: Date } = {},
): FinancingComparison {
  if (products.length < MIN_FINANCING_COMPARE) {
    throw financingErrors.comparisonSizeInvalid(
      `Kies minstens ${MIN_FINANCING_COMPARE} producten om te vergelijken.`,
    )
  }
  if (products.length > MAX_FINANCING_COMPARE) {
    throw financingErrors.comparisonSizeInvalid(
      `Je kan hoogstens ${MAX_FINANCING_COMPARE} producten tegelijk vergelijken.`,
    )
  }

  const rows: FinancingCompareRow[] = []

  for (const definition of ROWS) {
    const values = products.map((p) => definition.value(p))
    const known = values.filter((v): v is number => v !== null)

    if (known.length === 0) continue

    // Alleen markeren wanneer er iets te kiezen valt: bij één bekende waarde of
    // bij gelijkspel is niets gunstiger dan iets anders.
    const allEqual = known.every((v) => v === known[0])
    const bestValue =
      definition.direction === 'none' || known.length < 2 || allEqual
        ? null
        : definition.direction === 'higher'
          ? Math.max(...known)
          : Math.min(...known)

    rows.push({
      key: definition.key,
      label: definition.label,
      hint: definition.hint,
      direction: definition.direction,
      unavailableCount: values.length - known.length,
      cells: products.map((product, index) => ({
        productId: product.id,
        display: definition.display(product),
        value: values[index]!,
        best: bestValue !== null && values[index] === bestValue,
      })),
    })
  }

  return {
    products: [...products],
    rows,
    assessments: products.map((product) => ({
      productId: product.id,
      status: product.shariahAssessmentStatus,
      label: ASSESSMENT_PRESENTATION[product.shariahAssessmentStatus].label,
      statement: ASSESSMENT_PRESENTATION[product.shariahAssessmentStatus].statement,
      certificationBody: product.certificationBody,
      sourceUrl: product.sourceUrl,
      freshness: getFinancingFreshness(product.lastVerifiedAt, { now: options.now }),
    })),
    disclaimer: COMPARISON_DISCLAIMER,
    containsDemo: products.some((p) => p.isDemo),
  }
}

/**
 * Sorteeropties.
 *
 * Bewust geen "beste optie". `payment` sorteert op een objectief getal en zegt
 * dat ook in het label; wie op iets anders wil wegen, doet dat zelf.
 */
export type FinancingSort = 'provider' | 'payment' | 'ownContribution'

export const SORT_LABELS: Record<FinancingSort, string> = {
  provider: 'Naam van de aanbieder',
  payment: 'Laagste geschatte betaling',
  ownContribution: 'Laagste vereiste eigen inbreng',
}

export function sortProducts<T extends ComparableProduct>(
  products: readonly T[],
  sort: FinancingSort,
): T[] {
  const copy = [...products]

  // Voorbeelddata staat altijd achteraan, ongeacht de sortering.
  const byDemo = (a: T, b: T) => Number(a.isDemo) - Number(b.isDemo)

  switch (sort) {
    case 'payment':
      return copy.sort(
        (a, b) =>
          byDemo(a, b) ||
          // Producten zonder berekening onderaan: ze zijn niet "duurder",
          // maar er valt niets over te zeggen.
          paymentOf(a) - paymentOf(b),
      )
    case 'ownContribution':
      return copy.sort(
        (a, b) =>
          byDemo(a, b) ||
          (a.minOwnContributionPercentage ?? Number.MAX_SAFE_INTEGER) -
            (b.minOwnContributionPercentage ?? Number.MAX_SAFE_INTEGER),
      )
    case 'provider':
      return copy.sort(
        (a, b) => byDemo(a, b) || a.providerName.localeCompare(b.providerName, 'nl'),
      )
  }
}

function paymentOf(product: ComparableProduct): number {
  return product.calculation.available
    ? product.calculation.periodicPaymentCents
    : Number.MAX_SAFE_INTEGER
}
