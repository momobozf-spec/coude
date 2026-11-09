import type { Metadata } from 'next'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/server/auth/actor'
import { prisma } from '@/server/db/prisma'

export const metadata: Metadata = { title: 'Categories', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  await requireAdmin()

  const categories = await prisma.businessCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      isActive: true,
      _count: { select: { businesses: true } },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Discovery categories. Editing arrives with the business portal."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            No categories yet. Run <code className="text-xs">npm run db:seed</code>.
          </Card>
        ) : (
          categories.map((category) => (
            <Card key={category.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{category.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{category.slug}</p>
                </div>
                <Badge variant={category.isActive ? 'success' : 'default'} size="sm">
                  {category.isActive ? 'Active' : 'Hidden'}
                </Badge>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {category._count.businesses} listing{category._count.businesses === 1 ? '' : 's'} ·{' '}
                {category.type}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
