/**
 * Aankoopkosten: registratierechten, notariskosten, hypotheekkosten.
 *
 * DE KERNKEUZE: geen enkel percentage staat in dit bestand.
 *
 * De registratierechten in Vlaanderen zijn in vijf jaar drie keer gewijzigd
 * (10 % → 6 % → 3 % → 2 % voor een enige eigen woning). Elke wijziging die een
 * release vereist, is een wijziging die te laat komt en waarbij een gebruiker
 * intussen een verkeerd bedrag opzij zet. Daarom staan tarieven in de tabel
 * `CostRule`, met een geldigheidsvenster en een bron-URL, en bevat dit bestand
 * uitsluitend het rekenwerk.
 *
 * Wat hier wél staat: de vorm van een regel (Zod), en hoe je hem toepast.
 */
import { z } from 'zod'

/** De regeltypes die de rekenmachine kent. */
export const COST_RULE_TYPES = [
  'REGISTRATION_DUTY',
  'NOTARY_FEE',
  'MORTGAGE_REGISTRATION',
  'ADMINISTRATIVE_FEE',
  'VAT_NEW_BUILD',
] as const

export type CostRuleType = (typeof COST_RULE_TYPES)[number]

export const COST_RULE_LABELS: Record<CostRuleType, string> = {
  REGISTRATION_DUTY: 'Registratierechten',
  NOTARY_FEE: 'Notariskosten (ereloon)',
  MORTGAGE_REGISTRATION: 'Hypothecaire inschrijving',
  ADMINISTRATIVE_FEE: 'Aktekosten en opzoekingen',
  VAT_NEW_BUILD: 'Btw (nieuwbouw)',
}

// ─────────────────────────────────────────────────────────────────────────────
// De vorm van een regel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Percentages in basispunten (1 % = 100 bp). Int, want 2,5 % moet exact 250
 * zijn en niet 2.4999999999999996.
 */
const basisPoints = z.number().int().min(0).max(10_000)

/** Eén vast percentage over de hele grondslag. */
const flatPercentage = z.object({
  kind: z.literal('FLAT_PERCENTAGE'),
  basisPoints,
  /**
   * Aftrek op de grondslag vóór berekening, in hele euro's. Zo werkt de
   * Vlaamse abattement-regeling: niet het tarief daalt, de grondslag doet dat.
   */
  baseDeduction: z.number().int().min(0).optional(),
  /** Ander tarief wanneer het om een enige eigen woning gaat. */
  firstHomeBasisPoints: basisPoints.optional(),
  firstHomeBaseDeduction: z.number().int().min(0).optional(),
})

/**
 * Schijventarief: elke schijf heeft zijn eigen percentage over het deel van het
 * bedrag dat erin valt. Zo werkt het notarieel ereloon.
 */
const bracketed = z.object({
  kind: z.literal('BRACKETED'),
  brackets: z
    .array(
      z.object({
        /** Bovengrens van deze schijf in hele euro's; null = oneindig. */
        upTo: z.number().int().positive().nullable(),
        basisPoints,
      }),
    )
    .min(1),
  /** Ondergrens van het totaal, in hele euro's. */
  minimumAmount: z.number().int().min(0).optional(),
})

/** Vast bedrag, ongeacht de prijs. */
const fixedAmount = z.object({
  kind: z.literal('FIXED_AMOUNT'),
  amount: z.number().int().min(0),
})

export const costRuleConfigurationSchema = z.discriminatedUnion('kind', [
  flatPercentage,
  bracketed,
  fixedAmount,
])

export type CostRuleConfiguration = z.infer<typeof costRuleConfigurationSchema>

