import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api-response";
import { clientKey, enforceRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/config/env";
import { lookupProductByBarcode } from "@/server/services/productLookupService";
import { toProductDetail } from "@/server/services/productPresenter";
import { getLatestAnalysis, productAnalyzer } from "@/server/services/analysisService";
import { toAnalysisDto, type AnalysisDto } from "@/server/services/analysisPresenter";
import { describeError } from "@/lib/errors";
import { barcodeParamSchema } from "@/server/validators/product";

/**
 * GET /api/products/barcode/:barcode
 *
 * `?refresh=true` negeert de TTL en dwingt een providercall af.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ barcode: string }> },
): Promise<Response> {
  return handleRoute("GET /api/products/barcode/:barcode", async ({ log }) => {
    const env = serverEnv();
    enforceRateLimit({
      key: clientKey(request, "barcode-lookup"),
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    });

    const { barcode } = barcodeParamSchema.parse(await context.params);
    const force = request.nextUrl.searchParams.get("refresh") === "true";

    const result = await lookupProductByBarcode(barcode, {
      force,
      log,
      analyzer: productAnalyzer,
    });

    // De analyse wordt apart opgehaald en mag het productresultaat niet slopen.
    // Een gevonden product met een mislukte analyse is voor de gebruiker nog
    // steeds waardevol: naam, merk, foto en ingrediënten kloppen, alleen het
    // oordeel ontbreekt. Een 500 teruggeven zou dat allemaal weggooien voor een
    // probleem dat de UI prima kan tonen.
    let analysis: AnalysisDto | null = null;
    let analysisStatus: "OK" | "NONE" | "FAILED" = "NONE";

    try {
      const stored = await getLatestAnalysis(result.product.id);
      if (stored) {
        analysis = toAnalysisDto(stored);
        analysisStatus = "OK";
      }
    } catch (error) {
      analysisStatus = "FAILED";
      log.error("PRODUCT_ANALYSIS_FAILED", {
        productId: result.product.id,
        ...describeError(error),
      });
    }

    return {
      data: { product: toProductDetail(result.product), analysis },
      meta: {
        source: result.product.externalSource ?? "MANUAL",
        provider: result.providerName,
        cached: result.cached,
        stale: result.stale,
        lookupSource: result.source,
        analysisStatus,
      },
    };
  });
}
