// Whitelist of MarketplaceProduct fields that may be shown publicly.
// NEVER add fileUrl here — the paid file is only delivered via a signed download.

export const PUBLIC_PRODUCT_SELECT = {
  id: true,
  sellerId: true,
  title: true,
  description: true,
  thumbnail: true,
  previewUrl: true,
  price: true,
  currency: true,
  category: true,
  ageRange: true,
  languages: true,
  tags: true,
  pageCount: true,
  downloads: true,
  rating: true,
  reviewCount: true,
  isFeatured: true,
  isPublished: true,
  createdAt: true,
} as const;

type PublicProductRow = {
  languages: string;
  tags: string;
  [key: string]: unknown;
};

export function toPublicProduct<T extends PublicProductRow>(p: T) {
  // Defensive: strip fileUrl even if a caller accidentally selected it.
  const { fileUrl: _omit, ...rest } = p as T & { fileUrl?: unknown };
  void _omit;
  return {
    ...rest,
    languages: p.languages ? p.languages.split(",") : [],
    tags: p.tags ? p.tags.split(",") : [],
  };
}
