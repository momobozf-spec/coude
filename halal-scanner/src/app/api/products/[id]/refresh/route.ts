import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api-response";
import { clientKey, enforceRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/config/env";
import { requireAdminAccess } from "@/lib/admin-access";
import { refreshProductById } from "@/server/services/productLookupService";
import { toProductDetail } from "@/server/services/productPresenter";
import { productIdParamSchema } from "@/server/validators/product";

/**
 * POST /api/products/:id/refresh
 *
 * Dwingt hersynchronisatie met de externe bron af, ongeacht de TTL. Bewust
 * strenger gelimiteerd dan een gewone lookup: dit endpoint veroorzaakt altijd
 * een externe call. Wordt in fase 8 admin-only.
 */
const REFRESH_LIMIT_PER_WINDOW = 5;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleRoute("POST /api/products/:id/refresh", async ({ log }) => {
    const env = serverEnv();

    // Zelfde poort als force-analyse: één implementatie, geen tweede
    // tokencontrole die net iets anders doet.
    requireAdminAccess(request, env.ADMIN_API_TOKEN);

    enforceRateLimit({
      key: clientKey(request, "product-refresh"),
      limit: REFRESH_LIMIT_PER_WINDOW,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    });

    const { id } = productIdParamSchema.parse(await context.params);
    const result = await refreshProductById(id, { log });

    return {
      data: { product: toProductDetail(result.product) },
      meta: {
        source: result.product.externalSource ?? "MANUAL",
        provider: result.providerName,
        cached: result.cached,
        stale: result.stale,
        lookupSource: result.source,
      },
    };
  });
}
