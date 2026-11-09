import type { ExternalProductData } from "@/types/product";

/**
 * Contract voor elke externe productbron.
 *
 * De productservice kent alleen deze interface. Een nieuwe bron toevoegen
 * (fabrikantendata, GS1, een commerciële database) betekent één implementatie
 * schrijven en registreren - niet de service herschrijven.
 *
 * Afspraken waar elke implementatie zich aan houdt:
 *
 *  - `getByBarcode` geeft `null` als het product er aantoonbaar niet is.
 *  - Een storing, timeout of 5xx gooit een `ProviderError`. Dat onderscheid is
 *    essentieel: "niet gevonden" mag een lokaal product ongemoeid laten
 *    bestaan, een storing mag dat nóóit als verwijderd of ongeldig markeren.
 *  - De implementatie levert al genormaliseerde `ExternalProductData` op; de
 *    service krijgt nooit ruwe providerspecifieke velden te zien.
 */
export interface ProductDataProvider {
  /** Stabiele, korte identificatie, bv. "open_food_facts". */
  readonly name: string;

  /** Menselijke naam voor in de UI ("Open Food Facts"). */
  readonly displayName: string;

  /**
   * Hoe betrouwbaar deze bron is. Open Food Facts is community-data en is
   * daarom nooit HIGH. De waarde belandt in `Product.sourceConfidence` en
   * begrenst hoe zwaar deze data in de analyse mag wegen.
   */
  readonly confidence: "HIGH" | "MEDIUM" | "LOW";

  /**
   * @returns het product, of `null` als de bron bevestigt dat het niet bestaat.
   * @throws  {ProviderError} bij timeout, netwerkfout, rate limiting of 5xx.
   */
  getByBarcode(barcode: string): Promise<ExternalProductData | null>;
}
