/**
 * Domeintypes: wat de services zien.
 *
 * Deze types zijn bewust niet de Prisma-modeltypes. Twee concrete redenen:
 *
 *  1. Prisma typeert `Search.criteria` als `JsonValue`. Hier is het
 *     `SearchCriteria`. Dat scheelt een cast — en dus een mogelijkheid tot
 *     fouten — in elke service die criteria aanraakt.
 *  2. Een service die op deze types werkt, is te testen met een in-memory
 *     repository. Zonder database, zonder Docker, in milliseconden.
 *
 * De enums komen wél uit de generatie: dat zijn platte string-unies zonder
 * runtime-afhankelijkheid van de client, en ze dubbel definiëren zou juist
 * uit-de-pas-lopen uitnodigen.
 */
import type {
  MatchStatus,
  NotificationChannelType,
  NotificationStatus,
  RunStatus,
  SearchFrequency,
  TransactionType,
} from "../generated/prisma/enums.js";
import type { SearchCriteria } from "../schemas/searchCriteria.js";
import type { MatchReason } from "./matching.js";

export type { MatchStatus, NotificationChannelType, NotificationStatus, RunStatus, SearchFrequency, TransactionType };

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  timezone: string;
  createdAt: Date;
}

export interface SearchRecord {
  id: string;
  userId: string;
  name: string;
  originalQuery: string;
  criteria: SearchCriteria;
  criteriaVersion: number;
  parsedBy: string | null;
  active: boolean;
  frequency: SearchFrequency;
  lastRunAt: Date | null;
  nextRunAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSearchInput {
  userId: string;
  name: string;
  originalQuery: string;
  criteria: SearchCriteria;
  criteriaVersion: number;
  parsedBy: string | null;
  frequency?: SearchFrequency;
  active?: boolean;
}

export interface UpdateSearchInput {
  name?: string;
  originalQuery?: string;
  criteria?: SearchCriteria;
  criteriaVersion?: number;
  parsedBy?: string | null;
  frequency?: SearchFrequency;
  active?: boolean;
  nextRunAt?: Date;
}

export interface SearchRunRecord {
  id: string;
  searchId: string;
  status: RunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  scrapedCount: number;
  newPropertyCount: number;
  matchCount: number;
  notifiedCount: number;
  sourceStats: unknown;
  error: string | null;
}

export interface SearchRunTotals {
  scrapedCount: number;
  newPropertyCount: number;
  matchCount: number;
  notifiedCount: number;
  sourceStats?: unknown;
}

export interface PropertyRecord {
  id: string;
  source: string;
  externalId: string;
  url: string;
  urlNormalized: string;
  fingerprint: string;
  title: string;
  description: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  transactionType: TransactionType;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaM2: number | null;
  landAreaM2: number | null;
  epcLabel: string | null;
  epcValue: number | null;
  features: string[];
  imageUrl: string | null;
  publishedAt: Date | null;
  discoveredAt: Date;
  lastSeenAt: Date;
  delistedAt: Date | null;
}

export interface PropertyChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Wat een upsert opleverde — de matching engine moet nieuw van gewijzigd kunnen onderscheiden. */
export interface PropertyUpsertResult {
  property: PropertyRecord;
  isNew: boolean;
  changes: PropertyChange[];
}

export interface SearchMatchRecord {
  id: string;
  searchId: string;
  propertyId: string;
  userId: string;
  score: number;
  hardPass: boolean;
  reasons: MatchReason[];
  aiSummary: string | null;
  aiGeneratedAt: Date | null;
  status: MatchStatus;
  notifiedAt: Date | null;
  createdAt: Date;
}

export interface UpsertMatchInput {
  searchId: string;
  propertyId: string;
  userId: string;
  score: number;
  hardPass: boolean;
  reasons: MatchReason[];
}
