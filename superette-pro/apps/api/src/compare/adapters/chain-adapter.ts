/**
 * Fabriek voor ketenadapters.
 *
 * Elke keten doorloopt dezelfde bronnen, in deze volgorde:
 *
 *  1. aangeleverde feed in de database (`npm run feeds:push`) of
 *     `COMPARE_FEED_DIR/<key>.json` — gevalideerd; zijn beide er, dan wint
 *     de feed met de jongste `observedAt`
 *  2. `COMPARE_FEED_DIR/<key>.csv`  — idem, platte vorm
 *  3. demogegevens                   — alleen als `allowDemo` aanstaat
 *
 * Een live bron (officiële API, gelicentieerde feed) komt later als een
 * extra stap vóór de importbestanden, in de adapter van die keten zelf.
 * Zie `delhaize.adapter.ts` voor wat daarvoor nodig is.
 */
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { csvToFeed } from './csv-feed';
import { feedFileSchema, type FeedFile } from './feed-schema';
import type { AdapterChainInfo, AdapterContext, AdapterSnapshot, AdapterSourceInfo, SupermarketAdapter } from './supermarket-adapter';

export interface ChainAdapterConfig {
  readonly key: string;
  readonly chain: AdapterChainInfo;
  /** Wat de adapter als bron declareert zolang er geen live koppeling is. */
  readonly source?: Partial<AdapterSourceInfo>;
  /** Demogenerator. Wordt alleen aangeroepen als de context dat toestaat. */
  readonly demo?: (context: AdapterContext) => AdapterSnapshot;
  /**
   * Live bron, als die er is. Krijgt voorrang op importbestanden. Geeft `null`
   * als de bron (tijdelijk) niets levert; dan vallen we terug op de bestanden.
   */
  readonly live?: (context: AdapterContext) => Promise<AdapterSnapshot | null>;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Zet een gevalideerde feed om naar een snapshot (tekstdatums → `Date`). */
export function feedToSnapshot(feed: FeedFile, fallbackChain: AdapterChainInfo): AdapterSnapshot {
  const observedAt = new Date(feed.observedAt);

  return {
    chain: {
      slug: feed.chain.slug,
      name: feed.chain.name,
      logoUrl: feed.chain.logoUrl ?? fallbackChain.logoUrl ?? null,
      websiteUrl: feed.chain.websiteUrl ?? fallbackChain.websiteUrl ?? null,
      loyaltyCardName: feed.chain.loyaltyCardName ?? fallbackChain.loyaltyCardName ?? null,
      sortOrder: fallbackChain.sortOrder ?? 0,
    },
    source: {
      kind: feed.source.kind,
      label: feed.source.label,
      termsReviewed: feed.source.termsReviewed,
      ...(feed.source.notes ? { notes: feed.source.notes } : {}),
    },
    observedAt,
    locations: feed.locations,
    products: feed.products,
    offers: feed.offers.map((offer) => ({
      ...offer,
      startsAt: offer.startsAt ? new Date(offer.startsAt) : null,
      endsAt: offer.endsAt ? new Date(offer.endsAt) : null,
      observedAt: offer.observedAt ? new Date(offer.observedAt) : observedAt,
    })),
  };
}

/** Valideert ruwe feed-JSON; een ongeldige feed is een fout, nooit een stille terugval. */
export function parseFeed(raw: unknown, label: string): FeedFile {
  const parsed = feedFileSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`${label} is ongeldig: ${details}`);
  }
  return parsed.data;
}

export function createChainAdapter(config: ChainAdapterConfig): SupermarketAdapter {
  const source: AdapterSourceInfo = {
    kind: config.source?.kind ?? 'IMPORT_FILE',
    label: config.source?.label ?? `Importbestand ${config.key}.json / ${config.key}.csv`,
    termsReviewed: config.source?.termsReviewed ?? false,
    ...(config.source?.notes ? { notes: config.source.notes } : {}),
  };

  return {
    key: config.key,
    chain: config.chain,
    source,

    async fetchSnapshot(context: AdapterContext): Promise<AdapterSnapshot | null> {
      if (config.live) {
        const live = await config.live(context);
        if (live) return live;
        context.logger.warn(`[${config.key}] live bron leverde niets; terugvallen op importbestanden`);
      }

      const candidates: Array<{ feed: FeedFile; origin: string }> = [];

      const stored = context.loadStoredFeed ? await context.loadStoredFeed(config.key) : null;
      if (stored !== null && stored !== undefined) {
        candidates.push({ feed: parseFeed(stored, `[${config.key}] aangeleverde feed`), origin: 'aangeleverde feed (database)' });
      }

      const jsonPath = join(context.feedDir, `${config.key}.json`);
      if (await exists(jsonPath)) {
        const raw = await readFile(jsonPath, 'utf8');
        candidates.push({ feed: parseFeed(JSON.parse(raw), `[${config.key}] ${jsonPath}`), origin: `importbestand ${jsonPath}` });
      }

      if (candidates.length > 0) {
        // Jongste meting wint; bij gelijke stand de aangeleverde feed (eerst in de lijst).
        const chosen = candidates.reduce((best, next) => (Date.parse(next.feed.observedAt) > Date.parse(best.feed.observedAt) ? next : best));
        context.logger.log(`[${config.key}] ${chosen.origin} gelezen (${chosen.feed.offers.length} aanbiedingen, gemeten ${chosen.feed.observedAt})`);
        return feedToSnapshot(chosen.feed, config.chain);
      }

      const csvPath = join(context.feedDir, `${config.key}.csv`);
      if (await exists(csvPath)) {
        const raw = await readFile(csvPath, 'utf8');
        const feed = csvToFeed(raw, {
          chain: config.chain,
          label: `Importbestand ${config.key}.csv`,
          observedAt: context.now,
          // Een CSV-bestand kan zelf niets verklaren: het erft wat de adapter
          // declareert (standaard `false` → UNVERIFIED). Nagekeken voorwaarden
          // zijn een menselijke beslissing in de adapter, nooit een bijwerking
          // van het bestandsformaat.
          termsReviewed: source.termsReviewed,
        });
        context.logger.log(`[${config.key}] importbestand ${csvPath} gelezen (${feed.offers.length} aanbiedingen)`);
        return feedToSnapshot(feed, config.chain);
      }

      if (context.allowDemo && config.demo) {
        context.logger.warn(`[${config.key}] geen importbestand gevonden — DEMOGEGEVENS worden gebruikt`);
        return config.demo(context);
      }

      context.logger.warn(`[${config.key}] geen bron beschikbaar (geen ${config.key}.json/.csv in ${context.feedDir}, demo uit)`);
      return null;
    },
  };
}
