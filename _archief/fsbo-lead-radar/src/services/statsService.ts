import 'server-only'

/**
 * De cijfers voor het dashboard.
 *
 * Eén module, zodat de pagina's geen query's bevatten en de tellingen overal
 * hetzelfde betekenen. "Leads vandaag" is bijvoorbeeld *vanaf middernacht in
 * Belgische tijd* en niet "de laatste 24 uur" — zonder één plek waar dat staat
 * krijgen twee schermen twee verschillende getallen.
 */
import type { Prisma } from '@prisma/client'

import type { ListingFilter } from '@/domain/schemas'
import { startOfBelgianDay } from '@/lib/time'
import { prisma } from '@/repositories/prisma'

export interface DashboardStats {
  leadsToday: number
  privateLeadsToday: number
  alertsSentToday: number
  /**
   * Alerts die vandaag door alle poorten kwamen maar niet verstuurd zijn omdat
   * er geen `TELEGRAM_BOT_TOKEN` is ingesteld.
   *
   * Apart geteld en apart getoond: zonder dit getal lijkt het dashboard in de
   * standaardopstelling — en dat is de opstelling waarin iedereen begint —
   * alsof er niets gebeurt, terwijl de pijplijn gewoon werkt.
   */
  alertsDryRunToday: number
  duplicatesToday: number
  activeListings: number
  pendingAlerts: number
  sources: {
    total: number
    enabled: number
    healthy: number
    failing: number
  }
}

export async function getDashboardStats(now: Date = new Date()): Promise<DashboardStats> {
  const dayStart = startOfBelgianDay(now)

  const [
    leadsToday,
    privateLeadsToday,
    alertsSentToday,
    alertsDryRunToday,
    duplicatesToday,
    activeListings,
    pendingAlerts,
    sourceCounts,
  ] = await prisma.$transaction([
    prisma.listing.count({ where: { firstSeenAt: { gte: dayStart } } }),
    prisma.listing.count({
      where: { firstSeenAt: { gte: dayStart }, sellerClassification: 'PRIVATE', status: 'ACTIVE' },
    }),
    prisma.alert.count({ where: { createdAt: { gte: dayStart }, status: 'SENT' } }),
    prisma.alert.count({ where: { createdAt: { gte: dayStart }, status: 'SUPPRESSED_DRY_RUN' } }),
    prisma.listing.count({ where: { firstSeenAt: { gte: dayStart }, status: 'DUPLICATE' } }),
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
    prisma.alert.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }),
    // `groupBy` zou hier vier extra regels typegymnastiek kosten voor een
    // tabel met een handvol rijen. De rijen zelf ophalen en in JavaScript
    // tellen is even snel en veel duidelijker.
    prisma.source.findMany({ select: { health: true, enabled: true } }),
  ])

  const sources = { total: 0, enabled: 0, healthy: 0, failing: 0 }
  for (const source of sourceCounts) {
    sources.total += 1
    if (source.enabled) sources.enabled += 1
    if (source.health === 'HEALTHY') sources.healthy += 1
    if (source.health === 'FAILING' || source.health === 'BLOCKED') sources.failing += 1
  }

  return {
    leadsToday,
    privateLeadsToday,
    alertsSentToday,
    alertsDryRunToday,
    duplicatesToday,
    activeListings,
    pendingAlerts,
    sources,
  }
}

const PAGE_SIZE = 25

export type ListingListItem = Prisma.ListingGetPayload<{
  select: {
    id: true
    url: true
    title: true
    price: true
    currency: true
    listingType: true
    propertyType: true
    postalCode: true
    city: true
    bedrooms: true
    surfaceArea: true
    sellerClassification: true
    sellerConfidence: true
    classificationReasons: true
    leadScore: true
    status: true
    duplicateScore: true
    firstSeenAt: true
    publishedAt: true
    source: { select: { key: true; name: true } }
    seller: { select: { id: true; displayName: true; phoneE164: true } }
    _count: { select: { alerts: true } }
  }
}>

/** Vertaalt de gevalideerde filters naar een Prisma-where. */
export function buildListingWhere(filter: ListingFilter): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {}

  if (filter.source) where.source = { key: filter.source }
  if (filter.postalCode) where.postalCode = filter.postalCode
  if (filter.listingType) where.listingType = filter.listingType
  if (filter.sellerType) where.sellerClassification = filter.sellerType
  if (filter.status) where.status = filter.status
  if (filter.minScore !== undefined) where.leadScore = { gte: filter.minScore }

  if (filter.from || filter.to) {
    where.firstSeenAt = {
      ...(filter.from ? { gte: new Date(`${filter.from}T00:00:00Z`) } : {}),
      // `to` is inclusief: een filter t/m 16 augustus hoort 16 augustus te tonen.
      ...(filter.to ? { lt: new Date(new Date(`${filter.to}T00:00:00Z`).getTime() + 86_400_000) } : {}),
    }
  }

  return where
}

export async function listListings(
  filter: ListingFilter,
): Promise<{ items: ListingListItem[]; total: number; page: number; pageSize: number }> {
  const where = buildListingWhere(filter)

  const [items, total] = await prisma.$transaction([
    prisma.listing.findMany({
      where,
      select: {
        id: true,
        url: true,
        title: true,
        price: true,
        currency: true,
        listingType: true,
        propertyType: true,
        postalCode: true,
        city: true,
        bedrooms: true,
        surfaceArea: true,
        sellerClassification: true,
        sellerConfidence: true,
        classificationReasons: true,
        leadScore: true,
        status: true,
        duplicateScore: true,
        firstSeenAt: true,
        publishedAt: true,
        source: { select: { key: true, name: true } },
        seller: { select: { id: true, displayName: true, phoneE164: true } },
        _count: { select: { alerts: true } },
      },
      orderBy: [{ firstSeenAt: 'desc' }],
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.listing.count({ where }),
  ])

  return { items, total, page: filter.page, pageSize: PAGE_SIZE }
}

export async function listSourceKeys(): Promise<{ key: string; name: string }[]> {
  return prisma.source.findMany({ select: { key: true, name: true }, orderBy: { key: 'asc' } })
}

export type AgencyOverview = Prisma.AgencyGetPayload<{
  include: {
    territories: true
    subscriptions: { include: { territories: { include: { territory: true } } } }
    _count: { select: { alerts: true } }
  }
}>

export async function listAgencies(): Promise<AgencyOverview[]> {
  return prisma.agency.findMany({
    include: {
      territories: { orderBy: { name: 'asc' } },
      subscriptions: {
        include: { territories: { include: { territory: true } } },
        orderBy: { name: 'asc' },
      },
      _count: { select: { alerts: true } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function recentAlerts(limit = 15): Promise<
  Prisma.AlertGetPayload<{
    include: {
      agency: { select: { name: true } }
      listing: { select: { postalCode: true; city: true; price: true; url: true } }
    }
  }>[]
> {
  return prisma.alert.findMany({
    include: {
      agency: { select: { name: true } },
      listing: { select: { postalCode: true, city: true, price: true, url: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
