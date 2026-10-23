/**
 * Supported currencies (§16).
 *
 * The database stores currency as a plain ISO-4217 string so adding one is a data
 * change, not a migration. This list is what the UI offers and what Zod validates.
 */

export interface CurrencyDefinition {
  code: string
  symbol: string
  name: string
  /** Minor units. All supported currencies happen to use 2, but the engine reads it. */
  decimals: number
}

export const CURRENCIES: readonly CurrencyDefinition[] = [
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'Pound Sterling', decimals: 2 },
  { code: 'MAD', symbol: 'DH', name: 'Marokkaanse dirham', decimals: 2 },
  { code: 'TRY', symbol: '₺', name: 'Turkse lira', decimals: 2 },
  { code: 'SAR', symbol: 'SR', name: 'Saoedische riyal', decimals: 2 },
  { code: 'AED', symbol: 'AED', name: 'VAE-dirham', decimals: 2 },
] as const

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code)

export const DEFAULT_CURRENCY = 'EUR'

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]))

export function getCurrency(code: string): CurrencyDefinition | undefined {
  return BY_CODE.get(code.toUpperCase())
}

export function isSupportedCurrency(code: string): boolean {
  return BY_CODE.has(code.toUpperCase())
}

/** Minor units for a currency, defaulting to 2 for anything unknown. */
export function currencyDecimals(code: string): number {
  return BY_CODE.get(code.toUpperCase())?.decimals ?? 2
}
