/**
 * Boodschappenmandje doorrekenen: per winkel, goedkoopste combinatie en de
 * gebalanceerde keuze.
 *
 * Zuiver: werkt op DTO's uit `@superette/contracts`, zonder database. De
 * service laadt kandidaten per lijstregel; deze module beslist.
 *
 * ## Uitlegbaarheid
 *
 * Elke regel in elk resultaat draagt een `reason`: waarom dit aanbod, waarom
 * dit alternatief, waarom niets. De gebruiker moet kunnen zien waarom Lidl
 * "wint" — en of dat komt door een huismerk dat hij misschien niet wil.
 */
import type {
  BasketCompareInput,
  BasketLineResult,
  CatalogProductSummary,
  CombinationResult,
  ListItemConstraints,
  MatchType,
  ProductOffer,
  StoreBasketResult,
  StoreChainRef,
} from '@superette/contracts';
import { lineCost } from '../pricing/offer-pricing';

export interface OptimizerChain {
  readonly ref: StoreChainRef;
  readonly loyaltyCardName: string | null;
  /** Heeft de gebruiker een klantenkaart van deze keten? */
  readonly hasLoyaltyCard: boolean;
  /** Zijn er überhaupt prijzen van deze keten? */
  readonly hasData: boolean;
  /** Afstand tot de gebruiker, als bekend. */
  readonly distanceKm: number | null;
}

export interface OptimizerCandidate {
  readonly offer: ProductOffer;
  readonly product: CatalogProductSummary;
  /** Hoe het product van dit aanbod zich verhoudt tot wat op de lijst staat. */
  readonly matchType: MatchType;
}

export interface OptimizerItem {
  readonly itemId: string;
  readonly label: string;
  readonly quantity: number;
  /** Vrije tekstregel zonder product: wordt nergens meegerekend. */
  readonly freeText: boolean;
  readonly constraints: ListItemConstraints;
  /** Alle kandidaat-aanbiedingen, over alle ketens heen. */
  readonly candidates: readonly OptimizerCandidate[];
}

export interface OptimizerResult {
  readonly perStore: StoreBasketResult[];
  readonly bestSingleStore: StoreBasketResult | null;
  readonly cheapestCombination: CombinationResult | null;
  readonly balanced: CombinationResult | null;
  readonly summary: string;
  readonly freeTextLines: string[];
}

const MATCH_RANK: Readonly<Record<MatchType, number>> = Object.freeze({ EXACT: 3, EQUIVALENT: 2, ALTERNATIVE: 1, UNCERTAIN: 0 });

