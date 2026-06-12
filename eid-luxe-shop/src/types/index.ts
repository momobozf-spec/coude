export type Currency = "EUR" | "USD" | "GBP";
export type Language = "nl" | "en" | "fr";

export type Audience = "him" | "her" | "kids" | "family" | "all";
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type Badge =
  | "best_seller"
  | "limited_eid"
  | "gift_ready"
  | "new"
  | "premium";

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string; // category id
  price: number; // base price in EUR
  oldPrice?: number;
  currency: Currency;
  description: string;
  longDescription: string;
  whatsInside: string[];
  image: string; // CSS gradient/SVG identifier (mocked)
  imageAccent: string; // accent color hex
  rating: number; // 0-5
  reviewCount: number;
  badge?: Badge;
  targetAudience: Audience;
  collection: string;
  stockStatus: StockStatus;
  featured: boolean;
  shippingNote?: string;
  returnNote?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string; // emoji or short label
  accent: string; // tailwind gradient classes
}

export interface Review {
  id: string;
  productId?: string;
  author: string;
  country: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface WishlistItem {
  productId: string;
  addedAt: number;
}
