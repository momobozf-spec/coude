/**
 * Feeds aanleveren aan een server zonder blijvende schijf.
 *
 * De scrapers en importers draaien op de laptop van de uitbater
 * (Playwright/Scrapling) en schrijven `data/feeds/<keten>.json`. In productie
 * is er geen gedeelde map: `npm run feeds:push` stuurt die bestanden naar
 * `POST /api/v1/compare/internal/feeds/:chain`. Deze service bewaart de
 * gevalideerde feed in `CompareFeed` en start een synchronisatie voor die
 * keten. De import zelf is de bestaande: de adapter leest de opgeslagen feed
 * via `AdapterContext.loadStoredFeed` net zoals een importbestand
 * (`chain-adapter.ts`), met dezelfde validatie, normalisatie, matching,
 * deactivatiegrens en alerts.
 *
 * Wat deze service bewust níét doet: `termsReviewed` aanpassen. Wat de feed
 * verklaart, wordt bewaard; een keten wordt pas LIVE na een menselijke
 * beoordeling van de voorwaarden (zie docs/COMPARE.md, "Live-criteria").
 */
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, type OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SUPERMARKET_ADAPTERS } from '../adapters/adapter-registry';
import type { FeedFile } from '../adapters/feed-schema';
import type { SupermarketAdapter } from '../adapters/supermarket-adapter';
import { CompareConfig } from '../compare-config';
import { SyncService } from '../jobs/sync.service';

export interface FeedPushResult {
  readonly adapterKey: string;
  readonly stored: true;
  /** `false` als exact dezelfde feed al was opgeslagen; er wordt dan niet opnieuw gesynchroniseerd. */
  readonly changed: boolean;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly observedAt: string;
  readonly products: number;
  readonly offers: number;
  readonly termsReviewed: boolean;
  /**
   * `STARTED`: synchronisatie voor deze keten gestart (resultaat via
   * `GET /compare/internal/status`). `UNCHANGED`: niets te doen. De dagelijkse
   * `compare:sync` neemt de opgeslagen feed hoe dan ook mee.
   */
  readonly sync: 'STARTED' | 'UNCHANGED';
}

export interface StoredFeedInfo {
  readonly adapterKey: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly observedAt: string;
  readonly products: number;
  readonly offers: number;
  readonly termsReviewed: boolean;
  readonly receivedAt: string;
}

/** Stabiele hash van de gevalideerde inhoud (zelfde feed = zelfde hash, los van witruimte). */
export function feedDigest(feed: FeedFile): { sha256: string; sizeBytes: number } {
  const json = JSON.stringify(feed);
  return { sha256: createHash('sha256').update(json, 'utf8').digest('hex'), sizeBytes: Buffer.byteLength(json, 'utf8') };
}

