/**
 * Normalization engine: RawListing → NormalizedListing.
 * Original source values are preserved verbatim in `original` for audit.
 */

import type { NormalizedListing, RawListing } from "@/domain/listing/types";
import {
  normalizeBedrooms,
  normalizeCity,
  normalizeCurrency,
  normalizeEmail,
  normalizeHouseNumber,
  normalizeListingType,
  normalizePhone,
  normalizePostalCode,
  normalizePrice,
  normalizePropertyType,
  normalizeProvince,
  normalizeStreet,
  normalizeSurface,
  normalizeTimestamp,
  normalizeUrl,
  parseAddress,
} from "./normalizers";

export function normalizeListing(raw: RawListing): NormalizedListing {
  // Address: prefer explicit parts, fall back to parsing the combined string
  const parsed = parseAddress(raw.address);
  const street = normalizeStreet(raw.street) ?? parsed.street;
  const houseNumber = normalizeHouseNumber(raw.houseNumber) ?? parsed.houseNumber;
  const postalCode = normalizePostalCode(raw.postalCode) ?? normalizePostalCode(parsed.postalCode);
  const city = normalizeCity(raw.city) ?? parsed.city;
  const province = normalizeProvince(postalCode);

  const addressParts: string[] = [];
  if (street) {
    addressParts.push(houseNumber ? `${street} ${houseNumber}` : street);
  }
  if (postalCode || city) {
    addressParts.push([postalCode, city].filter(Boolean).join(" "));
  }

  return {
    source: raw.source,
    sourceListingId: raw.sourceListingId,
    sourceUrl: normalizeUrl(raw.sourceUrl),
    listingType: normalizeListingType(raw.listingType),
    title: raw.title?.trim() || null,
    description: raw.description?.trim() || null,
    price: normalizePrice(raw.price),
    currency: normalizeCurrency(raw.currency),
    street,
    houseNumber,
    postalCode,
    city,
    province,
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
    surfaceArea: normalizeSurface(raw.surfaceArea),
    bedrooms: normalizeBedrooms(raw.bedrooms),
    propertyType: normalizePropertyType(raw.propertyType),
    sellerName: raw.sellerName?.trim() || null,
    sellerPhone: normalizePhone(raw.sellerPhone),
    sellerEmail: normalizeEmail(raw.sellerEmail),
    sellerKind: raw.sellerKind?.trim().toLowerCase() || null,
    agencyName: raw.agencyName?.trim() || null,
    sellerListingCount: raw.sellerListingCount ?? null,
    publishedAt: normalizeTimestamp(raw.publishedAt),
    status: raw.status?.trim().toLowerCase() || null,
    original: raw.raw ?? { ...raw },
  };
}
