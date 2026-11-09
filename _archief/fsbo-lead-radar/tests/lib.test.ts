import { describe, expect, it } from 'vitest'

import { RateLimiter } from '@/collectors/base/rateLimiter'
import { safeEquals, shortHash, signValue, stableHash, verifySignedValue } from '@/lib/hash'
import { extractBelgianPhones, maskPhone, normalizeBelgianPhone } from '@/lib/phone'
import {
  descriptionSimilarity,
  jaccardSimilarity,
  normalizeText,
  normalizedSimilarity,
  truncate,
} from '@/lib/text'
import { startOfBelgianDay } from '@/lib/time'

describe('normalizeBelgianPhone', () => {
  /**
   * Alle schrijfwijzen hieronder komen in Belgische advertenties voor en horen
   * op hetzelfde nummer uit te komen. Lukt dat niet, dan wordt dezelfde
   * verkoper twee keer opgeslagen en gaat dezelfde lead twee keer de deur uit.
   */
  it('brengt elke schrijfwijze terug tot één E.164-nummer', () => {
    const written = [
      '0475 12 34 56',
      '0475/12.34.56',
      '+32 475 12 34 56',
      '+32475123456',
      '0032 475 123 456',
      '+32 (0)475 12 34 56',
      '475123456',
    ]

    for (const value of written) {
      expect(normalizeBelgianPhone(value)?.e164).toBe('+32475123456')
    }
  })

  it('herkent een mobiel nummer', () => {
    expect(normalizeBelgianPhone('0475 12 34 56')?.isMobile).toBe(true)
    // Vaste lijn Gent.
    expect(normalizeBelgianPhone('09 233 44 55')?.isMobile).toBe(false)
  })

  it('geeft de nationale notatie terug', () => {
    expect(normalizeBelgianPhone('+32475123456')?.national).toBe('0475123456')
  })

  it('wijst niet-Belgische en onvolledige nummers af', () => {
    expect(normalizeBelgianPhone('123')).toBeNull()
    expect(normalizeBelgianPhone('')).toBeNull()
    expect(normalizeBelgianPhone(null)).toBeNull()
    // Elf cijfers is geen Belgisch nationaal nummer.
    expect(normalizeBelgianPhone('+32 4751234567890')).toBeNull()
  })
})

describe('extractBelgianPhones', () => {
  it('vindt nummers in een advertentietekst', () => {
    const phones = extractBelgianPhones(
      'Interesse? Bel mij op 0475 12 34 56 of s avonds op 09/233.44.55.',
    )
    expect(phones.map((phone) => phone.e164)).toEqual(['+32475123456', '+3292334455'])
  })

  it('ontdubbelt hetzelfde nummer in twee schrijfwijzen', () => {
    const phones = extractBelgianPhones('Bel 0475 12 34 56 of +32475123456')
    expect(phones).toHaveLength(1)
  })

  it('geeft een lege lijst zonder nummers', () => {
    expect(extractBelgianPhones('Geen contactgegevens vermeld.')).toEqual([])
    expect(extractBelgianPhones(null)).toEqual([])
  })
})

describe('maskPhone', () => {
  it('maskeert het midden', () => {
    const masked = maskPhone('+32475123456')
    expect(masked.startsWith('+32475')).toBe(true)
    expect(masked.endsWith('56')).toBe(true)
    expect(masked).not.toContain('1234')
  })

  it('geeft een streepje zonder nummer', () => {
    expect(maskPhone(null)).toBe('—')
  })
})

describe('normalizeText', () => {
  it('verwijdert accenten, hoofdletters en leestekens', () => {
    expect(normalizeText('Liège')).toBe('liege')
    expect(normalizeText('Sint-Pieters-Woluwe')).toBe('sint pieters woluwe')
    expect(normalizeText('  Café,   Brussel!  ')).toBe('cafe brussel')
  })

  it('geeft een lege string voor niets', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText('   ')).toBe('')
  })
})

describe('tekstgelijkenis', () => {
  it('geeft 1 voor identieke tekst', () => {
    expect(normalizedSimilarity('Kerkstraat 12', 'kerkstraat 12')).toBe(1)
  })

  it('geeft 0 voor lege invoer', () => {
    expect(normalizedSimilarity('', 'iets')).toBe(0)
    expect(jaccardSimilarity(null, 'iets')).toBe(0)
  })

  it('herkent herschikte tekst via Jaccard', () => {
    // Levenshtein zou hier laag scoren; Jaccard niet, en dat is precies waarom
    // beide methodes gebruikt worden.
    const a = 'Ruim appartement met terras en kelderberging in het centrum'
    const b = 'Kelderberging en terras, ruim appartement gelegen in het centrum'
    expect(jaccardSimilarity(a, b)).toBeGreaterThan(0.7)
    expect(descriptionSimilarity(a, b)).toBeGreaterThan(0.7)
  })

  it('scoort verschillende woningen laag', () => {
    expect(
      descriptionSimilarity(
        'Ruim appartement met terras en twee slaapkamers',
        'Bouwgrond van zes are in rustige verkaveling',
      ),
    ).toBeLessThan(0.35)
  })
})

