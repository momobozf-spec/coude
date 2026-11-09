/**
 * CSV-import: één rij per aanbieding, productvelden herhaald.
 *
 * Kolommen (kopregel verplicht, volgorde vrij, extra kolommen worden genegeerd):
 *
 *   productExternalId, name, brand, barcode, packageQuantity, packageUnit,
 *   packCount, categorySlug, imageUrl, productUrl, locationExternalId,
 *   sourceReference, priceCents, originalPriceCents, promotionType,
 *   promotionText, promotionRule (JSON), conditions, requiresLoyaltyCard,
 *   isPersonalized, channel, minimumQuantity, depositCents, availability,
 *   startsAt, endsAt, observedAt
 *
 * Bedragen in centen. Datums ISO-8601. Booleans `true`/`false`/`1`/`0`.
 * Het resultaat gaat door dezelfde Zod-validatie als een JSON-feed.
 */
import { feedFileSchema, type FeedFile, type FeedOffer, type FeedProduct } from './feed-schema';
import type { AdapterChainInfo } from './supermarket-adapter';

/** Eenvoudige RFC 4180-parser: aanhalingstekens, dubbele aanhalingstekens, komma's in velden. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const content = text.replace(/^﻿/, '');

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',' || char === ';') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);

  return rows;
}

function cell(record: Record<string, string>, key: string): string | undefined {
  const value = record[key]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function numberCell(record: Record<string, string>, key: string): number | undefined {
  const raw = cell(record, key);
  if (raw === undefined) return undefined;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : Number.NaN;
}

function booleanCell(record: Record<string, string>, key: string): boolean | undefined {
  const raw = cell(record, key)?.toLowerCase();
  if (raw === undefined) return undefined;
  return raw === 'true' || raw === '1' || raw === 'ja' || raw === 'yes';
}

export interface CsvFeedOptions {
  readonly chain: AdapterChainInfo;
  readonly label: string;
  readonly observedAt: Date;
  /** Wie een CSV plaatst, verklaart daarmee de voorwaarden van de bron te hebben nagekeken. */
  readonly termsReviewed: boolean;
}

/**
 * Zet CSV-tekst om naar een gevalideerde `FeedFile`.
 *
 * @throws {Error} met een leesbare boodschap bij een ontbrekende kopregel of validatiefouten.
 */
export function csvToFeed(text: string, options: CsvFeedOptions): FeedFile {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) throw new Error('CSV is leeg of mist een kopregel');

  const keys = header.map((h) => h.trim());
  const records = rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    keys.forEach((key, index) => {
      record[key] = values[index] ?? '';
    });
    return record;
  });

  const products = new Map<string, FeedProduct>();
  const offers: FeedOffer[] = [];

  for (const [index, record] of records.entries()) {
    const line = index + 2;
    const productExternalId = cell(record, 'productExternalId');
    const name = cell(record, 'name');
    if (!productExternalId || !name) {
      throw new Error(`CSV regel ${line}: productExternalId en name zijn verplicht`);
    }

    if (!products.has(productExternalId)) {
      const packageQuantity = numberCell(record, 'packageQuantity');
      const packCount = numberCell(record, 'packCount');
      products.set(productExternalId, {
        externalId: productExternalId,
        name,
        brand: cell(record, 'brand') ?? null,
        barcode: cell(record, 'barcode') ?? null,
        imageUrl: cell(record, 'imageUrl') ?? null,
        productUrl: cell(record, 'productUrl') ?? null,
        categorySlug: cell(record, 'categorySlug') ?? null,
        packageQuantity: packageQuantity ?? null,
        packageUnit: (cell(record, 'packageUnit')?.toUpperCase() as FeedProduct['packageUnit']) ?? null,
        ...(packCount !== undefined ? { packCount } : {}),
      });
    }

    const priceCents = numberCell(record, 'priceCents');
    if (priceCents === undefined) throw new Error(`CSV regel ${line}: priceCents ontbreekt`);

    const promotionRuleRaw = cell(record, 'promotionRule');
    let promotionRule: unknown = null;
    if (promotionRuleRaw) {
      try {
        promotionRule = JSON.parse(promotionRuleRaw);
      } catch {
        throw new Error(`CSV regel ${line}: promotionRule is geen geldige JSON`);
      }
    }

    const originalPriceCents = numberCell(record, 'originalPriceCents');
    const minimumQuantity = numberCell(record, 'minimumQuantity');
    const depositCents = numberCell(record, 'depositCents');

    offers.push({
      productExternalId,
      locationExternalId: cell(record, 'locationExternalId') ?? null,
      sourceReference: cell(record, 'sourceReference') ?? `${productExternalId}:csv:${line}`,
      priceCents,
      originalPriceCents: originalPriceCents ?? null,
      promotionType: (cell(record, 'promotionType')?.toUpperCase() as FeedOffer['promotionType']) ?? 'NONE',
      promotionText: cell(record, 'promotionText') ?? null,
      promotionRule: promotionRule as FeedOffer['promotionRule'],
      conditions: cell(record, 'conditions') ?? null,
      ...(booleanCell(record, 'requiresLoyaltyCard') !== undefined ? { requiresLoyaltyCard: booleanCell(record, 'requiresLoyaltyCard') } : {}),
      ...(booleanCell(record, 'isPersonalized') !== undefined ? { isPersonalized: booleanCell(record, 'isPersonalized') } : {}),
      ...(cell(record, 'channel') ? { channel: cell(record, 'channel')!.toUpperCase() as FeedOffer['channel'] } : {}),
      ...(minimumQuantity !== undefined ? { minimumQuantity } : {}),
      depositCents: depositCents ?? null,
      ...(cell(record, 'availability') ? { availability: cell(record, 'availability')!.toUpperCase() as FeedOffer['availability'] } : {}),
      startsAt: cell(record, 'startsAt') ?? null,
      endsAt: cell(record, 'endsAt') ?? null,
      ...(cell(record, 'observedAt') ? { observedAt: cell(record, 'observedAt') } : {}),
    });
  }

  const candidate = {
    version: 1 as const,
    chain: {
      slug: options.chain.slug,
      name: options.chain.name,
      logoUrl: options.chain.logoUrl ?? null,
      websiteUrl: options.chain.websiteUrl ?? null,
      loyaltyCardName: options.chain.loyaltyCardName ?? null,
    },
    source: { kind: 'IMPORT_FILE' as const, label: options.label, termsReviewed: options.termsReviewed },
    observedAt: options.observedAt.toISOString(),
    locations: [],
    products: [...products.values()],
    offers,
  };

  const parsed = feedFileSchema.safeParse(candidate);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`CSV-feed ongeldig: ${details}`);
  }

  return parsed.data;
}
