/**
 * Prisma-rij → domeinrecord.
 *
 * Hier gebeurt één ding dat meer is dan overtypen: `criteria` en `reasons`
 * worden bij het lézen gevalideerd. Een JSON-kolom kan van alles bevatten —
 * een handmatige database-edit, een document van een oudere schemaversie, een
 * mislukte migratie. Door bij elke lees door Zod te gaan, kan een kapot
 * document nooit ongemerkt de services in glijden.
 */
import { searchCriteriaSchema, type SearchCriteria } from "../../../schemas/searchCriteria.js";
import type { MatchReason } from "../../../types/matching.js";
import type {
  PropertyRecord,
  SearchMatchRecord,
  SearchRecord,
  SearchRunRecord,
  UserRecord,
} from "../../../types/domain.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- de generated Prisma-rijen
   zijn hier het enige `any`; alles wat deze functies verlaten is getypeerd. */

export function toSearchCriteria(value: unknown): SearchCriteria {
  const parsed = searchCriteriaSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  // Niet gooien: één corrupt document mag niet de hele lijst onbruikbaar maken.
  // Lege criteria matchen niets, dus het is een zichtbare maar veilige uitkomst.
  return searchCriteriaSchema.parse({});
}

export function toMatchReasons(value: unknown): MatchReason[] {
  return Array.isArray(value) ? (value as MatchReason[]) : [];
}

export function mapUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    locale: row.locale,
    timezone: row.timezone,
    createdAt: row.createdAt,
  };
}

export function mapSearch(row: any): SearchRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    originalQuery: row.originalQuery,
    criteria: toSearchCriteria(row.criteria),
    criteriaVersion: row.criteriaVersion,
    parsedBy: row.parsedBy ?? null,
    active: row.active,
    frequency: row.frequency,
    lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapSearchRun(row: any): SearchRunRecord {
  return {
    id: row.id,
    searchId: row.searchId,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    scrapedCount: row.scrapedCount,
    newPropertyCount: row.newPropertyCount,
    matchCount: row.matchCount,
    notifiedCount: row.notifiedCount,
    sourceStats: row.sourceStats,
    error: row.error,
  };
}

export function mapProperty(row: any): PropertyRecord {
  return {
    id: row.id,
    source: row.source,
    externalId: row.externalId,
    url: row.url,
    urlNormalized: row.urlNormalized,
    fingerprint: row.fingerprint,
    title: row.title,
    description: row.description,
    address: row.address,
    postalCode: row.postalCode,
    city: row.city,
    region: row.region,
    latitude: row.latitude,
    longitude: row.longitude,
    propertyType: row.propertyType,
    transactionType: row.transactionType,
    price: row.price,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    livingAreaM2: row.livingAreaM2,
    landAreaM2: row.landAreaM2,
    epcLabel: row.epcLabel,
    epcValue: row.epcValue,
    features: row.features ?? [],
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    discoveredAt: row.discoveredAt,
    lastSeenAt: row.lastSeenAt,
    delistedAt: row.delistedAt,
  };
}

export function mapMatch(row: any): SearchMatchRecord {
  return {
    id: row.id,
    searchId: row.searchId,
    propertyId: row.propertyId,
    userId: row.userId,
    score: row.score,
    hardPass: row.hardPass,
    reasons: toMatchReasons(row.reasons),
    aiSummary: row.aiSummary,
    aiGeneratedAt: row.aiGeneratedAt,
    status: row.status,
    notifiedAt: row.notifiedAt,
    createdAt: row.createdAt,
  };
}