function formatEuro(cents: number): string {
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

interface ScoredCandidate {
  readonly candidate: OptimizerCandidate;
  readonly cost: ReturnType<typeof lineCost>;
}

/** Mag dit aanbod meedoen voor deze regel, bij deze keten, met deze instellingen? */
function isAllowed(
  item: OptimizerItem,
  candidate: OptimizerCandidate,
  chain: OptimizerChain,
  settings: BasketCompareInput,
): { ok: true } | { ok: false; reason: string } {
  const { offer, product, matchType } = candidate;
  const constraints = item.constraints;

  if (offer.provenance.status === 'EXPIRED') return { ok: false, reason: 'verlopen' };
  if (matchType === 'UNCERTAIN') return { ok: false, reason: 'onzekere match' };

  if (matchType === 'EQUIVALENT' && !constraints.allowAlternatives) {
    return { ok: false, reason: 'andere verpakking niet toegestaan' };
  }
  if (matchType === 'ALTERNATIVE') {
    if (!constraints.allowAlternatives) return { ok: false, reason: 'alternatieven niet toegestaan' };
    if (constraints.exactBrandRequired) return { ok: false, reason: 'exact merk verplicht' };
    if (!constraints.allowStoreBrand && product.brandType === 'STORE_BRAND') return { ok: false, reason: 'huismerk niet toegestaan' };
  }

  if (offer.requiresLoyaltyCard && !(settings.useLoyaltyCards && chain.hasLoyaltyCard)) {
    return { ok: false, reason: 'klantenkaart vereist' };
  }
  if (offer.isPersonalized && !settings.includePersonalizedOffers) return { ok: false, reason: 'persoonlijke aanbieding' };
  if (offer.channel === 'ONLINE' && !settings.includeOnlineOffers) return { ok: false, reason: 'alleen online' };

  return { ok: true };
}

function describeChoice(candidate: OptimizerCandidate, cost: ReturnType<typeof lineCost>): string {
  const parts: string[] = [];

  switch (candidate.matchType) {
    case 'EXACT':
      parts.push('Goedkoopste exacte match');
      break;
    case 'EQUIVALENT':
      parts.push('Andere verpakkingsgrootte toegestaan');
      break;
    case 'ALTERNATIVE':
      parts.push(candidate.product.brandType === 'STORE_BRAND' ? 'Huismerkalternatief toegestaan' : 'Vergelijkbaar alternatief toegestaan');
      break;
    case 'UNCERTAIN':
      parts.push('Onzekere match');
      break;
  }

  if (candidate.offer.promotionLabel) {
    parts.push(cost.conditionMet ? `promotie ${candidate.offer.promotionLabel} toegepast` : `promotie ${candidate.offer.promotionLabel} niet gehaald (${cost.note ?? 'voorwaarde'})`);
  }
  if (candidate.offer.requiresLoyaltyCard) parts.push('klantenkaartprijs');
  if (candidate.offer.channel === 'ONLINE') parts.push('alleen online');
  if (candidate.offer.provenance.isDemo) parts.push('demogegevens');

  return parts.join(' · ');
}

/** Kiest voor één regel het beste aanbod bij één keten. */
export function selectLine(item: OptimizerItem, chain: OptimizerChain, settings: BasketCompareInput): BasketLineResult {
  const base = {
    itemId: item.itemId,
    label: item.label,
    quantity: item.quantity,
    chosenOffer: null,
    chosenProduct: null,
    matchType: null,
    lineTotalCents: null,
    regularTotalCents: null,
    savingsCents: 0,
    requiresLoyaltyCard: false,
  };

  if (item.freeText) {
    return { ...base, status: 'FREE_TEXT', reason: 'Vrije tekstregel, niet meegerekend' };
  }

  const rejections = new Set<string>();
  const scored: ScoredCandidate[] = [];
  let overBudget = 0;

  for (const candidate of item.candidates) {
    if (candidate.offer.storeChain.slug !== chain.ref.slug) continue;

    const allowed = isAllowed(item, candidate, chain, settings);
    if (!allowed.ok) {
      rejections.add(allowed.reason);
      continue;
    }

    if (item.constraints.maxPriceCents != null && candidate.offer.priceCents > item.constraints.maxPriceCents) {
      overBudget++;
      continue;
    }

    scored.push({ candidate, cost: lineCost(candidate.offer, item.quantity) });
  }

  if (scored.length === 0) {
    if (overBudget > 0) {
      return { ...base, status: 'OVER_BUDGET', reason: `Boven je maximumprijs van ${formatEuro(item.constraints.maxPriceCents ?? 0)}` };
    }
    const why = rejections.size > 0 ? `niet beschikbaar (${[...rejections].join(', ')})` : 'niet gevonden bij deze winkel';
    return { ...base, status: 'MISSING', reason: `Product ${why}` };
  }

  scored.sort(
    (a, b) =>
      a.cost.totalCents - b.cost.totalCents ||
      MATCH_RANK[b.candidate.matchType] - MATCH_RANK[a.candidate.matchType] ||
      a.candidate.product.id.localeCompare(b.candidate.product.id),
  );

  const best = scored[0]!;
  return {
    ...base,
    status: best.candidate.matchType === 'ALTERNATIVE' ? 'ALTERNATIVE' : 'FOUND',
    chosenOffer: best.candidate.offer,
    chosenProduct: best.candidate.product,
    matchType: best.candidate.matchType,
    lineTotalCents: best.cost.totalCents,
    regularTotalCents: best.cost.regularTotalCents,
    savingsCents: best.cost.savingsCents,
    requiresLoyaltyCard: best.candidate.offer.requiresLoyaltyCard,
    reason: describeChoice(best.candidate, best.cost),
  };
}

function isCounted(line: BasketLineResult): boolean {
  return line.status === 'FOUND' || line.status === 'ALTERNATIVE';
}

/** Alles bij één winkel. */
export function basketForStore(items: readonly OptimizerItem[], chain: OptimizerChain, settings: BasketCompareInput): StoreBasketResult {
  const lines = items.filter((item) => !item.freeText).map((item) => selectLine(item, chain, settings));

  const counted = lines.filter(isCounted);
  const totalCents = counted.reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0);
  const regularTotalCents = counted.reduce((sum, line) => sum + (line.regularTotalCents ?? 0), 0);

  const conditions = new Set<string>();
  for (const line of counted) {
    const offer = line.chosenOffer;
    if (!offer) continue;
    if (offer.conditions) conditions.add(offer.conditions);
    if (offer.requiresLoyaltyCard) conditions.add(`Klantenkaart ${chain.loyaltyCardName ?? chain.ref.name} nodig voor ${line.label}`);
    if (offer.channel === 'ONLINE') conditions.add(`${line.label}: prijs geldt alleen online`);
    if (offer.minimumQuantity > 1) conditions.add(`${line.label}: promotie geldt vanaf ${offer.minimumQuantity} stuks`);
  }

  const missingCount = lines.filter((line) => line.status === 'MISSING' || line.status === 'OVER_BUDGET').length;

  return {
    storeChain: chain.ref,
    totalCents,
    regularTotalCents,
    savingsCents: Math.max(0, regularTotalCents - totalCents),
    availableCount: lines.filter((line) => line.status === 'FOUND').length,
    alternativeCount: lines.filter((line) => line.status === 'ALTERNATIVE').length,
    missingCount,
    complete: missingCount === 0 && lines.length > 0,
    requiresLoyaltyCard: counted.some((line) => line.requiresLoyaltyCard),
    loyaltyCardName: chain.loyaltyCardName,
    conditions: [...conditions],
    lines,
    hasData: chain.hasData,
    containsDemoData: counted.some((line) => line.chosenOffer?.provenance.isDemo === true),
  };
}

