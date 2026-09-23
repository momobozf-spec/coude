import type { ListingType, PropertyType, SellerType } from "@/generated/prisma/enums";

export interface NormalizedAddress {
  addressLine: string | null;
  street: string | null;
  houseNumber: string | null;
  boxNumber: string | null;
  postalCode: string | null;
  city: string | null;
  municipality: string | null;
  province: string | null;
  /** Deterministic key used for property matching: "street|number|postalcode" */
  addressKey: string | null;
}

export interface NormalizedSeller {
  name: string | null;
  normalizedName: string | null;
  phone: string | null; // E.164 e.g. +32478123456
  email: string | null;
  company: string | null;
  typeHint: SellerType | null;
  listingCount: number | null;
}

export interface NormalizedListing {
  sourceKey: string;
  sourceListingId: string;
  sourceUrl: string | null;
  listingType: ListingType;
  title: string | null;
  description: string | null;
  price: number | null; // integer EUR
  currency: string;
  address: NormalizedAddress;
  latitude: number | null;
  longitude: number | null;
  propertyType: PropertyType;
  bedrooms: number | null;
  surfaceArea: number | null;
  landArea: number | null;
  seller: NormalizedSeller;
  publishedAt: Date | null;
  status: "ACTIVE" | "REMOVED";
  /** Original values kept verbatim for audit/debugging. */
  raw: Record<string, unknown>;
  /** Non-fatal issues found while normalizing. */
  warnings: string[];
}
