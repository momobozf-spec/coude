/**
 * Financieringslogica.
 *
 * De laag tussen route handlers/server actions en de database. Beslissingen die
 * puur zijn — rekenen, vergelijken, herkomst beoordelen — staan in `domain/` en
 * worden hier alleen aangeroepen. Geen enkele financiële of religieuze regel is
 * hier gedupliceerd.
 */
import 'server-only'
import {
  AnalyticsEventType,
  FinancingQuoteStatus,
  type FinancingType,
  type Prisma,
  type ShariahAssessmentStatus,
} from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { recordAudit } from '@/modules/audit/service'
import { recordEvent } from '@/modules/analytics/service'
import * as journeyRepository from '@/modules/journey/repository'
import { eurosFromCents, isSupportedCurrency, roundToWholeEuros } from '@/lib/money'
import { calculateFinancing } from './domain/calculators'
import type { FinancingResult } from './domain/calculators/types'
import {
  compareFinancingProducts,
  sortProducts,
  type ComparableProduct,
  type FinancingComparison,
  type FinancingSort,
  MAX_FINANCING_COMPARE,
} from './domain/comparison'
import { assertDemoNeverVerified } from './domain/demo'
import { financingErrors } from './domain/errors'
import { getFinancingFreshness, type Freshness } from './domain/freshness'
import { calculateFinancingNeed, describeNeed, type FinancingNeed } from './domain/need'
import {
  assessmentDisclosure,
  isPublishable,
  validateAssessment,
  ASSESSMENT_PRESENTATION,
  type ShariahAssessment,
} from './domain/shariah'
import * as repository from './repository'

// ─────────────────────────────────────────────────────────────────────────────
// Financieringsbehoefte
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancingContext {
  need: FinancingNeed
  needExplanation: string
  journeyId: string | null
  currency: string
}

/**
 * Wat moet deze gebruiker financieren?
 *
 * `overrides` laat een woning of een handmatige invoer voorgaan op wat er in
 * het traject staat — dat is de brug tussen een woningpagina en deze module.
 */
