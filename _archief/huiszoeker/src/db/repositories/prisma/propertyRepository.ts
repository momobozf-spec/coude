/**
 * Prisma-implementatie van PropertyRepository, inclusief de ontdubbeling.
 *
 * Twee sleutels worden hier gebruikt, in volgorde van hardheid:
 *   1. (source, externalId) — de bron zegt zelf dat dit hetzelfde zoekertje is
 *   2. urlNormalized        — hetzelfde pand via een andere ingang
 *
 * De derde sleutel, de vingerafdruk, wordt hier bewust NIET gebruikt om te
 * mergen. Een pand van Immoweb en hetzelfde pand van Zimmo zijn twee
 * bronrijen met elk hun eigen `source + externalId`; die samenvoegen zou
 * betekenen dat we bronspecifieke informatie weggooien en dat een van de twee
 * unieke constraints alsnog knalt. In plaats daarvan levert
 * `findByFingerprint` de kandidaten op, en beslist de matching engine om geen
 * tweede melding te sturen.
 */
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { ListPropertiesOptions, PropertyRepository } from "../interfaces.js";
import type { PropertyChange, PropertyRecord, PropertyUpsertResult } from "../../../types/domain.js";
import type { PropertyListing } from "../../../schemas/property.js";
import { normalizeUrl } from "../../../lib/url.js";
import { fingerprintForListing } from "../../../lib/fingerprint.js";
import { mapProperty } from "./mappers.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- `raw` is een JSON-kolom. */

/**
 * Velden waarvan een wijziging de moeite van het bijhouden waard is.
 * `description` staat er bewust niet bij: die verandert bij elke kleine
 * tekstredactie van de makelaar en zou de historie onbruikbaar maken.
 */
const TRACKED_FIELDS = [
  "price",
  "bedrooms",
  "bathrooms",
  "livingAreaM2",
  "landAreaM2",
  "epcLabel",
  "epcValue",
  "title",
] as const;

export class PrismaPropertyRepository implements PropertyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertFromListing(listing: PropertyListing): Promise<PropertyUpsertResult> {
    const urlNormalized = normalizeUrl(listing.url);
    const fingerprint = fingerprintForListing(listing);
    const transactionType = listing.transactionType === "rent" ? "RENT" : "BUY";

    const existing =
      (await this.prisma.property.findUnique({
        where: { source_externalId: { source: listing.source, externalId: listing.externalId } },
      })) ?? (await this.prisma.property.findUnique({ where: { urlNormalized } }));

    const data = {
      source: listing.source,
      externalId: listing.externalId,
      url: listing.url,
      urlNormalized,
      fingerprint,
      title: listing.title,
      description: listing.description ?? null,
      address: listing.address ?? null,
      postalCode: listing.postalCode ?? null,
      city: listing.city ?? null,
      region: listing.region ?? null,
      latitude: listing.latitude ?? null,
      longitude: listing.longitude ?? null,
      propertyType: listing.propertyType ?? null,
      transactionType,
      price: listing.price ?? null,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      livingAreaM2: listing.livingAreaM2 ?? null,
      landAreaM2: listing.landAreaM2 ?? null,
      epcLabel: listing.epcLabel ?? null,
      epcValue: listing.epcValue ?? null,
      features: listing.features,
      imageUrl: listing.imageUrl ?? null,
      publishedAt: listing.publishedAt ?? null,
      lastSeenAt: new Date(),
      delistedAt: null,
    } as const;

    if (!existing) {
      const row = await this.prisma.property.create({
        data: { ...data, discoveredAt: listing.discoveredAt } as any,
      });
      return { property: mapProperty(row), isNew: true, changes: [] };
    }

    const changes = diffTrackedFields(existing, data);

    const row = await this.prisma.property.update({
      where: { id: existing.id },
      data: data as any,
    });

    if (changes.length > 0) {
      await this.prisma.propertyHistory.createMany({
        data: changes.map((c) => ({
          propertyId: existing.id,
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
        })),
      });
    }

    return { property: mapProperty(row), isNew: false, changes };
  }

  async findById(id: string): Promise<PropertyRecord | null> {
    const row = await this.prisma.property.findUnique({ where: { id } });
    return row ? mapProperty(row) : null;
  }

  async findByFingerprint(fingerprint: string, excludeId?: string): Promise<PropertyRecord[]> {
    const rows = await this.prisma.property.findMany({
      where: { fingerprint, ...(excludeId ? { id: { not: excludeId } } : {}) },
      take: 20,
    });
    return rows.map(mapProperty);
  }

  async list(options: ListPropertiesOptions = {}): Promise<PropertyRecord[]> {
    const rows = await this.prisma.property.findMany({
      where: buildPropertyWhere(options),
      orderBy: { discoveredAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
    return rows.map(mapProperty);
  }

  count(options: ListPropertiesOptions = {}): Promise<number> {
    return this.prisma.property.count({ where: buildPropertyWhere(options) });
  }

  async markSeen(ids: string[], seenAt: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.property.updateMany({ where: { id: { in: ids } }, data: { lastSeenAt: seenAt } });
  }
}

function buildPropertyWhere(options: ListPropertiesOptions) {
  return {
    ...(options.city ? { city: { equals: options.city, mode: "insensitive" as const } } : {}),
    ...(options.source ? { source: options.source } : {}),
  };
}

function diffTrackedFields(existing: any, next: Record<string, unknown>): PropertyChange[] {
  const changes: PropertyChange[] = [];
  for (const field of TRACKED_FIELDS) {
    const before = existing[field] ?? null;
    const after = (next[field] as unknown) ?? null;
    if (before === after) continue;
    changes.push({
      field,
      oldValue: before === null ? null : String(before),
      newValue: after === null ? null : String(after),
    });
  }
  return changes;
}
