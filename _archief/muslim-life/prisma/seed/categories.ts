import type { PrismaClient } from '@prisma/client'

interface CategorySeed {
  slug: string
  name: string
  icon: string
  type: 'FOOD' | 'RETAIL' | 'SERVICE' | 'TRAVEL' | 'EVENT'
  sortOrder: number
}

export const CATEGORIES: CategorySeed[] = [
  { slug: 'restaurants', name: 'Restaurants', icon: 'utensils-crossed', type: 'FOOD', sortOrder: 1 },
  { slug: 'cafes', name: 'Cafés', icon: 'coffee', type: 'FOOD', sortOrder: 2 },
  { slug: 'butchers', name: 'Butchers', icon: 'beef', type: 'FOOD', sortOrder: 3 },
  { slug: 'bakeries', name: 'Bakeries', icon: 'croissant', type: 'FOOD', sortOrder: 4 },
  { slug: 'grocery', name: 'Grocery', icon: 'shopping-basket', type: 'FOOD', sortOrder: 5 },
  { slug: 'modest-fashion', name: 'Modest fashion', icon: 'shirt', type: 'RETAIL', sortOrder: 6 },
  { slug: 'bookstores', name: 'Islamic bookstores', icon: 'book-open', type: 'RETAIL', sortOrder: 7 },
  { slug: 'perfume', name: 'Perfume & attar', icon: 'sparkles', type: 'RETAIL', sortOrder: 8 },
  { slug: 'home', name: 'Home & gifts', icon: 'house', type: 'RETAIL', sortOrder: 9 },
  { slug: 'mosques', name: 'Mosques', icon: 'landmark', type: 'SERVICE', sortOrder: 10 },
  { slug: 'family-activities', name: 'Family activities', icon: 'users', type: 'SERVICE', sortOrder: 11 },
  { slug: 'services', name: 'Services', icon: 'briefcase', type: 'SERVICE', sortOrder: 12 },
  { slug: 'travel', name: 'Travel & Umrah', icon: 'plane', type: 'TRAVEL', sortOrder: 13 },
  { slug: 'events', name: 'Events', icon: 'calendar-days', type: 'EVENT', sortOrder: 14 },
]

export async function seedCategories(prisma: PrismaClient) {
  for (const category of CATEGORIES) {
    await prisma.businessCategory.upsert({
      where: { slug: category.slug },
      create: category,
      update: { name: category.name, icon: category.icon, sortOrder: category.sortOrder },
    })
  }

  return prisma.businessCategory.count()
}
