import { serverEnv } from "@/config/env";
import { OpenFoodFactsProvider } from "../openFoodFacts/provider";
import type { ProductDataProvider } from "./types";

/**
 * Register van externe productbronnen, op volgorde van voorkeur.
 *
 * De lookup probeert de bronnen op volgorde en stopt bij het eerste product dat
 * gevonden wordt. Een nieuwe bron toevoegen (fabrikantendata, GS1, een
 * commerciële database) is een regel in `buildProviders` - de service, de
 * repository en de API-laag veranderen niet mee.
 */

let cached: ProductDataProvider[] | undefined;

function buildProviders(): ProductDataProvider[] {
  const env = serverEnv();
  return [
    new OpenFoodFactsProvider({
      baseUrl: env.OPEN_FOOD_FACTS_BASE_URL,
      userAgent: env.OPEN_FOOD_FACTS_USER_AGENT,
    }),
  ];
}

export function getProductDataProviders(): ProductDataProvider[] {
  cached ??= buildProviders();
  return cached;
}

export function getProductDataProvider(name: string): ProductDataProvider | undefined {
  return getProductDataProviders().find((provider) => provider.name === name);
}

/** Alleen voor tests: leegt de cache zodat een volgende call opnieuw bouwt. */
export function resetProductDataProviders(): void {
  cached = undefined;
}
