import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseQuantityLabel } from '@superette/pricing';
import { feedFileSchema, feedLocationSchema, type FeedFile } from '../../adapters/feed-schema';

const text = z.string().max(2000).default('');
export const snapshotSchema = z.object({
  version: z.literal(1), sourceUrl: z.string().url(), observedAt: z.string().datetime(),
  storeConfirmed: z.literal(true), store: feedLocationSchema,
  tiles: z.array(z.object({ title: text, description: text, unit: text, promo: text, date: text,
    oldWhole: text, oldFraction: text, whole: text, fraction: text, prefix: text, unitPrice: text,
    example: text, examplePrice: text, priceVisible: z.boolean(), exampleVisible: z.boolean().default(false),
  })).min(1).max(10000),
});
type Tile = z.infer<typeof snapshotSchema>['tiles'][number];
const money = (value: string): number => {
  if (!/^\d+[,.]\d{2}$/.test(value)) throw new Error('Ongeldige prijs');
  return Number(value.replace(/[,.]/, ''));
};
const splitMoney = (whole: string, fraction: string): number => money(`${whole},${fraction}`);

// Convert a Belgian midnight to UTC using the actual Europe/Brussels offset.
function belgianDate(day: number, month: number, year: number): Date {
  const candidate = Date.UTC(year, month - 1, day);
  const date = new Date(candidate);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Ongeldige datum');
  const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Brussels', timeZoneName: 'shortOffset' }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value;
  const match = zone?.match(/^GMT\+(\d{1,2})$/);
  if (!match) throw new Error('Belgische tijdzone niet beschikbaar');
  return new Date(candidate - Number(match[1]) * 3600000);
}

export function parseSparTile(tile: Tile) {
  if (!tile.priceVisible) throw new Error('Prijs verborgen; winkel niet bevestigd');
  const promotion = tile.promo.match(/^(1|2)\+\1 GRATIS$/i);
  if (!promotion) throw new Error('Promotie niet ondersteund of prijs ontbreekt');
  const quantity = Number(promotion[1]) * 2;
  let oldTotal: number, total: number, size: string, name: string, unitPrice: string;
  if (tile.example) {
    if (!tile.exampleVisible) throw new Error('Prijsvoorbeeld verborgen');
    const example = tile.example.match(/^(\d+) x (.+)$/);
    const price = tile.examplePrice.match(/^€\s*(\d+[,.]\d{2})\s*-\s*€\s*(\d+[,.]\d{2}) voor (\d+) \((€\s*\d+[,.]\d{2}\/(?:kg|L))\)$/);
    if (!example || !price || Number(example[1]) !== quantity || Number(price[3]) !== quantity) throw new Error('Prijsvoorbeeld of aantal niet ondersteund');
    size = example[2]!;
    name = /,|\sof\s/.test(tile.title) ? size : `${tile.title} ${size}`;
    oldTotal = money(price[1]!); total = money(price[2]!); unitPrice = price[4]!;
  } else {
    if (tile.prefix !== `${quantity} voor`) throw new Error('Aantal ontbreekt of wijkt af');
    oldTotal = splitMoney(tile.oldWhole, tile.oldFraction); total = splitMoney(tile.whole, tile.fraction);
    size = tile.unit; name = `${tile.title} ${tile.description}`.trim(); unitPrice = tile.unitPrice;
  }
  if (/(?:\bca\.?\s*\d|circa|\+\s*\/\s*-|±|\bKGM\b|\bLTR\b|\+\s*lg)/i.test(size + ' ' + name)) throw new Error('Wisselend gewicht of onbekend statiegeld');
  if (!/(?:\d(?:[,.]\d+)?\s*(?:g|kg|ml|cl|l))$/i.test(size)) throw new Error('Geen vaste massa of inhoud');
  const explicitSize = size.match(/((?:\d+\s*x\s*)*\d+(?:[,.]\d+)?\s*(?:g|kg|ml|cl|l))$/i)?.[1];
  const pack = explicitSize ? parseQuantityLabel(explicitSize) : null;
  if (!pack) throw new Error('Verpakking niet ondersteund');
  const base = pack.unit === 'G' ? pack.quantity / 1000 : pack.unit === 'KG' ? pack.quantity
    : pack.unit === 'ML' ? pack.quantity / 1000 : pack.unit === 'CL' ? pack.quantity / 100 : pack.unit === 'L' ? pack.quantity : null;
  const denominator = pack.unit === 'G' || pack.unit === 'KG' ? 'kg' : 'L';
  const unitMatch = unitPrice.match(/^€\s*(\d+[,.]\d{2})\/(kg|L)$/);
  if (!base || !unitMatch || unitMatch[2] !== denominator) throw new Error('Eenheidsprijs ontbreekt of verkeerde eenheid');
  if (Math.abs(Math.round(total / (quantity * base * pack.packCount)) - money(unitMatch[1]!)) > 1) throw new Error('Inhoud en eenheidsprijs spreken elkaar tegen');
  if (oldTotal !== total * 2 || oldTotal % quantity !== 0) throw new Error('Promotie en oude totaalprijs spreken elkaar tegen');
  const dates = tile.date.match(/^Geldig van (\d{1,2})\/(\d{1,2}) - (\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dates) throw new Error('Geldigheidsperiode ontbreekt');
  const year = Number(dates[5]);
  const startYear = Number(dates[2]) > Number(dates[4]) ? year - 1 : year;
  const startsAt = belgianDate(Number(dates[1]), Number(dates[2]), startYear);
  const endDay = new Date(Date.UTC(year, Number(dates[4]) - 1, Number(dates[3]) + 1));
  const endsAt = new Date(belgianDate(endDay.getUTCDate(), endDay.getUTCMonth() + 1, endDay.getUTCFullYear()).getTime() - 1);
  if (endsAt < startsAt) throw new Error('Omgekeerde geldigheidsperiode');
  const externalId = `browser-${createHash('sha256').update(JSON.stringify([name, pack])).digest('hex').slice(0, 24)}`;
  return { externalId, name, pack, regularCents: oldTotal / quantity, total, quantity, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), promo: tile.promo };
}

