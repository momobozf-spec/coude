import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { clientKey, enforceRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/config/env";
import { searchProducts } from "@/server/repositories/productRepository";
import { toProductSummary } from "@/server/services/productPresenter";
import { productSearchQuerySchema } from "@/server/validators/product";

/**
 * GET /api/products/search?q=&limit=&offset=
 *
 * Zoekt uitsluitend lokaal. Elke toetsaanslag naar Open Food Facts doorzetten
 * zou die API belasten en de zoekfunctie traag maken; externe zoekintegratie
 * komt later achter `includeExternal=true`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return handleRoute("GET /api/products/search", async ({ log }) => {
    const env = serverEnv();
    enforceRateLimit({
      key: clientKey(request, "product-search"),
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    });

    const params = productSearchQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    if (params.includeExternal) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Externe zoekintegratie is nog niet beschikbaar. Scan de barcode om een onbekend product op te halen.",
      );
    }

    const { hits, total } = await searchProducts({
      query: params.q,
      limit: params.limit,
      offset: params.offset,
    });

    log.info("PRODUCT_SEARCH", { termLength: params.q.length, results: hits.length });

    return {
      data: { products: hits.map(toProductSummary) },
      meta: {
        total,
        limit: params.limit,
        offset: params.offset,
        scope: "LOCAL",
      },
    };
  });
}
