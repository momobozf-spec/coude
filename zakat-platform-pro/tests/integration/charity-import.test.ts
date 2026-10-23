import { readFileSync } from 'node:fs'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestUser, hasDatabase, prisma, resetDatabase } from './setup'
import { importCharity } from '@/server/modules/charities/import-service'
import { upsertSource } from '@/server/modules/charities/admin-service'
import type { Actor } from '@/server/auth/actor'

const suite = hasDatabase ? describe : describe.skip

const example = () => JSON.parse(readFileSync('docs/charity-example.json', 'utf8')) as Record<string, unknown>

async function admin(): Promise<Actor> {
  const actor = await createTestUser({ email: 'import-admin@test.local' })
  await prisma.user.update({ where: { id: actor.userId }, data: { role: 'ADMIN' } })
  return { ...actor, role: 'ADMIN' }
}

async function causes() {
  for (const slug of ['armoede', 'voedsel']) {
    await prisma.cause.create({ data: { slug, name: slug, category: slug === 'armoede' ? 'POVERTY' : 'FOOD' } })
  }
}

suite('goede doelen importeren', () => {
  beforeEach(resetDatabase)
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('maakt een echte (niet-demo) organisatie met bronnen, claims en badge', async () => {
    await causes()
    const result = await importCharity(await admin(), example())

    expect(result).toMatchObject({ created: true, sources: 2, claimsWritten: 3, claimsUnchanged: 0 })
    const charity = await prisma.charity.findUniqueOrThrow({
      where: { id: result.charityId },
      include: { causes: true, claims: { where: { supersededAt: null } } },
    })
    expect(charity.isDemo).toBe(false)
    expect(charity.verified).toBe(true)
    expect(charity.causes).toHaveLength(2)
    expect(charity.claims).toHaveLength(3)
    expect(charity.transparencyScore).not.toBeNull()
  })

  it('is idempotent: opnieuw importeren schrijft niets dubbel', async () => {
    await causes()
    const actor = await admin()
    await importCharity(actor, example())
    const second = await importCharity(actor, example())

    expect(second).toMatchObject({ created: false, claimsWritten: 0, claimsUnchanged: 3 })
    expect(await prisma.charitySource.count()).toBe(2)
    expect(await prisma.charityClaim.count()).toBe(3)
  })

  it('weigert onbekende categorieën en een niet-beheerder', async () => {
    const actor = await admin()
    await expect(importCharity(actor, example())).rejects.toThrow(/Onbekende categorie/)
    await causes()
    await expect(importCharity({ ...actor, role: 'USER' }, example())).rejects.toThrow(/beheerder/)
  })

  it('weigert het badge zonder geverifieerde registratie', async () => {
    await causes()
    const data = example()
    data.claims = (data.claims as Array<Record<string, unknown>>).filter((claim) => claim.type !== 'REGISTERED_ENTITY')
    await expect(importCharity(await admin(), data)).rejects.toThrow()
  })

  it('laat een bron niet naar een andere organisatie verhuizen', async () => {
    await causes()
    const actor = await admin()
    const a = await importCharity(actor, example())
    const other = await prisma.charity.create({
      data: { slug: 'ander', name: 'Ander', country: 'BE', operatingCountries: ['BE'], website: 'https://example.org/ander' },
    })
    const source = await prisma.charitySource.findFirstOrThrow({ where: { charityId: a.charityId } })

    await expect(
      upsertSource(actor, other.id, { sourceType: 'OTHER', sourceUrl: 'https://example.org/x', title: 'x' }, source.id),
    ).rejects.toThrow()
    expect((await prisma.charitySource.findUniqueOrThrow({ where: { id: source.id } })).charityId).toBe(a.charityId)
  })
})
