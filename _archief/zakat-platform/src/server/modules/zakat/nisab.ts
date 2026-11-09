import { metalValueMinor, toMinorUnits } from '@/lib/money'
import { InvalidNisabConfigurationError } from '@/server/modules/zakat/errors'
import type { NisabInput, NisabResult } from '@/server/modules/zakat/types'

/**
 * The nisab engine (§9, §10).
 *
 * A pure function: prices are handed in, never fetched. That is what makes a
 * nisab reproducible — recomputing a historical calculation means replaying the
 * stored price, not asking a provider what gold costs today.
 *
 * The weights come from the ruleset (85 g gold / 595 g silver in the default
 * set), so changing them is a data change with a source attached, not a code
 * change.
 */
export function computeNisab(input: NisabInput): NisabResult {
  switch (input.basis) {
    case 'GOLD':
      return fromMetal(input, input.ruleSet.goldNisabGrams)

    case 'SILVER':
      return fromMetal(input, input.ruleSet.silverNisabGrams)

    case 'CUSTOM':
      return fromCustom(input)

    default: {
      // Exhaustiveness guard: adding a basis to the enum without handling it here
      // becomes a compile error rather than a silently wrong nisab.
      const unreachable: never = input.basis
      throw new InvalidNisabConfigurationError(`Onbekende nisab-basis: ${String(unreachable)}`)
    }
  }
}

function fromMetal(input: NisabInput, grams: string): NisabResult {
  const price = input.metalPrice

  if (!price) {
    throw new InvalidNisabConfigurationError(
      'Voor een nisab op basis van goud of zilver is een metaalprijs nodig.',
    )
  }

  if (price.currency.toUpperCase() !== input.currency.toUpperCase()) {
    // Converting here would hide which currency the price was actually quoted
    // in; the caller resolves the price in the target currency instead.
    throw new InvalidNisabConfigurationError(
      `De metaalprijs staat in ${price.currency} maar de berekening in ${input.currency}.`,
    )
  }

  return {
    basis: input.basis,
    currency: input.currency,
    valueMinor: metalValueMinor(grams, price.pricePerGram, input.currency),
    metalWeightGrams: grams,
    pricePerGram: price.pricePerGram,
    priceProvider: price.provider,
    priceSourceType: price.sourceType,
    priceObservedAt: price.observedAt,
    manual: price.sourceType === 'MANUAL',
  }
}

function fromCustom(input: NisabInput): NisabResult {
  if (!input.customValue) {
    throw new InvalidNisabConfigurationError(
      'Je hebt een handmatige nisab gekozen maar nog geen bedrag ingevuld.',
    )
  }

  const valueMinor = toMinorUnits(input.customValue, input.currency)

  if (valueMinor <= 0) {
    throw new InvalidNisabConfigurationError('Een handmatige nisab moet groter dan nul zijn.')
  }

  return {
    basis: 'CUSTOM',
    currency: input.currency,
    valueMinor,
    metalWeightGrams: null,
    pricePerGram: null,
    // No provider, no timestamp: presenting a hand-typed number as if it came
    // from a market feed is exactly the misattribution §23 forbids.
    priceProvider: null,
    priceSourceType: 'MANUAL',
    priceObservedAt: null,
    manual: true,
  }
}
