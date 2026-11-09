import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api-response";
import { clientKey, enforceRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/config/env";
import { getAnalysisHistory } from "@/server/services/analysisService";
import { toAnalysisDto } from "@/server/services/analysisPresenter";
import { productIdParamSchema } from "@/server/validators/product";

/**
 * GET /api/products/:id/analyses — de analysehistorie.
 *
 * Analyses worden nooit ge-update, alleen toegevoegd. Deze route maakt dat
 * zichtbaar: je kunt zien dat een product eerst MUSHBOOH was op basis van
 * revisie 3 en daarna LIKELY_HALAL op basis van revisie 4, en onder welke
 * engineversie elk oordeel viel.
 */
const MAX_HISTORY = 20;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleRoute("GET /api/products/:id/analyses", async () => {
    const env = serverEnv();
    enforceRateLimit({
      key: clientKey(request, "analysis-history"),
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    });

    const { id } = productIdParamSchema.parse(await context.params);
    const analyses = await getAnalysisHistory(id, MAX_HISTORY);

    return {
      data: { analyses: analyses.map(toAnalysisDto) },
      meta: { productId: id, count: analyses.length, limit: MAX_HISTORY },
    };
  });
}
