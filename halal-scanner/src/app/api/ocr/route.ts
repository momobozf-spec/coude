import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api-response";
import { clientKey, enforceRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/config/env";
import { AppError } from "@/lib/errors";
import { extractIngredientText } from "@/server/services/ocrService";

/**
 * POST /api/ocr — tekst uit een foto van een ingrediëntenlijst.
 *
 * Neemt `multipart/form-data` met veld `image`. De afbeelding wordt niet
 * opgeslagen: hij bestaat als bytes voor de duur van dit request en verdwijnt
 * daarna. Zie `ocrService` voor de volledige privacyregels.
 *
 * TWEE LIMIETEN, want ze beschermen tegen verschillende dingen:
 *
 *   OCR_RATE_LIMIT         per afzender — tegen één doorgeslagen of kwaadwillende
 *                          client.
 *   OCR_GLOBAL_RATE_LIMIT  voor de hele instance — de kostenrem. Zonder deze
 *                          begrenst een per-IP-limiet niets zodra het verkeer
 *                          van veel adressen tegelijk komt, en dat is precies
 *                          het scenario waarin een betaalde provider duur wordt.
 *
 * De bestandsnaam wordt bewust NIET doorgegeven aan de service. Hij komt niet
 * verder dan deze functie.
 */
export async function POST(request: NextRequest): Promise<Response> {
  return handleRoute("POST /api/ocr", async () => {
    const env = serverEnv();

    enforceRateLimit({
      key: clientKey(request, "ocr"),
      limit: env.OCR_RATE_LIMIT,
      windowSeconds: env.OCR_RATE_WINDOW_SECONDS,
    });
    enforceRateLimit({
      key: "ocr:global",
      limit: env.OCR_GLOBAL_RATE_LIMIT,
      windowSeconds: env.OCR_RATE_WINDOW_SECONDS,
    });

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new AppError(
        "UNSUPPORTED_MEDIA_TYPE",
        "Stuur de afbeelding als multipart/form-data met het veld 'image'.",
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AppError("VALIDATION_ERROR", "De afbeelding kon niet gelezen worden.", {
        details: { reason: "INVALID_FORM_DATA" },
      });
    }

    const file = formData.get("image");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "Er is geen afbeelding meegestuurd.", {
        details: { reason: "MISSING_IMAGE" },
      });
    }

    // Extra velden worden genegeerd in plaats van geweigerd: een browser of
    // proxy die iets meestuurt is geen fout. Maar er wordt er precies één
    // verwerkt, zodat tien afbeeldingen in één request niet tien keer kosten.
    const outcome = await extractIngredientText({
      image: await file.arrayBuffer(),
      mimeType: file.type,
    });

    return {
      data: {
        text: outcome.text,
        confidence: outcome.confidence,
        lowConfidence: outcome.lowConfidence,
        warnings: outcome.warnings,
      },
      // De ruwe providertekst gaat niet mee naar de client: de opgeschoonde
      // versie is wat de gebruiker bewerkt, en twee varianten naast elkaar
      // maken het alleen verwarrend. De herkomst (welke provider, welk model)
      // blijft eveneens server-side; die stuurt de UI niet.
      meta: { characters: outcome.text.length },
    };
  });
}
