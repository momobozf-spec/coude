/**
 * Beheertoegang — één implementatie voor alle beheeracties.
 *
 * TIJDELIJKE MVP-MAATREGEL. Zolang er geen echte authenticatie is, is dit
 * gedeelde token de enige poort. Twee eigenschappen zijn bewust zo gekozen:
 *
 *  1. Geen token ingesteld betekent DICHT, niet open. Andersom zou een
 *     productie-installatie waar iemand `ADMIN_API_TOKEN` vergat te zetten
 *     stilzwijgend zijn beheeracties voor iedereen openzetten.
 *  2. De vergelijking is lengte-onafhankelijk in tijd. Een gewone `!==` lekt via
 *     de responstijd hoeveel tekens van een gok kloppen; bij een gedeeld geheim
 *     dat nergens roteert is dat het aanvalspad dat overblijft.
 *
 * Dit hoort in fase 7/8 vervangen te worden door een rol-check op een echte
 * sessie. Tot die tijd staat de logica hier, op één plek, zodat er geen tweede
 * variant kan ontstaan die net iets anders controleert.
 *
 * Dit token blijft server-side. Het staat niet in een `NEXT_PUBLIC_`-variabele
 * en wordt nooit naar de browser gestuurd.
 */
import { timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

const HEADER = "x-admin-token";

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual eist gelijke lengtes; die check zelf lekt alleen de lengte,
  // niet de inhoud.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * @throws {AppError} FORBIDDEN wanneer er geen token geconfigureerd is,
 *                    UNAUTHORIZED wanneer het meegestuurde token niet klopt.
 */
export function requireAdminAccess(
  request: { headers: { get(name: string): string | null } },
  configuredToken: string | undefined,
): void {
  if (!configuredToken) {
    throw new AppError(
      "FORBIDDEN",
      "Deze actie vereist een beheerderstoken; ADMIN_API_TOKEN is op deze server niet ingesteld.",
    );
  }

  const provided = request.headers.get(HEADER);
  if (!provided || !safeEquals(provided, configuredToken)) {
    throw new AppError("UNAUTHORIZED", "Ongeldig of ontbrekend beheerderstoken.");
  }
}
