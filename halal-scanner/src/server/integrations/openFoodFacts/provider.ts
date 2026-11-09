import { logger } from "@/lib/logger";
import type { ProductDataProvider } from "../productData/types";
import type { ExternalProductData } from "@/types/product";
import {
  OpenFoodFactsClient,
  OPEN_FOOD_FACTS_PROVIDER_NAME,
  type OpenFoodFactsClientOptions,
} from "./client";
import { normalizeOpenFoodFactsProduct } from "./normalize";

/**
 * Open Food Facts als `ProductDataProvider`.
 *
 * De service kent alleen de interface; dat deze bron toevallig Open Food Facts
 * is, blijft hier binnen.
 */
export class OpenFoodFactsProvider implements ProductDataProvider {
  readonly name = OPEN_FOOD_FACTS_PROVIDER_NAME;
  readonly displayName = "Open Food Facts";
  /**
   * Nooit HIGH: Open Food Facts is door vrijwilligers ingevoerde data. Deze
   * waarde begrenst hoe zwaar de ingrediëntenlijst in de analyse mag wegen.
   */
  readonly confidence = "MEDIUM" as const;

  private readonly client: OpenFoodFactsClient;

  constructor(options: OpenFoodFactsClientOptions | OpenFoodFactsClient) {
    this.client =
      options instanceof OpenFoodFactsClient ? options : new OpenFoodFactsClient(options);
  }

  async getByBarcode(barcode: string): Promise<ExternalProductData | null> {
    const response = await this.client.fetchProduct(barcode);

    if (!response?.product) {
      logger.info("PRODUCT_NOT_FOUND", { provider: this.name, barcode });
      return null;
    }

    const normalized = normalizeOpenFoodFactsProduct(barcode, response.product);

    logger.info("PRODUCT_PROVIDER_SUCCESS", {
      provider: this.name,
      barcode,
      hasName: Boolean(normalized.name),
      hasIngredients: Boolean(normalized.ingredientsText),
      ingredientCount: normalized.ingredients?.length ?? 0,
    });

    return normalized;
  }
}
