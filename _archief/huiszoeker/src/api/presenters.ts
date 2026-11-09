/**
 * Domeinrecord → API-DTO.
 *
 * Deze laag bestaat zodat een kolom toevoegen aan de database niet automatisch
 * een API-wijziging is. `lockedBy` en `lockedAt` bijvoorbeeld zijn interne
 * werking en gaan niet naar buiten.
 */
import type { PropertyRecord, SearchMatchRecord, SearchRecord } from "../types/domain.js";

export interface SearchDto {
  id: string;
  name: string;
  originalQuery: string;
  criteria: unknown;
  criteriaVersion: number;
  parsedBy: string | null;
  active: boolean;
  frequency: string;
  running: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export function toSearchDto(search: SearchRecord): SearchDto {
  return {
    id: search.id,
    name: search.name,
    originalQuery: search.originalQuery,
    criteria: search.criteria,
    criteriaVersion: search.criteriaVersion,
    parsedBy: search.parsedBy,
    active: search.active,
    frequency: search.frequency,
    // Wél of er nu een run bezig is, níet wie hem vasthoudt of sinds wanneer.
    running: search.lockedAt !== null,
    lastRunAt: search.lastRunAt?.toISOString() ?? null,
    nextRunAt: search.nextRunAt.toISOString(),
    createdAt: search.createdAt.toISOString(),
    updatedAt: search.updatedAt.toISOString(),
  };
}

export function toPropertyDto(property: PropertyRecord) {
  return {
    id: property.id,
    source: property.source,
    url: property.url,
    title: property.title,
    description: property.description,
    address: property.address,
    postalCode: property.postalCode,
    city: property.city,
    propertyType: property.propertyType,
    transactionType: property.transactionType,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    livingAreaM2: property.livingAreaM2,
    landAreaM2: property.landAreaM2,
    epcLabel: property.epcLabel,
    features: property.features,
    imageUrl: property.imageUrl,
    publishedAt: property.publishedAt?.toISOString() ?? null,
    discoveredAt: property.discoveredAt.toISOString(),
    delistedAt: property.delistedAt?.toISOString() ?? null,
  };
}

export function toMatchDto(match: SearchMatchRecord) {
  return {
    id: match.id,
    searchId: match.searchId,
    propertyId: match.propertyId,
    score: match.score,
    hardPass: match.hardPass,
    reasons: match.reasons,
    aiSummary: match.aiSummary,
    status: match.status,
    notifiedAt: match.notifiedAt?.toISOString() ?? null,
    createdAt: match.createdAt.toISOString(),
  };
}
