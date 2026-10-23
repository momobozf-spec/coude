export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: string;
  color?: string;
  stock: number;
}

export interface ProductWithCategory {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  shortDesc: string | null;
  description: string;
  descriptionFr: string | null;
  descriptionAr: string | null;
  price: number;
  comparePrice: number | null;
  images: string[];
  sizes: string[];
  colors: string[];
  scents: string[];
  materials: string[];
  tags: string[];
  gender: string | null;
  stock: number;
  weight: number | null;
  shippingType: string | null;
  status: string;
  featured: boolean;
  bestSeller: boolean;
  newCollection: boolean;
  badge: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  supplier: string | null;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface VendorSummary {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  location: string | null;
  type: string;
  imageSeed: string | null;
  verified: boolean;
}

export interface ServiceWithRelations {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  description: string;
  priceFrom: number | null;
  priceType: string;
  location: string | null;
  online: boolean;
  images: string[];
  tags: string[];
  featured: boolean;
  popular: boolean;
  status: string;
  vendor: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
}