/** Beste één-winkeloptie: zoveel mogelijk producten, dan de laagste prijs. */
function rankStores(a: StoreBasketResult, b: StoreBasketResult): number {
  return a.missingCount - b.missingCount || a.totalCents - b.totalCents || a.storeChain.name.localeCompare(b.storeChain.name);
}

interface SubsetEvaluation {
  readonly slugs: readonly string[];
  readonly totalCents: number;
  readonly missing: BasketLineResult[];
  /** Per regel de gekozen winkel. */
  readonly assignment: Map<string, { slug: string; line: BasketLineResult }>;
}

/** Per regel de goedkoopste winkel binnen een deelverzameling ketens. */
function evaluateSubset(
  perStore: ReadonlyMap<string, StoreBasketResult>,
  slugs: readonly string[],
  items: readonly OptimizerItem[],
): SubsetEvaluation {
  const assignment = new Map<string, { slug: string; line: BasketLineResult }>();
  const missing: BasketLineResult[] = [];
  let totalCents = 0;

  for (const item of items) {
    if (item.freeText) continue;

    let best: { slug: string; line: BasketLineResult } | null = null;
    for (const slug of slugs) {
      const line = perStore.get(slug)?.lines.find((candidate) => candidate.itemId === item.itemId);
      if (!line || !isCounted(line)) continue;
      if (
        !best ||
        (line.lineTotalCents ?? 0) < (best.line.lineTotalCents ?? 0) ||
        ((line.lineTotalCents ?? 0) === (best.line.lineTotalCents ?? 0) && MATCH_RANK[line.matchType ?? 'UNCERTAIN'] > MATCH_RANK[best.line.matchType ?? 'UNCERTAIN'])
      ) {
        best = { slug, line };
      }
    }

    if (best) {
      assignment.set(item.itemId, best);
      totalCents += best.line.lineTotalCents ?? 0;
    } else {
      // Bewaar de regel van de eerste winkel als "ontbrekend" zodat de reden zichtbaar blijft.
      const firstSlug = slugs[0];
      const existing = firstSlug ? perStore.get(firstSlug)?.lines.find((candidate) => candidate.itemId === item.itemId) : undefined;
      const line: BasketLineResult = existing ?? {
        itemId: item.itemId,
        label: item.label,
        quantity: item.quantity,
        status: 'MISSING' as const,
        chosenOffer: null,
        chosenProduct: null,
        matchType: null,
        lineTotalCents: null,
        regularTotalCents: null,
        savingsCents: 0,
        requiresLoyaltyCard: false,
        reason: 'Bij geen van de geselecteerde winkels gevonden',
      };
      missing.push({ ...line, status: 'MISSING', reason: 'Bij geen van de geselecteerde winkels gevonden' });
    }
  }

  return { slugs, totalCents, missing, assignment };
}