export async function getFinancingContext(
  userId: string,
  overrides: { purchasePriceCents?: number | null; ownContributionCents?: number | null } = {},
): Promise<FinancingContext> {
  const journey = await journeyRepository.findActiveJourney(userId)

  const need = calculateFinancingNeed({
    purchasePriceCents: overrides.purchasePriceCents ?? journey?.targetBudgetCents ?? null,
    ownContributionCents:
      overrides.ownContributionCents ?? journey?.ownContributionCents ?? null,
  })

  return {
    need,
    needExplanation: describeNeed(need),
    journeyId: journey?.id ?? null,
    currency: 'EUR',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Producten
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductView {
  id: string
  slug: string
  name: string
  description: string
  structureExplanation: string | null
  financingType: FinancingType
  currency: string
  isDemo: boolean

  provider: {
    id: string
    name: string
    website: string | null
    verified: boolean
    isDemo: boolean
  }

  minAmount: number | null
  maxAmount: number | null
  minOwnContributionPercentage: number | null
  termMinMonths: number | null
  termMaxMonths: number | null
  setupFeeAmount: number | null
  feesDescription: string | null
  profitRateBasisPoints: number | null
  rateBasisDescription: string | null

  /** De herkomst van de shariah-bewering, kant-en-klaar voor de UI. */
  assessment: {
    status: ShariahAssessmentStatus
    label: string
    statement: string
    tone: string
    certificationBody: string | null
    certificationUrl: string | null
    sourceUrl: string | null
    lastVerifiedAt: Date | null
    disclosure: string[]
    /** Voldoet de beoordeling aan haar eigen regels? Zo niet: niet tonen. */
    publishable: boolean
    problems: string[]
  }

  freshness: Freshness
  /** Kunnen we voor deze constructie überhaupt rekenen? */
  calculationSupported: boolean
}

type ProductRow = repository.ProductWithProvider

function toAssessment(product: ProductRow): ShariahAssessment {
  return {
    status: product.shariahAssessmentStatus,
    certificationBody: product.certificationBody,
    certificationUrl: product.certificationUrl,
    sourceUrl: product.sourceUrl,
    lastVerifiedAt: product.lastVerifiedAt,
    disclaimer: product.disclaimer,
  }
}

/**
 * Zet een databaserij om in een weergavemodel.
 *
 * Twee dingen gebeuren hier en nergens anders:
 *
 *  1. `assertDemoNeverVerified` — een verzonnen aanbieder die als geverifieerd
 *     gemarkeerd staat is een datafout die de UI nooit mag doorlaten.
 *  2. `validateAssessment` — de UI krijgt te horen óf de beoordeling
 *     publiceerbaar is. Een `CERTIFIED`-badge zonder certificerend orgaan wordt
 *     zo onmogelijk, ongeacht welke component hem tekent.
 */
export function toProductView(product: ProductRow, now?: Date): ProductView {
  assertDemoNeverVerified(
    { isDemo: product.provider.isDemo, verified: product.provider.verified },
    `Aanbieder ${product.provider.name}`,
  )

  const assessment = toAssessment(product)
  const problems = validateAssessment(assessment)
  const presentation = ASSESSMENT_PRESENTATION[product.shariahAssessmentStatus]

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    structureExplanation: product.structureExplanation,
    financingType: product.financingType,
    currency: product.currency,
    isDemo: product.isDemo || product.provider.isDemo,

    provider: {
      id: product.provider.id,
      name: product.provider.name,
      website: product.provider.website,
      verified: product.provider.verified,
      isDemo: product.provider.isDemo,
    },

    minAmount: product.minAmount,
    maxAmount: product.maxAmount,
    minOwnContributionPercentage: product.minOwnContributionPercentage,
    termMinMonths: product.termMinMonths,
    termMaxMonths: product.termMaxMonths,
    setupFeeAmount: product.setupFeeAmount,
    feesDescription: product.feesDescription,
    profitRateBasisPoints: product.profitRateBasisPoints,
    rateBasisDescription: product.rateBasisDescription,

    assessment: {
      status: product.shariahAssessmentStatus,
      label: presentation.label,
      statement: presentation.statement,
      tone: presentation.tone,
      certificationBody: product.certificationBody,
      certificationUrl: product.certificationUrl,
      sourceUrl: product.sourceUrl,
      lastVerifiedAt: product.lastVerifiedAt,
      disclosure: assessmentDisclosure(assessment),
      publishable: isPublishable(assessment),
      problems: problems.map((p) => p.message),
    },

    freshness: getFinancingFreshness(product.lastVerifiedAt, { now }),
    calculationSupported: product.profitRateBasisPoints !== null,
  }
}

export async function listProductViews(
  filter: repository.ProductFilter = {},
): Promise<ProductView[]> {
  const products = await repository.listProducts(filter)
  return products.map((product) => toProductView(product))
}

export async function getProductView(productId: string): Promise<ProductView> {
  return toProductView(await repository.requireProduct(productId))
}

// ─────────────────────────────────────────────────────────────────────────────
// Rekenen
// ─────────────────────────────────────────────────────────────────────────────

export interface CalculateInput {
  productId: string
  /** Bedragen in eurocent; de omzetting naar hele euro's gebeurt hier. */
  purchasePriceCents: number
  ownContributionCents: number
  termMonths: number
}

export interface CalculationView {
  product: ProductView
  result: FinancingResult
}

/**
 * Rekent één product door voor een concrete situatie.
 *
 * Controleert eerst of de aanvraag binnen de grenzen van het product valt.
 * "Je komt niet in aanmerking" zonder reden is precies de ondoorzichtigheid
 * waar dit platform tegenover staat, dus elke afwijzing noemt het getal.
 */
export async function calculateForProduct(input: CalculateInput): Promise<CalculationView> {
  const product = await repository.requireProduct(input.productId)
  if (!product.active) throw financingErrors.productInactive()

  if (!isSupportedCurrency(product.currency)) {
    throw financingErrors.currencyNotSupported(product.currency)
  }

  // Van cent naar hele euro's op precies één plek. `roundToWholeEuros` maakt de
  // afronding expliciet; zie src/lib/money.ts.
  const purchasePrice = roundToWholeEuros(input.purchasePriceCents)
  const ownContribution = roundToWholeEuros(input.ownContributionCents)
  const amount = purchasePrice - ownContribution

  assertWithinProductLimits(product, { amount, ownContribution, purchasePrice, termMonths: input.termMonths })

  const result = calculateFinancing(product.financingType, {
    purchasePrice,
    ownContribution,
    termMonths: input.termMonths,
    profitRateBasisPoints: product.profitRateBasisPoints,
    setupFeeAmount: product.setupFeeAmount,
    currency: product.currency,
  })

  return { product: toProductView(product), result }
}

function assertWithinProductLimits(
  product: ProductRow,
  values: { amount: number; ownContribution: number; purchasePrice: number; termMonths: number },
): void {
  if (values.amount <= 0) {
    throw financingErrors.amountOutOfRange(
      'Je eigen middelen dekken de volledige aankoopprijs — er valt niets te financieren.',
    )
  }
  if (product.minAmount !== null && values.amount < product.minAmount) {
    throw financingErrors.amountOutOfRange(
      `Dit product financiert vanaf ${product.minAmount.toLocaleString('nl-BE')} €; jij hebt ${values.amount.toLocaleString('nl-BE')} € nodig.`,
    )
  }
  if (product.maxAmount !== null && values.amount > product.maxAmount) {
    throw financingErrors.amountOutOfRange(
      `Dit product financiert tot ${product.maxAmount.toLocaleString('nl-BE')} €; jij hebt ${values.amount.toLocaleString('nl-BE')} € nodig.`,
    )
  }
  if (product.minOwnContributionPercentage !== null) {
    const percentage = Math.round((values.ownContribution / values.purchasePrice) * 100)
    if (percentage < product.minOwnContributionPercentage) {
      throw financingErrors.ownContributionTooLow(
        `Dit product vraagt minstens ${product.minOwnContributionPercentage} % eigen inbreng; jij hebt ${percentage} %.`,
      )
    }
  }
  if (product.termMinMonths !== null && values.termMonths < product.termMinMonths) {
    throw financingErrors.termNotSupported(
      `De kortste looptijd van dit product is ${product.termMinMonths} maanden.`,
    )
  }
  if (product.termMaxMonths !== null && values.termMonths > product.termMaxMonths) {
    throw financingErrors.termNotSupported(
      `De langste looptijd van dit product is ${product.termMaxMonths} maanden.`,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vergelijken
// ─────────────────────────────────────────────────────────────────────────────

export interface CompareInput {
  productIds: readonly string[]
  purchasePriceCents: number
  ownContributionCents: number
  termMonths: number
  sort?: FinancingSort
}

/**
 * Vergelijkt producten voor één concrete situatie.
 *
 * Producten waarvoor niet gerekend kan worden vallen NIET weg: ze horen in de
 * vergelijking met "Niet beschikbaar", zodat de gebruiker ziet dát ze bestaan
 * en waarom er geen bedrag staat.
 */
export async function compareProducts(input: CompareInput): Promise<FinancingComparison> {
  if (input.productIds.length > MAX_FINANCING_COMPARE) {
    throw financingErrors.comparisonSizeInvalid(
      `Je kan hoogstens ${MAX_FINANCING_COMPARE} producten tegelijk vergelijken.`,
    )
  }

  const products = await repository.findProductsByIds(input.productIds)
  const purchasePrice = roundToWholeEuros(input.purchasePriceCents)
  const ownContribution = roundToWholeEuros(input.ownContributionCents)

  const comparable: ComparableProduct[] = products.map((product) => {
    assertDemoNeverVerified(
      { isDemo: product.provider.isDemo, verified: product.provider.verified },
      `Aanbieder ${product.provider.name}`,
    )

    return {
      id: product.id,
      name: product.name,
      providerName: product.provider.name,
      providerId: product.providerId,
      financingType: product.financingType,
      currency: product.currency,
      isDemo: product.isDemo || product.provider.isDemo,
      providerVerified: product.provider.verified,

      minOwnContributionPercentage: product.minOwnContributionPercentage,
      termMinMonths: product.termMinMonths,
      termMaxMonths: product.termMaxMonths,
      setupFeeAmount: product.setupFeeAmount,
      feesDescription: product.feesDescription,

      shariahAssessmentStatus: product.shariahAssessmentStatus,
      certificationBody: product.certificationBody,
      sourceUrl: product.sourceUrl,
      lastVerifiedAt: product.lastVerifiedAt,

      calculation: calculateFinancing(product.financingType, {
        purchasePrice,
        ownContribution,
        termMonths: input.termMonths,
        profitRateBasisPoints: product.profitRateBasisPoints,
        setupFeeAmount: product.setupFeeAmount,
        currency: product.currency,
      }),
    }
  })

  return compareFinancingProducts(sortProducts(comparable, input.sort ?? 'provider'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Quotes
// ─────────────────────────────────────────────────────────────────────────────

export interface SaveQuoteInput extends CalculateInput {
  journeyId?: string | null
  propertyId?: string | null
  status?: FinancingQuoteStatus
  notes?: string | null
}

/**
 * Bewaart een berekening als snapshot.
 *
 * Alles wat nodig is om de berekening te begrijpen gaat de rij in: de naam van
 * de aanbieder, het gehanteerde tarief, de shariah-status met haar bron en
 * verificatiedatum, en de versie van de rekenmotor. Zie de kop van
 * `FinancingQuote` in schema.prisma voor waarom die redundantie er hoort.
 */
export async function saveQuote(userId: string, input: SaveQuoteInput) {
  const { product, result } = await calculateForProduct(input)

  if (!result.available) {
    throw financingErrors.calculationNotSupported(result.reason)
  }

  // Eigendomscheck: een journeyId of propertyId van iemand anders mag niet
  // aan deze quote gekoppeld worden.
  if (input.journeyId) await journeyRepository.requireJourney(userId, input.journeyId)

  if (input.propertyId) {
    const saved = await prisma.savedProperty.findFirst({
      where: { userId, propertyId: input.propertyId },
      select: { id: true },
    })
    const exists = await prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true },
    })
    // De woning moet bestaan; hem bewaard hebben is niet verplicht, want je kan
    // rekenen aan een woning die je nog niet opsloeg.
    if (!exists) throw financingErrors.productNotFound()
    void saved
  }

  const quote = await repository.createQuote({
    userId,
    journeyId: input.journeyId ?? null,
    productId: product.id,
    propertyId: input.propertyId ?? null,
    status: input.status ?? FinancingQuoteStatus.INTERESTED,

    purchasePrice: roundToWholeEuros(input.purchasePriceCents),
    ownContribution: roundToWholeEuros(input.ownContributionCents),
    amountFinanced: eurosFromCents(result.amountFinancedCents),
    termMonths: result.termMonths,
    currency: result.currency,

    monthlyPaymentCents: result.periodicPaymentCents,
    totalPaymentCents: result.totalPaymentCents,
    totalCostCents: result.totalCostCents,
    feesCents: result.feesCents,

    providerName: product.provider.name,
    productName: product.name,
    financingType: product.financingType,
    profitRateBasisPoints: product.profitRateBasisPoints,
    rateBasisDescription: product.rateBasisDescription,
    shariahAssessmentStatus: product.assessment.status,
    certificationBody: product.assessment.certificationBody,
    sourceUrl: product.assessment.sourceUrl,
    sourceLastVerifiedAt: product.assessment.lastVerifiedAt,
    productWasDemo: product.isDemo,

    calculatorVersion: result.version,
    assumptions: result.assumptions as unknown as Prisma.InputJsonValue,
    notes: input.notes ?? null,
  })

  await recordAudit({
    userId,
    action: 'FINANCING_QUOTE_CREATED',
    entityType: 'FinancingQuote',
    entityId: quote.id,
    metadata: { productId: product.id, calculatorVersion: result.version },
  })

  await recordEvent({
    userId,
    type: AnalyticsEventType.FINANCING_QUOTE_SAVED,
    entityKey: product.slug,
    // Geen bedragen: zie de whitelist in src/modules/analytics/service.ts.
    properties: { source: product.financingType },
  })

  return quote
}

export async function setQuoteStatus(
  userId: string,
  quoteId: string,
  status: FinancingQuoteStatus,
): Promise<void> {
  await repository.updateQuoteMeta(userId, quoteId, { status })
}

// ─────────────────────────────────────────────────────────────────────────────
// Journey-integratie
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancingEvidence {
  quoteCount: number
  distinctProductsCompared: number
  hasShortlisted: boolean
  /**
   * Is er objectief bewijs dat de gebruiker financieringsvormen vergeleken
   * heeft? Twee verschillende producten doorgerekend en bewaard.
   */
  comparedAtLeastTwo: boolean
}

/**
 * Het objectieve bewijs waarop een journey-taak mag afgaan.
 *
 * Zie `src/modules/financing/journeyBridge.ts` voor wat er wél en niet
 * automatisch afgevinkt mag worden.
 */
export async function getFinancingEvidence(
  userId: string,
  journeyId?: string,
): Promise<FinancingEvidence> {
  const [quoteCount, distinct, shortlisted] = await Promise.all([
    repository.countQuotes(userId, journeyId),
    repository.countDistinctComparedProducts(userId, journeyId),
    prisma.financingQuote.count({
      where: {
        userId,
        ...(journeyId ? { journeyId } : {}),
        status: { in: [FinancingQuoteStatus.SHORTLISTED, FinancingQuoteStatus.SELECTED] },
      },
    }),
  ])

  return {
    quoteCount,
    distinctProductsCompared: distinct,
    hasShortlisted: shortlisted > 0,
    comparedAtLeastTwo: distinct >= 2,
  }
}

export { FinancingQuoteStatus }
