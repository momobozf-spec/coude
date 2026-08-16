/** Canonical listing shapes shared by collectors, ingestion and matching. */

export type ListingKind = "sale" | "rent";

/** Raw listing exactly as produced by a collector — untrusted, unnormalized. */
export interface RawListing {
  /** Source code, e.g. "fixture-portal-a" */
  source: string;
  /** Stable identifier of the ad at the source */
  sourceListingId: string;
  sourceUrl?: string;
  listingType?: string;
  title?: string;
  description?: string;
  price?: string | number;
  currency?: string;
  address?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  surfaceArea?: string | number;
  bedrooms?: string | number;
  propertyType?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  /** Free-form seller descriptor from the source, e.g. "particulier", "agency" */
  sellerKind?: string;
  agencyName?: string;
  publishedAt?: string;
  status?: string;
  /** Number of active listings this seller has at the source, when known */
  sellerListingCount?: number;
  /** Original payload preserved verbatim for audit/debugging */
  raw?: Record<string, unknown>;
}

/** Normalized canonical listing produced by the normalization engine. */
export interface NormalizedListing {
  source: string;
  sourceListingId: string;
  sourceUrl: string | null;
  listingType: "SALE" | "RENT";
  title: string | null;
  description: string | null;
  price: number | null; // integer EUR
  currency: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  address: string | null; // normalized display address
  surfaceArea: number | null; // m², integer
  bedrooms: number | null;
  propertyType: "HOUSE" | "APARTMENT" | "LAND" | "COMMERCIAL" | "OTHER" | "UNKNOWN";
  sellerName: string | null;
  sellerPhone: string | null; // E.164 (+32...)
  sellerEmail: string | null;
  sellerKind: string | null;
  agencyName: string | null;
  sellerListingCount: number | null;
  publishedAt: Date | null;
  status: string | null;
  /** Original source values kept for audit/debugging */
  original: Record<string, unknown>;
}
