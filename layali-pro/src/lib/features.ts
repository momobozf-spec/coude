/**
 * Functies die per omgeving aan of uit staan (alleen aan serverkant gelezen).
 *
 * MARKETPLACE_ENABLED=1 zet de marktplaats aan: verkopers, diensten en de
 * pagina "verkopen op Layali". Standaard uit, zodat er nooit verkopers getoond
 * worden met wie geen overeenkomst bestaat.
 */
export function marketplaceEnabled(): boolean {
  return process.env.MARKETPLACE_ENABLED === "1";
}
