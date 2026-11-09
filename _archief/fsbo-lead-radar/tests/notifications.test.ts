import { describe, expect, it, vi } from 'vitest'

import {
  buildAlertMessage,
  buildDedupeKey,
  escapeHtml,
  formatAge,
  formatPrice,
  type AlertMessageInput,
} from '@/notifications/alertMessage'
import { TelegramClient } from '@/notifications/telegramClient'
import { evaluateSubscription, resolveChatId, type AlertCandidate } from '@/services/alertService'

const NOW = new Date('2026-08-16T12:00:00Z')

function message(overrides: Partial<AlertMessageInput> = {}): AlertMessageInput {
  return {
    postalCode: '9000',
    city: 'Gent',
    propertyType: 'appartement',
    listingType: 'sale',
    price: 329_000,
    currency: 'EUR',
    bedrooms: 2,
    surfaceArea: 92,
    sellerName: 'Elke Vermeulen',
    sellerPhoneE164: '+32475123456',
    sellerConfidence: 0.91,
    classificationReasons: ['Advertentie zegt expliciet "zonder makelaar"'],
    leadScore: 91,
    url: 'https://example.be/zoekertje/1',
    sourceName: 'Demomarkt',
    firstSeenAt: new Date('2026-08-16T11:56:00Z'),
    territoryName: 'Gent centrum',
    now: NOW,
    ...overrides,
  }
}

describe('buildAlertMessage', () => {
  it('bevat alles wat de makelaar nodig heeft om te bellen', () => {
    const text = buildAlertMessage(message())

    expect(text).toContain('9000 Gent')
    expect(text).toContain('Appartement')
    expect(text).toContain('2 slaapkamers')
    expect(text).toContain('92 m²')
    expect(text).toContain('Particuliere verkoper (91% zeker)')
    expect(text).toContain('Leadscore: 91/100')
    expect(text).toContain('4 minuten geleden')
    expect(text).toContain('+32475123456')
    expect(text).toContain('https://example.be/zoekertje/1')
  })

  it('laat ontbrekende velden weg in plaats van "null" te tonen', () => {
    const text = buildAlertMessage(
      message({ bedrooms: null, surfaceArea: null, sellerPhoneE164: null, sellerName: null, city: null }),
    )

    expect(text).not.toContain('null')
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('slaapkamer')
    expect(text).not.toContain('📞')
  })

  it('markeert een huuradvertentie als zodanig', () => {
    expect(buildAlertMessage(message({ listingType: 'rent' }))).toContain('huur')
  })

  it('ontsnapt HTML uit brondata', () => {
    // Een titel of naam uit een bron mag het bericht niet kunnen breken.
    const text = buildAlertMessage(message({ sellerName: '<b>Jan</b> & Co' }))
    expect(text).toContain('&lt;b&gt;Jan&lt;/b&gt; &amp; Co')
  })
})

describe('formatPrice en formatAge', () => {
  it('schrijft bedragen in Belgische notatie', () => {
    expect(formatPrice(329_000, 'EUR')).toMatch(/329/)
    expect(formatPrice(null, 'EUR')).toBe('Prijs onbekend')
  })

  it('schrijft leeftijden leesbaar', () => {
    expect(formatAge(new Date('2026-08-16T11:59:40Z'), NOW)).toBe('zonet')
    expect(formatAge(new Date('2026-08-16T11:59:00Z'), NOW)).toBe('1 minuut geleden')
    expect(formatAge(new Date('2026-08-16T11:56:00Z'), NOW)).toBe('4 minuten geleden')
    expect(formatAge(new Date('2026-08-16T09:00:00Z'), NOW)).toBe('3 uur geleden')
    expect(formatAge(new Date('2026-08-14T12:00:00Z'), NOW)).toBe('2 dagen geleden')
  })
})

describe('escapeHtml', () => {
  it('ontsnapt precies de drie tekens die Telegram-HTML kan verwarren', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
    // Apostroffen en aanhalingstekens hoeven niet en zouden het bericht alleen
    // lelijker maken.
    expect(escapeHtml("Jan's woning")).toBe("Jan's woning")
  })
})