@Injectable()
export class FeedPushService implements OnModuleDestroy {
  private readonly logger = new Logger('FeedPush');

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompareConfig) private readonly config: CompareConfig,
    @Inject(SyncService) private readonly sync: SyncService,
    @Inject(SUPERMARKET_ADAPTERS) private readonly adapters: readonly SupermarketAdapter[],
  ) {}

  /** Bewaart een (al tegen `feedFileSchema` gevalideerde) feed en start de synchronisatie van die keten. */
  async receive(adapterKey: string, feed: FeedFile, requestId: string): Promise<FeedPushResult> {
    const adapter = this.adapters.find((candidate) => candidate.key === adapterKey);
    if (!adapter) {
      throw new NotFoundException({ message: `Onbekende keten "${adapterKey}"`, code: 'UNKNOWN_CHAIN' });
    }
    if (feed.chain.slug !== adapter.chain.slug) {
      throw new BadRequestException({
        message: `Feed hoort bij keten "${feed.chain.slug}", niet bij "${adapter.chain.slug}"`,
        code: 'CHAIN_MISMATCH',
      });
    }
    if (feed.source.kind === 'DEMO' && !this.config.allowDemo) {
      throw new BadRequestException({ message: 'Demogegevens zijn hier niet toegestaan', code: 'DEMO_NOT_ALLOWED' });
    }

    const { sha256, sizeBytes } = feedDigest(feed);
    const previous = await this.prisma.compareFeed.findUnique({ where: { adapterKey }, select: { sha256: true } });
    const changed = previous?.sha256 !== sha256;

    const meta = {
      sha256,
      sizeBytes,
      observedAt: new Date(feed.observedAt),
      productCount: feed.products.length,
      offerCount: feed.offers.length,
      termsReviewed: feed.source.termsReviewed,
    };
    if (changed) {
      await this.prisma.compareFeed.upsert({
        where: { adapterKey },
        create: { adapterKey, payload: feed as object, ...meta },
        update: { payload: feed as object, ...meta, receivedAt: new Date() },
      });
    }

    this.logger.log(
      `feed ontvangen requestId=${requestId} adapter=${adapterKey} changed=${changed} bytes=${sizeBytes} products=${meta.productCount} offers=${meta.offerCount} termsReviewed=${meta.termsReviewed}`,
    );

    if (changed) this.startSync(adapterKey, requestId);

    return {
      adapterKey,
      stored: true,
      changed,
      sha256,
      sizeBytes,
      observedAt: meta.observedAt.toISOString(),
      products: meta.productCount,
      offers: meta.offerCount,
      termsReviewed: meta.termsReviewed,
      sync: changed ? 'STARTED' : 'UNCHANGED',
    };
  }

  /** Metadata van alle opgeslagen feeds, zonder inhoud. */
  async list(): Promise<StoredFeedInfo[]> {
    const rows = await this.prisma.compareFeed.findMany({
      orderBy: { adapterKey: 'asc' },
      select: { adapterKey: true, sha256: true, sizeBytes: true, observedAt: true, productCount: true, offerCount: true, termsReviewed: true, receivedAt: true },
    });
    return rows.map((row) => ({
      adapterKey: row.adapterKey,
      sha256: row.sha256,
      sizeBytes: row.sizeBytes,
      observedAt: row.observedAt.toISOString(),
      products: row.productCount,
      offers: row.offerCount,
      termsReviewed: row.termsReviewed,
      receivedAt: row.receivedAt.toISOString(),
    }));
  }

  /** Ketens waarvan een push binnenkwam terwijl er al een synchronisatie liep. */
  private readonly pending = new Set<string>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempts = 0;
  /** Loopt er vanuit deze server al een sync na een push? Dan alleen in de wachtrij zetten. */
  private inFlight = false;
  /** Wachttijd tussen pogingen en maximum aantal pogingen (samen ±15 minuten). */
  static readonly RETRY_DELAY_MS = 30_000;
  static readonly MAX_RETRY_ATTEMPTS = 30;

  /**
   * Op de achtergrond: een import van honderden producten duurt langer dan een
   * redelijke HTTP-timeout. Loopt er al een synchronisatie (lease), dan gaat de
   * keten in een wachtrij: pushes die kort na elkaar binnenkomen (bv. `feeds:push`
   * met 7 ketens) worden gebundeld en in één run gesynchroniseerd zodra de lease vrij is.
   * Na het maximum aantal pogingen neemt de dagelijkse `compare:sync` de opgeslagen feed mee.
   */
  private startSync(adapterKey: string, requestId: string): void {
    this.pending.add(adapterKey);
    if (!this.inFlight && this.retryTimer === null) this.runPending(requestId);
  }

  private runPending(requestId: string): void {
    this.retryTimer = null;
    const keys = [...this.pending];
    if (keys.length === 0) return;
    this.pending.clear();
    this.inFlight = true;
    void this.sync.runSync({ keys, trigger: 'feed-push', requestId }).then(
      (summary) => {
        this.inFlight = false;
        this.retryAttempts = 0;
        this.logger.log(`sync na feed-push klaar requestId=${requestId} adapters=${keys.join(',')} failed=${summary.failedAdapters.join(',') || '-'}`);
        // Wat tijdens deze run binnenkwam, meteen erachteraan.
        if (this.pending.size > 0) this.schedule(requestId, 0);
      },
      (error: unknown) => {
        this.inFlight = false;
        for (const key of keys) this.pending.add(key);
        if (error instanceof ConflictException) {
          this.retryAttempts += 1;
          if (this.retryAttempts > FeedPushService.MAX_RETRY_ATTEMPTS) {
            this.logger.warn(`sync na feed-push opgegeven na ${FeedPushService.MAX_RETRY_ATTEMPTS} pogingen adapters=${[...this.pending].join(',')}; de volgende compare:sync neemt de opgeslagen feeds mee`);
            this.pending.clear();
            this.retryAttempts = 0;
            return;
          }
          this.logger.log(`sync na feed-push uitgesteld requestId=${requestId} adapters=${[...this.pending].join(',')}: er loopt al een synchronisatie; nieuwe poging over ${FeedPushService.RETRY_DELAY_MS / 1000}s`);
          this.schedule(requestId, FeedPushService.RETRY_DELAY_MS);
          return;
        }
        this.pending.clear();
        this.retryAttempts = 0;
        this.logger.error(`sync na feed-push mislukt requestId=${requestId} adapters=${keys.join(',')}: ${error instanceof Error ? error.message : String(error)}`);
      },
    );
  }

  private schedule(requestId: string, delayMs: number): void {
    if (this.retryTimer !== null) return;
    this.retryTimer = setTimeout(() => this.runPending(requestId), delayMs);
    this.retryTimer.unref?.();
  }

  /** Bij afsluiten geen hangende timer achterlaten. */
  onModuleDestroy(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}
