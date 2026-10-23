import 'server-only'

import { prisma } from '@/server/db/prisma'
import { requireAdmin } from '@/server/auth/actor'
import { PRICING } from '@/config/plans'
import { monthKey, todayIn } from '@/lib/dates'

export interface AdminMetrics {
  totalUsers: number
  onboardedUsers: number
  newUsersThisWeek: number
  premiumSubscribers: number
  estimatedMrrCents: number
  totalBusinesses: number
  publishedBusinesses: number
  activeDeals: number
  aiMessagesThisMonth: number
  demoBusinesses: number
}

/**
 * Aggregate metrics for the admin overview.
 * Guards with `requireAdmin()` itself rather than trusting the caller.
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  await requireAdmin()

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const period = monthKey(todayIn('UTC'))

  const [
    totalUsers,
    onboardedUsers,
    newUsersThisWeek,
    premiumSubscribers,
    yearlySubscribers,
    totalBusinesses,
    publishedBusinesses,
    demoBusinesses,
    activeDeals,
    aiUsage,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, onboardedAt: { not: null } } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
    prisma.subscription.count({
      where: { plan: 'PREMIUM', status: { in: ['ACTIVE', 'TRIALING'] } },
    }),
    prisma.subscription.count({
      where: { plan: 'PREMIUM', status: { in: ['ACTIVE', 'TRIALING'] }, interval: 'YEARLY' },
    }),
    prisma.business.count({ where: { deletedAt: null } }),
    prisma.business.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
    prisma.business.count({ where: { deletedAt: null, isDemo: true } }),
    prisma.deal.count({ where: { deletedAt: null, status: 'ACTIVE', endsAt: { gte: new Date() } } }),
    prisma.aIUsage.aggregate({ where: { period }, _sum: { messageCount: true } }),
  ])

  // Yearly plans are normalised to a monthly figure so MRR stays comparable.
  const monthlySubscribers = premiumSubscribers - yearlySubscribers
  const estimatedMrrCents =
    monthlySubscribers * PRICING.monthly.amount + yearlySubscribers * Math.round(PRICING.yearly.amount / 12)

  return {
    totalUsers,
    onboardedUsers,
    newUsersThisWeek,
    premiumSubscribers,
    estimatedMrrCents,
    totalBusinesses,
    publishedBusinesses,
    demoBusinesses,
    activeDeals,
    aiMessagesThisMonth: aiUsage._sum.messageCount ?? 0,
  }
}

export async function listRecentUsers(limit = 25) {
  await requireAdmin()

  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      onboardedAt: true,
      createdAt: true,
      subscription: { select: { plan: true, status: true } },
      preference: { select: { city: { select: { name: true } } } },
    },
  })
}

export async function listBusinessesForAdmin(limit = 50) {
  await requireAdmin()

  return prisma.business.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      name: true,
      status: true,
      tier: true,
      isDemo: true,
      createdAt: true,
      category: { select: { name: true } },
      city: { select: { name: true } },
      _count: { select: { deals: true } },
    },
  })
}

export async function listDealsForAdmin(limit = 50) {
  await requireAdmin()

  return prisma.deal.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: 'asc' }, { endsAt: 'asc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      discountType: true,
      discountValue: true,
      isPremiumOnly: true,
      isDemo: true,
      endsAt: true,
      redemptionCount: true,
      business: { select: { name: true, city: { select: { name: true } } } },
    },
  })
}