export interface CostRuleRecord {
  id: string
  ruleType: string
  country: string
  region: string | null
  validFrom: Date
  validUntil: Date | null
  configuration: unknown
  sourceUrl: string | null
  lastVerifiedAt: Date | null
  notes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Toepassen
// ─────────────────────────────────────────────────────────────────────────────

export interface CostContext {
  /** Aankoopprijs in hele euro's. */
  purchasePrice: number
  /** Te financieren bedrag; grondslag voor de hypothecaire inschrijving. */
  financedAmount: number
  firstHome: boolean
}

/** Past één regelconfiguratie toe. Geeft een bedrag in hele euro's. */
export function applyCostRule(
  ruleType: CostRuleType,
  configuration: CostRuleConfiguration,
  context: CostContext,
): number {
  // De grondslag hangt af van het regeltype: een hypothecaire inschrijving
  // rekent over wat je leent, registratierechten over wat je koopt.
  const base =
    ruleType === 'MORTGAGE_REGISTRATION' ? context.financedAmount : context.purchasePrice

  switch (configuration.kind) {
    case 'FIXED_AMOUNT':
      return configuration.amount

    case 'FLAT_PERCENTAGE': {
      const useFirstHome = context.firstHome && configuration.firstHomeBasisPoints !== undefined
      const bp = useFirstHome
        ? (configuration.firstHomeBasisPoints ?? configuration.basisPoints)
        : configuration.basisPoints
      const deduction = useFirstHome
        ? (configuration.firstHomeBaseDeduction ?? 0)
        : (configuration.baseDeduction ?? 0)

      const taxable = Math.max(0, base - deduction)
      return Math.round((taxable * bp) / 10_000)
    }

    case 'BRACKETED': {
      let remaining = base
      let previousCeiling = 0
      let total = 0

      for (const bracket of configuration.brackets) {
        if (remaining <= 0) break
        const ceiling = bracket.upTo ?? Number.POSITIVE_INFINITY
        const span = Math.min(remaining, ceiling - previousCeiling)
        total += (span * bracket.basisPoints) / 10_000
        remaining -= span
        previousCeiling = ceiling
      }

      return Math.max(Math.round(total), configuration.minimumAmount ?? 0)
    }
  }
}

/**
 * De regel die geldt op een gegeven moment.
 *
 * Selecteert op land, gewest en geldigheidsvenster, en kiest bij meerdere
 * kandidaten de meest recente `validFrom`. Een regel zonder gewest geldt voor
 * het hele land; een regel mét gewest wint van een landelijke.
 */
export function selectApplicableRule(
  rules: readonly CostRuleRecord[],
  criteria: { ruleType: CostRuleType; country: string; region: string | null; on: Date },
): CostRuleRecord | null {
  const candidates = rules.filter(
    (rule) =>
      rule.ruleType === criteria.ruleType &&
      rule.country === criteria.country &&
      (rule.region === null || rule.region === criteria.region) &&
      rule.validFrom <= criteria.on &&
      (rule.validUntil === null || rule.validUntil > criteria.on),
  )

  if (candidates.length === 0) return null

  return candidates.reduce((best, rule) => {
    // Gewestelijk verslaat landelijk; daarna wint de recentste ingangsdatum.
    const bestSpecific = best.region !== null
    const ruleSpecific = rule.region !== null
    if (ruleSpecific !== bestSpecific) return ruleSpecific ? rule : best
    return rule.validFrom > best.validFrom ? rule : best
  })
}

export interface CostLine {
  ruleType: CostRuleType
  label: string
  amount: number
  sourceUrl: string | null
  lastVerifiedAt: Date | null
  notes: string | null
}

export interface CostEstimate {
  lines: CostLine[]
  /** Som van alle kostenposten, in hele euro's. */
  totalCosts: number
  /** Aankoopprijs + kosten. */
  totalRequired: number
  /** Wat de koper zelf moet hebben: eigen inbreng + alle kosten. */
  ownFundsRequired: number
  /** Regeltypes waarvoor geen geldige regel bestond. */
  missingRules: CostRuleType[]
}

/**
 * De volledige kostenraming.
 *
 * Ontbrekende regels worden gerapporteerd, niet stilzwijgend op 0 gezet. Een
 * kostenraming zonder registratierechten die er wél uitziet als een compleet
 * antwoord is erger dan geen raming: de gebruiker zet duizenden euro's te weinig
 * opzij.
 */
export function estimateCosts(options: {
  rules: readonly CostRuleRecord[]
  ruleTypes?: readonly CostRuleType[]
  purchasePrice: number
  ownContribution: number
  country: string
  region: string | null
  firstHome: boolean
  on?: Date
}): CostEstimate {
  const on = options.on ?? new Date()
  const financedAmount = Math.max(0, options.purchasePrice - options.ownContribution)
  const context: CostContext = {
    purchasePrice: options.purchasePrice,
    financedAmount,
    firstHome: options.firstHome,
  }

  const lines: CostLine[] = []
  const missingRules: CostRuleType[] = []

  for (const ruleType of options.ruleTypes ?? COST_RULE_TYPES) {
    const rule = selectApplicableRule(options.rules, {
      ruleType,
      country: options.country,
      region: options.region,
      on,
    })

    if (!rule) {
      missingRules.push(ruleType)
      continue
    }

    const parsed = costRuleConfigurationSchema.safeParse(rule.configuration)
    if (!parsed.success) {
      // Een onleesbare regel is hetzelfde probleem als een ontbrekende: we weten
      // het bedrag niet. Beter zichtbaar ontbrekend dan onzichtbaar fout.
      missingRules.push(ruleType)
      continue
    }

    lines.push({
      ruleType,
      label: COST_RULE_LABELS[ruleType],
      amount: applyCostRule(ruleType, parsed.data, context),
      sourceUrl: rule.sourceUrl,
      lastVerifiedAt: rule.lastVerifiedAt,
      notes: rule.notes,
    })
  }

  const totalCosts = lines.reduce((sum, line) => sum + line.amount, 0)

  return {
    lines,
    totalCosts,
    totalRequired: options.purchasePrice + totalCosts,
    ownFundsRequired: options.ownContribution + totalCosts,
    missingRules,
  }
}