describe('buildDedupeKey', () => {
  /**
   * Dubbele alerts zijn de snelste manier om het vertrouwen van een makelaar
   * te verliezen. Deze sleutel staat als UNIQUE in de database.
   */
  it('is stabiel voor dezelfde combinatie', () => {
    expect(buildDedupeKey('sub-1', 'listing-1', 'new')).toBe(buildDedupeKey('sub-1', 'listing-1', 'new'))
  })

  it('verschilt per abonnement', () => {
    expect(buildDedupeKey('sub-1', 'listing-1', 'new')).not.toBe(
      buildDedupeKey('sub-2', 'listing-1', 'new'),
    )
  })

  it('verschilt per advertentie', () => {
    expect(buildDedupeKey('sub-1', 'listing-1', 'new')).not.toBe(
      buildDedupeKey('sub-1', 'listing-2', 'new'),
    )
  })

  it('staat een tweede bericht toe voor een andere aanleiding', () => {
    // Een prijsdaling is nieuws dat de makelaar wél wil horen, ook al kreeg hij
    // deze woning al eerder.
    expect(buildDedupeKey('sub-1', 'listing-1', 'new')).not.toBe(
      buildDedupeKey('sub-1', 'listing-1', 'price-drop'),
    )
  })
})

describe('TelegramClient', () => {
  it('verstuurt niets zonder token en meldt dat als dry-run', async () => {
    const fetchImpl = vi.fn()
    const client = new TelegramClient({ botToken: '', fetchImpl: fetchImpl as unknown as typeof fetch })

    const result = await client.sendMessage('123', 'hallo')

    expect(result.dryRun).toBe(true)
    expect(result.ok).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('verstuurt met token en leest het bericht-id uit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 4711 } }),
    })

    const client = new TelegramClient({
      botToken: 'test-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const result = await client.sendMessage('123', 'hallo')

    expect(result.ok).toBe(true)
    expect(result.dryRun).toBe(false)
    expect(result.messageId).toBe('4711')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('geeft een fout terug in plaats van te gooien wanneer Telegram weigert', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ ok: false, description: 'Too Many Requests', parameters: { retry_after: 30 } }),
    })

    const client = new TelegramClient({
      botToken: 'test-token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const result = await client.sendMessage('123', 'hallo')

    expect(result.ok).toBe(false)
    expect(result.retryAfterSeconds).toBe(30)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// De poorten waar een lead doorheen moet voordat er een bericht uitgaat
// ─────────────────────────────────────────────────────────────────────────────

type Subscription = Parameters<typeof evaluateSubscription>[0]

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    agencyId: 'agency-1',
    name: 'Particulieren Gent',
    status: 'ACTIVE',
    listingTypes: ['SALE'],
    propertyTypes: [],
    minPrice: null,
    maxPrice: null,
    minLeadScore: 55,
    minPrivateConfidence: 0.85,
    requirePhone: false,
    telegramChatId: null,
    createdAt: NOW,
    updatedAt: NOW,
    agency: { id: 'agency-1', name: 'Immo Test', active: true, telegramChatId: '111' },
    territories: [
      {
        subscriptionId: 'sub-1',
        territoryId: 'ter-1',
        territory: {
          id: 'ter-1',
          agencyId: 'agency-1',
          name: 'Gent centrum',
          kind: 'POSTAL_CODE',
          postalCodes: ['9000'],
          municipalities: [],
          provinces: [],
          centerLat: null,
          centerLng: null,
          radiusKm: null,
          active: true,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
    ],
    ...overrides,
  } as Subscription
}

function candidate(overrides: Partial<AlertCandidate> = {}): AlertCandidate {
  return {
    listingId: 'listing-1',
    sourceName: 'Demomarkt',
    url: 'https://example.be/1',
    postalCode: '9000',
    city: 'Gent',
    province: 'oost-vlaanderen',
    latitude: 51.0543,
    longitude: 3.7174,
    propertyType: 'appartement',
    listingType: 'sale',
    price: 329_000,
    currency: 'EUR',
    bedrooms: 2,
    surfaceArea: 92,
    sellerName: 'Elke Vermeulen',
    sellerPhoneE164: '+32475123456',
    sellerClassification: 'private',
    sellerConfidence: 0.91,
    classificationReasons: [],
    leadScore: 91,
    firstSeenAt: NOW,
    isDuplicate: false,
    ...overrides,
  }
}

const DEFAULTS = { minPrivateConfidence: 0.85, minLeadScore: 55 }

describe('evaluateSubscription', () => {
  it('laat een passende lead door', () => {
    const decision = evaluateSubscription(subscription(), candidate(), DEFAULTS)
    expect(decision.matched).toBe(true)
    expect(decision.territoryMatch?.precision).toBe('exact')
  })

  it('weigert een professional', () => {
    const decision = evaluateSubscription(
      subscription(),
      candidate({ sellerClassification: 'professional' }),
      DEFAULTS,
    )
    expect(decision.matched).toBe(false)
    expect(decision.rejection).toContain('professional')
  })

  it('weigert een lead onder de zekerheidsdrempel', () => {
    const decision = evaluateSubscription(
      subscription(),
      candidate({ sellerConfidence: 0.8 }),
      DEFAULTS,
    )
    expect(decision.matched).toBe(false)
    expect(decision.rejection).toContain('drempel')
  })

  it('past de strengste van de twee drempels toe', () => {
    // Het abonnement mag strenger zijn dan de omgeving, nooit losser.
    const decision = evaluateSubscription(
      subscription({ minPrivateConfidence: 0.95 }),
      candidate({ sellerConfidence: 0.91 }),
      DEFAULTS,
    )
    expect(decision.matched).toBe(false)

    const looser = evaluateSubscription(
      subscription({ minPrivateConfidence: 0.5 }),
      candidate({ sellerConfidence: 0.8 }),
      DEFAULTS,
    )
    expect(looser.matched).toBe(false)
  })

  it('weigert een duplicaat', () => {
    const decision = evaluateSubscription(subscription(), candidate({ isDuplicate: true }), DEFAULTS)
    expect(decision.matched).toBe(false)
    expect(decision.rejection).toContain('duplicaat')
  })

  it('weigert een gepauzeerd abonnement', () => {
    const decision = evaluateSubscription(subscription({ status: 'PAUSED' }), candidate(), DEFAULTS)
    expect(decision.matched).toBe(false)
  })

  it('weigert een inactieve makelaar', () => {
    const decision = evaluateSubscription(
      subscription({ agency: { id: 'agency-1', name: 'Immo Test', active: false, telegramChatId: '111' } }),
      candidate(),
      DEFAULTS,
    )
    expect(decision.matched).toBe(false)
    expect(decision.rejection).toContain('inactief')
  })

  it('weigert buiten het werkgebied', () => {
    const decision = evaluateSubscription(
      subscription(),
      candidate({ postalCode: '2000', city: 'Antwerpen', province: 'antwerpen' }),
      DEFAULTS,
    )
    expect(decision.matched).toBe(false)
    expect(decision.rejection).toContain('werkgebied')
  })

  it('respecteert de prijsgrenzen', () => {
    expect(
      evaluateSubscription(subscription({ maxPrice: 300_000 }), candidate(), DEFAULTS).matched,
    ).toBe(false)
    expect(
      evaluateSubscription(subscription({ minPrice: 400_000 }), candidate(), DEFAULTS).matched,
    ).toBe(false)
  })

  it('respecteert de eis van een telefoonnummer', () => {
    const decision = evaluateSubscription(
      subscription({ requirePhone: true }),
      candidate({ sellerPhoneE164: null }),
      DEFAULTS,
    )
    expect(decision.matched).toBe(false)
    expect(decision.rejection).toContain('telefoonnummer')
  })

  it('respecteert het gekozen type', () => {
    const decision = evaluateSubscription(subscription(), candidate({ listingType: 'rent' }), DEFAULTS)
    expect(decision.matched).toBe(false)
  })

  it('geeft altijd een reden bij afwijzing', () => {
    // Zonder reden is "waarom kreeg ik deze lead niet?" niet te beantwoorden.
    const decision = evaluateSubscription(subscription(), candidate({ leadScore: 10 }), DEFAULTS)
    expect(decision.matched).toBe(false)
    expect(decision.rejection).toBeTruthy()
  })
})

describe('resolveChatId', () => {
  it('geeft het abonnement voorrang op de makelaar', () => {
    expect(resolveChatId(subscription({ telegramChatId: '999' }), '')).toBe('999')
  })

  it('valt terug op de makelaar', () => {
    expect(resolveChatId(subscription(), '')).toBe('111')
  })

  it('valt terug op de globale chat', () => {
    expect(
      resolveChatId(
        subscription({ agency: { id: 'a', name: 'x', active: true, telegramChatId: null } }),
        '777',
      ),
    ).toBe('777')
  })

  it('geeft null wanneer nergens een chat bekend is', () => {
    expect(
      resolveChatId(
        subscription({ agency: { id: 'a', name: 'x', active: true, telegramChatId: null } }),
        '',
      ),
    ).toBeNull()
  })
})