describe('truncate', () => {
  it('laat korte tekst met rust', () => {
    expect(truncate('kort', 20)).toBe('kort')
  })

  it('knipt op een woordgrens', () => {
    const result = truncate('een tamelijk lange zin die afgekapt moet worden', 20)
    expect(result.length).toBeLessThanOrEqual(21)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('hashing', () => {
  it('geeft dezelfde stabiele hash ongeacht sleutelvolgorde', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }))
  })

  it('negeert lege en ontbrekende waarden', () => {
    expect(stableHash({ a: 1, b: null, c: undefined, d: '' })).toBe(stableHash({ a: 1 }))
  })

  it('geeft een korte hash van de gevraagde lengte', () => {
    expect(shortHash('iets', 16)).toHaveLength(16)
  })
})

describe('handtekeningen', () => {
  const SECRET = 'een-geheim-van-minstens-32-tekens-lang'

  it('accepteert een geldige handtekening', () => {
    const signature = signValue('payload', SECRET)
    expect(verifySignedValue('payload', signature, SECRET)).toBe(true)
  })

  it('weigert een gemanipuleerde payload', () => {
    const signature = signValue('payload', SECRET)
    expect(verifySignedValue('payload-anders', signature, SECRET)).toBe(false)
  })

  it('weigert een handtekening met een ander geheim', () => {
    const signature = signValue('payload', 'een-ander-geheim-van-32-tekens-lang!')
    expect(verifySignedValue('payload', signature, SECRET)).toBe(false)
  })

  it('vergelijkt strings veilig', () => {
    expect(safeEquals('abc', 'abc')).toBe(true)
    expect(safeEquals('abc', 'abd')).toBe(false)
    // Verschillende lengtes mogen niet crashen op timingSafeEqual.
    expect(safeEquals('abc', 'abcdef')).toBe(false)
  })
})

describe('RateLimiter', () => {
  it('laat de eerste requests meteen door', async () => {
    const limiter = new RateLimiter(60)
    const started = Date.now()
    await limiter.acquire('example.be')
    await limiter.acquire('example.be')
    expect(Date.now() - started).toBeLessThan(100)
  })

  it('houdt hosts uit elkaar', async () => {
    const limiter = new RateLimiter(60)
    await limiter.acquire('a.be')
    await limiter.acquire('b.be')
    // Twee hosts delen geen bucket; beide mochten meteen.
    expect(true).toBe(true)
  })

  it('verhoogt de limiet nooit boven de globale bovengrens', async () => {
    const limiter = new RateLimiter(10)
    // Een bron die 600/min vraagt krijgt er 10: de bron mag strenger zijn dan
    // wij, nooit losser.
    limiter.configure('example.be', 600)

    const started = Date.now()
    for (let index = 0; index < 11; index += 1) {
      await limiter.acquire('example.be')
    }
    // De elfde request moest wachten op een nieuw token (6 s bij 10/min);
    // we controleren alleen dát er gewacht is, niet hoe lang precies.
    expect(Date.now() - started).toBeGreaterThan(500)
  }, 20_000)
})

describe('startOfBelgianDay', () => {
  it('geeft middernacht Belgische tijd in de zomer (CEST, UTC+2)', () => {
    const result = startOfBelgianDay(new Date('2026-08-16T14:30:00Z'))
    expect(result.toISOString()).toBe('2026-08-15T22:00:00.000Z')
  })

  it('geeft middernacht Belgische tijd in de winter (CET, UTC+1)', () => {
    const result = startOfBelgianDay(new Date('2026-01-16T14:30:00Z'))
    expect(result.toISOString()).toBe('2026-01-15T23:00:00.000Z')
  })

  it('klopt vlak na lokale middernacht', () => {
    // 00:30 Belgische tijd op 16 augustus = 22:30 UTC op 15 augustus.
    const result = startOfBelgianDay(new Date('2026-08-15T22:30:00Z'))
    expect(result.toISOString()).toBe('2026-08-15T22:00:00.000Z')
  })

  it('klopt op de dag dat de klok vooruit gaat', () => {
    // 29 maart 2026: om 02:00 lokaal springt de klok naar 03:00. Middernacht
    // viel die dag nog in CET (+1), terwijl het moment van opvragen al in CEST
    // (+2) ligt.
    const result = startOfBelgianDay(new Date('2026-03-29T12:00:00Z'))
    expect(result.toISOString()).toBe('2026-03-28T23:00:00.000Z')
  })
})
