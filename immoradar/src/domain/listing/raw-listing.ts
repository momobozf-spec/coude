import { z } from "zod";

/**
 * RawListing is what a collector returns. It is intentionally loose: values
 * are strings/numbers as found at the source. Normalization turns this into a
 * NormalizedListing. The raw payload is always stored for audit.
 */
export const rawListingSchema = z.object({
  sourceListingId: z.string().min(1),
  sourceUrl: z.string().optional(),
  listingType: z.string().optional(), // "sale" | "rent" | "te koop" | "à vendre" ...
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  address: z.string().optional(),
  street: z.string().optional(),
  houseNumber: z.string().optional(),
  boxNumber: z.string().optional(),
  postalCode: z.union([z.string(), z.number()]).optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  propertyType: z.string().optional(),
  bedrooms: z.union([z.string(), z.number()]).optional(),
  surfaceArea: z.union([z.string(), z.number()]).optional(),
  landArea: z.union([z.string(), z.number()]).optional(),
  sellerName: z.string().optional(),
  sellerPhone: z.string().optional(),
  sellerEmail: z.string().optional(),
  sellerType: z.string().optional(), // hint from source, e.g. "private", "agency"
  sellerCompany: z.string().optional(),
  sellerListingCount: z.union([z.string(), z.number()]).optional(),
  publishedAt: z.union([z.string(), z.date()]).optional(),
  status: z.string().optional(),
  images: z.array(z.string()).optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export type RawListing = z.infer<typeof rawListingSchema>;
