import type { RawListing } from "@/domain/listing/raw-listing";
import { rawListingSchema } from "@/domain/listing/raw-listing";
import type { NormalizedListing } from "@/domain/listing/normalized-listing";
import {
  foldText,
  normalizeAddress,
  normalizeBedrooms,
  normalizeCoordinate,
  normalizeCurrency,
  normalizeEmail,
  normalizeInteger,
  normalizeListingType,
  normalizePersonName,
  normalizePhone,
  normalizePrice,
  normalizePropertyType,
  normalizeSellerTypeHint,
  normalizeStatus,
  normalizeSurface,
  normalizeTimestamp,
  normalizeUrl,
} from "./normalizers";

export class NormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NormalizationError";
  }
}

/**
 * Convert a RawListing (as returned by a collector) into the canonical model.
 * Fails only when essential identity is missing; everything else degrades
 * gracefully with warnings so nothing is silently dropped.
 */
export function normalizeListing(sourceKey: string, input: RawListing): NormalizedListing {
  const parsed = rawListingSchema.safeParse(input);
  if (!parsed.success) {
    throw new NormalizationError(`Invalid raw listing: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  const raw = parsed.data;
  const warnings: string[] = [];

  const address = normalizeAddress({
    address: raw.address,
    street: raw.street,
    houseNumber: raw.houseNumber,
    boxNumber: raw.boxNumber,
    postalCode: raw.postalCode,
    city: raw.city,
    province: raw.province,
  });
  if (!address.postalCode) warnings.push("postal_code_missing");
  if (!address.addressKey) warnings.push("address_incomplete");

  const price = normalizePrice(raw.price);
  if (raw.price !== undefined && price === null) warnings.push("price_unparseable");

  const phone = normalizePhone(raw.sellerPhone);
  if (raw.sellerPhone && !phone) warnings.push("phone_unparseable");

  const publishedAt = normalizeTimestamp(raw.publishedAt);
  if (raw.publishedAt && !publishedAt) warnings.push("published_at_unparseable");

  return {
    sourceKey,
    sourceListingId: raw.sourceListingId,
    sourceUrl: normalizeUrl(raw.sourceUrl),
    listingType: normalizeListingType(raw.listingType),
    title: raw.title?.trim() || null,
    description: raw.description?.trim() || null,
    price,
    currency: normalizeCurrency(raw.currency),
    address,
    latitude: normalizeCoordinate(raw.latitude, "lat"),
    longitude: normalizeCoordinate(raw.longitude, "lng"),
    propertyType: normalizePropertyType(raw.propertyType),
    bedrooms: normalizeBedrooms(raw.bedrooms),
    surfaceArea: normalizeSurface(raw.surfaceArea),
    landArea: normalizeSurface(raw.landArea),
    seller: {
      name: raw.sellerName?.trim() || null,
      normalizedName: normalizePersonName(raw.sellerName),
      phone,
      email: normalizeEmail(raw.sellerEmail),
      company: raw.sellerCompany?.trim() || null,
      typeHint: normalizeSellerTypeHint(raw.sellerType),
      listingCount: normalizeInteger(raw.sellerListingCount, { min: 0 }),
    },
    publishedAt,
    status: normalizeStatus(raw.status),
    raw: { ...raw } as Record<string, unknown>,
    warnings,
  };
}

export { foldText };
