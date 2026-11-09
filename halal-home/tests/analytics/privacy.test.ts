/**
 * Analytics mag geen persoonsgegevens bevatten.
 *
 * Dit is de test die dat afdwingt. De whitelist in de service is de
 * implementatie; deze tests leggen vast wat er gebeurt wanneer iemand ooit een
 * bedrag of een adres meegeeft.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/db/prisma', () => ({
  prisma: {
    analyticsEvent: {
      create: () => Promise.resolve(null),
      createMany: () => Promise.resolve({ count: 0 }),
    },
  },
}))

const { isStableKey, sanitizeProperties } = await import('@/modules/analytics/service')

describe('eigenschappen filteren', () => {
  it('laat toegestane eigenschappen door', () => {
    const clean = sanitizeProperties({
      stageIndex: 3,
      taskCount: 44,
      progressPercentage: 37,
      country: 'BE',
    })

    expect(clean).toEqual({
      stageIndex: 3,
      taskCount: 44,
      progressPercentage: 37,
      country: 'BE',
    })
  })

  it('gooit bedragen eruit', () => {
    // Het bedrag dat iemand kan besteden hoort niet in een analytics-tabel.
    const clean = sanitizeProperties({
      taskCount: 3,
      budgetCents: 45_000_000,
      amount: 450_000,
      ownFundsCents: 9_000_000,
    })

    expect(clean).toEqual({ taskCount: 3 })
  })

  it('gooit adressen en identificerende gegevens eruit', () => {
    const clean = sanitizeProperties({
      stageIndex: 1,
      address: 'Voorbeeldstraat 12',
      postalCode: '9000',
      city: 'Gent',
      email: 'iemand@example.com',
      fileName: 'loonfiche-januari.pdf',
    })

    expect(clean).toEqual({ stageIndex: 1 })
  })

  it('weigert een lange string ook in een toegestaan veld', () => {
    // Anders zou iemand de whitelist omzeilen door een adres in `source` te
    // stoppen.
    const clean = sanitizeProperties({ source: 'x'.repeat(200), taskCount: 1 })
    expect(clean).toEqual({ taskCount: 1 })
  })

  it('laat een korte waarde in een toegestaan veld wél door', () => {
    expect(sanitizeProperties({ source: 'complete' })).toEqual({ source: 'complete' })
  })

  it('geeft undefined wanneer er niets overblijft', () => {
    // Zo komt er geen leeg JSON-object in de database te staan.
    expect(sanitizeProperties({ address: 'Voorbeeldstraat 12' })).toBeUndefined()
    expect(sanitizeProperties(undefined)).toBeUndefined()
  })

  it('laat null en booleans door in toegestane velden', () => {
    expect(sanitizeProperties({ needsFinancing: null, wasOptional: true })).toEqual({
      needsFinancing: null,
      wasOptional: true,
    })
  })
})

describe('stabiele sleutels', () => {
  it('accepteert blauwdruk- en checklistsleutels', () => {
    expect(isStableKey('FINANCING_COMPARE_OPTIONS')).toBe(true)
    expect(isStableKey('doc.payslips')).toBe(true)
    expect(isStableKey('be.notary.deed')).toBe(true)
  })

  it('weigert vrije tekst van de gebruiker', () => {
    // Een taaktitel die iemand zelf typte hoort niet in analytics.
    expect(isStableKey('Mijn eigen taak over de woning in Gent')).toBe(false)
    expect(isStableKey('iemand@example.com')).toBe(false)
    expect(isStableKey('')).toBe(false)
  })

  it('weigert een te lange sleutel', () => {
    expect(isStableKey('A'.repeat(100))).toBe(false)
  })
})
