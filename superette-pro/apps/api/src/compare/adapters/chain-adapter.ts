/**
 * Fabriek voor ketenadapters.
 *
 * Elke keten doorloopt dezelfde drie bronnen, in deze volgorde:
 *
 *  1. `COMPARE_FEED_DIR/<key>.json` — gevalideerd importbestand
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

      const jsonPath = join(context.feedDir, `${config.key}.json`);
      if (await exists(jsonPath)) {
        const raw = await readFile(jsonPath, 'utf8');
        const parsed = feedFileSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          const details = parsed.error.issues
            .slice(0, 5)
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          throw new Error(`[${config.key}] ${jsonPath} is ongeldig: ${details}`);
        }
        context.logger.log(`[${config.key}] importbestand ${jsonPath} gelezen (${parsed.data.offers.length} aanbiedingen)`);
        return feedToSnapshot(parsed.data, config.chain);
      }

      const csvPath = join(context.feedDir, `${config.key}.csv`);
      if (await exists(csvPath)) {
        const raw = await readFile(csvPath, 'utf8');
        const feed = csvToFeed(raw, {
          chain: config.chain,
          label: `Importbestand ${config.key}.csv`,
          observedAt: context.now,
          termsReviewed: true,
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
