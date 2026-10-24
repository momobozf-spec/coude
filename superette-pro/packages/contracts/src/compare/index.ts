/**
 * Contracten van de supermarktvergelijker (bounded context `compare`).
 *
 * Staat naast de boetiekcontracten (`access`, `basket`, `gate`, …) en deelt er
 * alleen `auth` mee: dezelfde gebruiker, dezelfde sessie, een ander domein.
 */
export * from './enums';
export * from './store-chain';
export * from './product';
export * from './shopping-list';
export * from './preferences';
export * from './price-alert';
