'use server'

import { revalidatePath } from 'next/cache'

import { agencyFormSchema, subscriptionFormSchema, territoryFormSchema } from '@/domain/schemas'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/repositories/prisma'
import { writeAudit } from '@/services/auditService'

/**
 * Server actions voor het makelaarsbeheer.
 *
 * Elke action begint met `requireAdmin()`. Een server action is een POST naar
 * een publiek endpoint; dat de knop erachter op een beveiligde pagina staat,
 * houdt niemand tegen die het adres kent.
 *
 * Daarna gaat elke invoer door een Zod-schema. De foutmelding komt terug als
 * platte string in plaats van een exception, zodat het formulier hem kan tonen
 * in plaats van dat de pagina omvalt.
 */

export interface ActionState {
  error?: string
  ok?: string
}

function firstIssue(issues: { path: PropertyKey[]; message: string }[]): string {
  const issue = issues[0]
  if (!issue) return 'Ongeldige invoer'
  const field = issue.path.map(String).join('.')
  return field ? `${field}: ${issue.message}` : issue.message
}

/** FormData → gewoon object. Checkboxen leveren 'on' of niets. */
function toObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key.endsWith('[]')) {
      const name = key.slice(0, -2)
      const existing = result[name]
      result[name] = Array.isArray(existing) ? [...existing, value] : [value]
    } else {
      result[key] = value
    }
  }
  return result
}

export async function saveAgency(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()

  const raw = toObject(formData)
  const parsed = agencyFormSchema.safeParse({ ...raw, active: raw.active === 'on' })
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : null
  const data = {
    name: parsed.data.name,
    contactEmail: parsed.data.contactEmail || null,
    telegramChatId: parsed.data.telegramChatId || null,
    active: parsed.data.active,
  }

  const agency = id
    ? await prisma.agency.update({ where: { id }, data })
    : await prisma.agency.create({ data })

  await writeAudit({
    actor: 'admin',
    action: id ? 'UPDATE_AGENCY' : 'CREATE_AGENCY',
    entityType: 'Agency',
    entityId: agency.id,
    metadata: { name: agency.name, active: agency.active },
  })

  revalidatePath('/admin/agencies')
  return { ok: id ? 'Makelaar bijgewerkt' : 'Makelaar toegevoegd' }
}

export async function saveTerritory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()

  const raw = toObject(formData)
  const parsed = territoryFormSchema.safeParse({ ...raw, active: raw.active === 'on' })
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const territory = await prisma.territory.create({
    data: {
      agencyId: parsed.data.agencyId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      postalCodes: parsed.data.postalCodes,
      municipalities: parsed.data.municipalities,
      provinces: parsed.data.provinces.map((value) => value.toLowerCase()),
      centerLat: parsed.data.centerLat ?? null,
      centerLng: parsed.data.centerLng ?? null,
      radiusKm: parsed.data.radiusKm ?? null,
      active: parsed.data.active,
    },
  })

  await writeAudit({
    actor: 'admin',
    action: 'CREATE_TERRITORY',
    entityType: 'Territory',
    entityId: territory.id,
    metadata: { name: territory.name, kind: territory.kind },
  })

  revalidatePath('/admin/agencies')
  return { ok: `Werkgebied "${territory.name}" toegevoegd` }
}

export async function deleteTerritory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin()

  const id = formData.get('id')
  if (typeof id !== 'string' || id.length === 0) return { error: 'Geen werkgebied opgegeven' }

  await prisma.territory.delete({ where: { id } })
  await writeAudit({ actor: 'admin', action: 'DELETE_TERRITORY', entityType: 'Territory', entityId: id })

  revalidatePath('/admin/agencies')
  return { ok: 'Werkgebied verwijderd' }
}

export async function saveSubscription(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const raw = toObject(formData)
  const listingTypes = formData.getAll('listingTypes[]').map(String)
  const territoryIds = formData.getAll('territoryIds[]').map(String)

  const parsed = subscriptionFormSchema.safeParse({
    ...raw,
    listingTypes,
    territoryIds,
    requirePhone: raw.requirePhone === 'on',
  })
  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : null

  const data = {
    agencyId: parsed.data.agencyId,
    name: parsed.data.name,
    status: parsed.data.status,
    listingTypes: parsed.data.listingTypes,
    propertyTypes: parsed.data.propertyTypes,
    minPrice: parsed.data.minPrice ?? null,
    maxPrice: parsed.data.maxPrice ?? null,
    minLeadScore: parsed.data.minLeadScore,
    minPrivateConfidence: parsed.data.minPrivateConfidence,
    requirePhone: parsed.data.requirePhone,
    telegramChatId: parsed.data.telegramChatId || null,
  }

  const subscription = id
    ? await prisma.subscription.update({ where: { id }, data })
    : await prisma.subscription.create({ data })

  // De gebieden worden volledig vervangen: het formulier stuurt de gewenste
  // eindtoestand, niet een wijziging erop.
  await prisma.$transaction([
    prisma.subscriptionTerritory.deleteMany({ where: { subscriptionId: subscription.id } }),
    prisma.subscriptionTerritory.createMany({
      data: parsed.data.territoryIds.map((territoryId) => ({
        subscriptionId: subscription.id,
        territoryId,
      })),
      skipDuplicates: true,
    }),
  ])

  await writeAudit({
    actor: 'admin',
    action: id ? 'UPDATE_SUBSCRIPTION' : 'CREATE_SUBSCRIPTION',
    entityType: 'Subscription',
    entityId: subscription.id,
    metadata: { name: subscription.name, status: subscription.status },
  })

  revalidatePath('/admin/agencies')
  return { ok: id ? 'Abonnement bijgewerkt' : 'Abonnement toegevoegd' }
}

export async function setSubscriptionStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()

  const id = formData.get('id')
  const status = formData.get('status')

  if (typeof id !== 'string' || id.length === 0) return { error: 'Geen abonnement opgegeven' }
  if (status !== 'ACTIVE' && status !== 'PAUSED' && status !== 'CANCELLED') {
    return { error: 'Onbekende status' }
  }

  await prisma.subscription.update({ where: { id }, data: { status } })
  await writeAudit({
    actor: 'admin',
    action: 'SET_SUBSCRIPTION_STATUS',
    entityType: 'Subscription',
    entityId: id,
    metadata: { status },
  })

  revalidatePath('/admin/agencies')
  return { ok: `Abonnement staat nu op ${status}` }
}
