export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  stock: number;
}

export interface ProductWithCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice: number | null;
  images: string[];
  stock: number;
  featured: boolean;
  archived: boolean;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}