function compareSubsets(a: SubsetEvaluation, b: SubsetEvaluation): number {
  return a.missing.length - b.missing.length || a.totalCents - b.totalCents || a.slugs.length - b.slugs.length;
}

function* subsetsOfSize<T>(pool: readonly T[], size: number, start = 0): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= pool.length - size; i++) {
    for (const rest of subsetsOfSize(pool, size - 1, i + 1)) {
      yield [pool[i]!, ...rest];
    }
  }
}

function toCombination(
  evaluation: SubsetEvaluation,
  chains: ReadonlyMap<string, OptimizerChain>,
  bestSingle: StoreBasketResult | null,
  explanation: string[],
): CombinationResult {
  const byStore = new Map<string, BasketLineResult[]>();
  for (const { slug, line } of evaluation.assignment.values()) {
    const list = byStore.get(slug) ?? [];
    list.push(line);
    byStore.set(slug, list);
  }

  const stores = [...byStore.entries()]
    .map(([slug, lines]) => ({
      storeChain: chains.get(slug)!.ref,
      subtotalCents: lines.reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0),
      lines,
    }))
    .sort((a, b) => b.subtotalCents - a.subtotalCents);

  // Alleen vergelijkbaar op regels die de beste enkele winkel óók heeft.
  let savingsVsBestSingleStoreCents = 0;
  if (bestSingle) {
    const singleIds = new Set(bestSingle.lines.filter(isCounted).map((line) => line.itemId));
    const singleTotal = bestSingle.lines.filter(isCounted).reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0);
    const comboOnSameItems = [...evaluation.assignment.entries()]
      .filter(([itemId]) => singleIds.has(itemId))
      .reduce((sum, [, { line }]) => sum + (line.lineTotalCents ?? 0), 0);
    savingsVsBestSingleStoreCents = singleTotal - comboOnSameItems;
  }

  return {
    stores,
    totalCents: evaluation.totalCents,
    storeVisits: stores.length,
    missing: evaluation.missing,
    savingsVsBestSingleStoreCents,
    explanation,
  };
}

/**
 * Rekent een boodschappenlijst door voor alle ketens en bepaalt de drie
 * resultaten: beste enkele winkel, goedkoopste combinatie, gebalanceerde keuze.
 */
