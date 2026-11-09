import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api-response";
import { clientKey, enforceRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors";
import { requireAdminAccess } from "@/lib/admin-access";
import { analyzeProduct, getLatestAnalysis } from "@/server/services/analysisService";
import { toAnalysisDto } from "@/server/services/analysisPresenter";
import { productIdParamSchema } from "@/server/validators/product";

/**
 * GET /api/products/:id/analysis — de laatste analyse.
 *
 * Bewust géén analyse starten bij een GET: een GET hoort geen schrijfactie te
 * doen. Is er nog geen analyse, dan is dat een 404 met een duidelijke code; de
 * client kan dan de POST gebruiken of een barcode-lookup doen, die wél
 * analyseert.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleRoute("GET /api/products/:id/analysis", async () => {
    const env = serverEnv();
    enforceRateLimit({
      key: clientKey(request, "analysis-read"),
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    });

    const { id } = productIdParamSchema.parse(await context.params);
    const analysis = await getLatestAnalysis(id);

    if (!analysis) {
      throw new AppError("RESOURCE_NOT_FOUND", "Voor dit product is nog geen analyse gemaakt.", {
        details: { productId: id },
      });
    }

    return { data: { analysis: toAnalysisDto(analysis) }, meta: { productId: id } };
  });
}

/**
 * POST /api/products/:id/analysis — forceer een nieuwe analyse.
 *
 * TIJDELIJKE MVP-MAATREGEL: beschermd via dezelfde admin/development-abstractie
 * als de refresh-route, omdat authenticatie nog niet bestaat. Zodra fase 7/8
 * echte auth heeft, moet dit een rol-check worden — dit is geen eindsituatie.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleRoute("POST /api/products/:id/analysis", async ({ log }) => {
    const env = serverEnv();

    requireAdminAccess(request, env.ADMIN_API_TOKEN);

    enforceRateLimit({
      key: clientKey(request, "analysis-force"),
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    });

    const { id } = productIdParamSchema.parse(await context.params);

    const result = await analyzeProduct(id, { force: true });
    log.info("PRODUCT_ANALYZED", { productId: id, analysisId: result.analysis.id, forced: true });

    return {
      data: { analysis: toAnalysisDto(result.analysis) },
      meta: { productId: id, reused: result.reused, forced: true },
    };
  });
}