export function buildSparSnapshot(input: unknown, now = new Date()): { feed: FeedFile; skipped: Record<string, number> } {
  const snapshot = snapshotSchema.parse(input);
  if (new URL(snapshot.sourceUrl).origin !== 'https://www.mijnspar.be') throw new Error('Verkeerde bron');
  const observed = Date.parse(snapshot.observedAt);
  if (observed > now.getTime() + 60000 || now.getTime() - observed > 48 * 3600000) throw new Error('Browseropname ouder dan 48 uur of in de toekomst; nieuwe opname nodig');
  const accepted: ReturnType<typeof parseSparTile>[] = [];
  const skipped: Record<string, number> = {};
  for (const tile of snapshot.tiles) {
    try {
      const product = parseSparTile(tile);
      if (Date.parse(product.endsAt) < now.getTime()) throw new Error('Aanbieding verlopen');
      accepted.push(product);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Onbekende fout';
      skipped[reason] = (skipped[reason] ?? 0) + 1;
    }
  }
  if (!accepted.length) throw new Error('Geen betrouwbare prijzen; geen feed schrijven');
  if (new Set(accepted.map(p => p.externalId)).size !== accepted.length) throw new Error('Dubbele producten; geen feed schrijven');
  const feed = feedFileSchema.parse({
    version: 1, chain: { slug: 'spar', name: 'SPAR', websiteUrl: 'https://www.mijnspar.be' },
    source: { kind: 'MANUAL', label: `Browseropname ${snapshot.store.name}`, termsReviewed: false,
      notes: 'Getoonde prijzen na expliciete winkelkeuze. Lokale productidentifiers zijn naam/verpakking-hashes, geen SPAR-productcodes. Geen EAN of productlinks beschikbaar. Alleen gecontroleerde 1+1 en 2+2 acties; vaste inhoud en kloppende prijsvoorbeelden. Geen volledige catalogus. Gewone prijs per verpakking is berekend uit de vermelde oude bundelprijs; korting geldt pas bij het opgegeven aantal.',
    },
    observedAt: snapshot.observedAt, locations: [snapshot.store],
    products: accepted.map(p => ({ externalId: p.externalId, name: p.name, brand: null, barcode: null, productUrl: null, imageUrl: null, categoryPath: null,
      packageQuantity: p.pack.quantity, packageUnit: p.pack.unit, packCount: p.pack.packCount })),
    offers: accepted.map(p => ({ productExternalId: p.externalId, locationExternalId: snapshot.store.externalId,
      sourceReference: `${snapshot.store.externalId}:${p.externalId}:${p.startsAt.slice(0,10)}`,
      priceCents: p.regularCents, originalPriceCents: null, promotionType: 'MULTIBUY', promotionText: p.promo,
      promotionRule: { kind: 'MULTIBUY', quantity: p.quantity, totalCents: p.total },
      channel: 'IN_STORE', availability: 'UNKNOWN', observedAt: snapshot.observedAt,
      startsAt: p.startsAt, endsAt: p.endsAt, confidence: 0.5,
      conditions: `${snapshot.store.name}, ${snapshot.store.address}, ${snapshot.store.postalCode} ${snapshot.store.city}. Alleen genoemd product of prijsvoorbeeld. Actietotaal geldt bij ${p.quantity} verpakkingen. Beschikbaarheid onbekend.`,
    })),
  });
  return { feed, skipped };
}
