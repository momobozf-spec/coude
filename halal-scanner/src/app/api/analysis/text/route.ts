import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleRoute } from "@/lib/api-response";
import { clientKey, enforceRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/config/env";
import { analyzeIngredientText, MAX_INGREDIENT_TEXT_LENGTH } from "@/server/services/textAnalysisService";
import { toAnalysisDtoFromResult } from "@/server/services/analysisPresenter";

/**
 * POST /api/analysis/text — analyseer losse ingrediëntentekst.
 *
 * Gebruikt door de OCR-flow nadat de gebruiker de herkende tekst heeft
 * gecontroleerd, en door de handmatige invoer wanneer OCR niet lukt. Beide
 * lopen door exact dezelfde engine als een gescand product.
 *
 * Er wordt niets opgeslagen: deze tekst hoort bij geen enkel product. Zonder
 * product zijn er ook geen certificaten, dus deze route kan per definitie geen
 * `CERTIFIED_HALAL` opleveren — het beste resultaat is "geen aandachtspunt
 * gevonden in de ingrediënten".
 */
const bodySchema = z.object({
  text: z.string().min(1).max(MAX_INGREDIENT_TEXT_LENGTH),
});

export async function POST(request: NextRequest): Promise<Response> {
  return handleRoute("POST /api/analysis/text", async () => {
    const env = serverEnv();
    enforceRateLimit({
      key: clientKey(request, "analysis-text"),
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    });

    const body = bodySchema.parse(await request.json());
    const outcome = await analyzeIngredientText(body.text);

    return {
      data: {
        analysis: toAnalysisDtoFromResult(outcome.analysis),
        // Waarschuwingen over de tekst zelf: zonder deze zou "geen
        // aandachtspunt gevonden" lezen als een oordeel over de hele lijst,
        // ook wanneer een deel niet gelezen kon worden.
        warnings: outcome.warnings,
      },
      meta: {
        ingredientCount: outcome.ingredientCount,
        // Expliciet, zodat de client nooit hoeft te gokken of hier een
        // certificaat in meegewogen kon zijn.
        source: "TEXT",
        persisted: false,
      },
    };
  });
}
