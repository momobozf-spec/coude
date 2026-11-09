/**
 * Wat moet er gefinancierd worden?
 *
 * Puur, deterministisch, en zonder verrassingen aan de randen. De reden dat dit
 * een eigen bestand is en geen aftrekking op één regel: het geval "eigen
 * middelen zijn hoger dan de aankoopprijs" is echt — iemand die zijn vorige
 * woning verkocht, of die een bedrag intikt in de verkeerde eenheid — en een
 * negatief financieringsbedrag op het scherm is een bug die eruitziet als een
 * belediging.
 *
 * Bedragen in eurocent. Zie src/lib/money.ts.
 */

export interface FinancingNeedInput {
  purchasePriceCents: number | null
  ownContributionCents: number | null
}

export interface FinancingNeed {
  purchasePriceCents: number | null
  ownContributionCents: number | null
  /** Nooit negatief. Null wanneer we het niet kunnen bepalen. */
  neededCents: number | null
  /** Dekken de eigen middelen de hele aankoop? Dan is financiering overbodig. */
  fullyCovered: boolean
  /** Wat er overblijft wanneer de eigen middelen de prijs overtreffen. */
  surplusCents: number
  /** Aandeel eigen inbreng in hele procenten. Null zonder aankoopprijs. */
  ownContributionPercentage: number | null
  /** Welke gegevens ontbreken om dit rond te maken. */
  missing: ('purchasePrice' | 'ownContribution')[]
}

export function calculateFinancingNeed(input: FinancingNeedInput): FinancingNeed {
  const missing: FinancingNeed['missing'] = []
  if (input.purchasePriceCents === null) missing.push('purchasePrice')
  if (input.ownContributionCents === null) missing.push('ownContribution')

  if (input.purchasePriceCents === null || input.ownContributionCents === null) {
    return {
      purchasePriceCents: input.purchasePriceCents,
      ownContributionCents: input.ownContributionCents,
      neededCents: null,
      fullyCovered: false,
      surplusCents: 0,
      ownContributionPercentage:
        input.purchasePriceCents !== null &&
        input.purchasePriceCents > 0 &&
        input.ownContributionCents !== null
          ? Math.round((input.ownContributionCents / input.purchasePriceCents) * 100)
          : null,
      missing,
    }
  }

  const difference = input.purchasePriceCents - input.ownContributionCents

  return {
    purchasePriceCents: input.purchasePriceCents,
    ownContributionCents: input.ownContributionCents,
    // Max met nul: nooit een negatief bedrag tonen.
    neededCents: Math.max(0, difference),
    fullyCovered: difference <= 0,
    surplusCents: Math.max(0, -difference),
    ownContributionPercentage:
      input.purchasePriceCents > 0
        ? Math.min(100, Math.round((input.ownContributionCents / input.purchasePriceCents) * 100))
        : null,
    missing,
  }
}

/**
 * De boodschap bij deze situatie, in gewone taal.
 *
 * Staat in het domein en niet in een component, zodat het dashboard en de
 * financieringspagina niet elk hun eigen formulering krijgen.
 */
export function describeNeed(need: FinancingNeed): string {
  if (need.missing.length === 2) {
    return 'Vul je aankoopbudget en je eigen middelen in om te zien wat je moet financieren.'
  }
  if (need.missing.includes('purchasePrice')) {
    return 'Vul je aankoopbudget in om te zien wat je moet financieren.'
  }
  if (need.missing.includes('ownContribution')) {
    return 'Vul je eigen middelen in om te zien wat je moet financieren.'
  }
  if (need.fullyCovered) {
    return 'Je eigen middelen dekken de volledige aankoopprijs. Je hebt geen financiering nodig — houd wel rekening met de aankoopkosten.'
  }
  return 'Dit is het bedrag dat je zou moeten financieren, exclusief aankoopkosten.'
}