export function compareBaskets(
  items: readonly OptimizerItem[],
  chains: readonly OptimizerChain[],
  settings: BasketCompareInput,
): OptimizerResult {
  const freeTextLines = items.filter((item) => item.freeText).map((item) => item.label);
  const countable = items.filter((item) => !item.freeText);

  const perStore = chains.map((chain) => basketForStore(items, chain, settings));
  const withData = perStore.filter((store) => store.hasData);
  const chainBySlug = new Map(chains.map((chain) => [chain.ref.slug, chain]));
  const storeBySlug = new Map(withData.map((store) => [store.storeChain.slug, store]));

  if (countable.length === 0 || withData.length === 0) {
    return {
      perStore,
      bestSingleStore: null,
      cheapestCombination: null,
      balanced: null,
      summary: countable.length === 0 ? 'Je lijst bevat nog geen producten om te vergelijken.' : 'Geen prijsgegevens beschikbaar voor de geselecteerde winkels.',
      freeTextLines,
    };
  }

  const bestSingleStore = [...withData].sort(rankStores)[0] ?? null;

  // Ketens die binnen de maximale afstand liggen (onbekende afstand = toegestaan).
  const reachable = withData
    .map((store) => store.storeChain.slug)
    .filter((slug) => {
      const distance = chainBySlug.get(slug)?.distanceKm ?? null;
      return settings.maxDistanceKm == null || distance == null || distance <= settings.maxDistanceKm;
    });

  // Goedkoopste combinatie: elke regel bij de goedkoopste bereikbare winkel.
  const cheapest = evaluateSubset(storeBySlug, reachable, countable);
  const cheapestCombination = toCombination(cheapest, chainBySlug, bestSingleStore, [
    `Elke regel bij de goedkoopste van ${reachable.length} winkels; ${cheapest.assignment.size} regels verdeeld over ${new Set([...cheapest.assignment.values()].map((v) => v.slug)).size} winkelbezoek(en).`,
  ]);

  // Gebalanceerd: beste deelverzameling van hoogstens `maxStores` winkels, met
  // een minimale besparing per extra winkelbezoek.
  const maxStores = Math.min(settings.maxStores, reachable.length);
  const bestBySize: SubsetEvaluation[] = [];
  for (let size = 1; size <= maxStores; size++) {
    let best: SubsetEvaluation | null = null;
    for (const subset of subsetsOfSize(reachable, size)) {
      const evaluation = evaluateSubset(storeBySlug, subset, countable);
      if (!best || compareSubsets(evaluation, best) < 0) best = evaluation;
    }
    if (best) bestBySize.push(best);
  }

  const explanation: string[] = [];
  let chosen = bestBySize[0] ?? null;
  if (chosen) {
    explanation.push(`Startpunt: alles bij ${chainBySlug.get(chosen.slugs[0]!)?.ref.name} voor ${formatEuro(chosen.totalCents)}.`);
  }
  for (const candidate of bestBySize.slice(1)) {
    if (!chosen) break;
    const extraStores = candidate.slugs.length - chosen.slugs.length;
    const saving = chosen.totalCents - candidate.totalCents;
    const required = settings.minimumSavingCents * extraStores;
    const names = candidate.slugs.map((slug) => chainBySlug.get(slug)?.ref.name ?? slug).join(' + ');

    if (candidate.missing.length < chosen.missing.length) {
      explanation.push(`${names}: ${chosen.missing.length - candidate.missing.length} product(en) extra beschikbaar, dus toegevoegd.`);
      chosen = candidate;
    } else if (candidate.missing.length === chosen.missing.length && saving >= required) {
      explanation.push(`${names}: bespaart ${formatEuro(saving)} (minstens ${formatEuro(required)} nodig voor ${extraStores} extra bezoek), dus toegevoegd.`);
      chosen = candidate;
    } else {
      explanation.push(`${names}: zou ${formatEuro(Math.max(0, saving))} besparen, minder dan ${formatEuro(required)} voor ${extraStores} extra winkel — niet de moeite.`);
    }
  }

  const balanced = chosen ? toCombination(chosen, chainBySlug, bestSingleStore, explanation) : null;

  const summary = buildSummary(settings, bestSingleStore, cheapestCombination, balanced);

  return { perStore, bestSingleStore, cheapestCombination, balanced, summary, freeTextLines };
}

function buildSummary(
  settings: BasketCompareInput,
  bestSingle: StoreBasketResult | null,
  cheapest: CombinationResult | null,
  balanced: CombinationResult | null,
): string {
  switch (settings.mode) {
    case 'SINGLE_STORE':
      if (!bestSingle) return 'Geen winkel gevonden.';
      return `Alles bij ${bestSingle.storeChain.name}: ${formatEuro(bestSingle.totalCents)}${bestSingle.missingCount > 0 ? `, ${bestSingle.missingCount} product(en) niet beschikbaar` : ''}.`;
    case 'CHEAPEST_COMBINATION':
      if (!cheapest) return 'Geen combinatie gevonden.';
      return `Goedkoopste combinatie: ${formatEuro(cheapest.totalCents)} over ${cheapest.storeVisits} winkel(s)${cheapest.savingsVsBestSingleStoreCents > 0 ? `, ${formatEuro(cheapest.savingsVsBestSingleStoreCents)} goedkoper dan de beste enkele winkel` : ''}.`;
    case 'BALANCED':
      if (!balanced) return 'Geen keuze gevonden.';
      return `Gebalanceerd: ${formatEuro(balanced.totalCents)} over ${balanced.storeVisits} winkel(s)${balanced.savingsVsBestSingleStoreCents > 0 ? `, ${formatEuro(balanced.savingsVsBestSingleStoreCents)} goedkoper dan de beste enkele winkel` : ''}.`;
  }
}
