import { describe, expect, it } from 'vitest'
import { DocumentStatus } from '@prisma/client'

import {
  countsAsPresent,
  isReadable,
  mayHaveStoredObject,
  needsCleanup,
  PENDING_GRACE_MINUTES,
  reconcilePending,
  STATUS_HINTS,
  STATUS_LABELS,
  type CleanupCandidate,
} from '@/modules/documents/domain/lifecycle'
import {
  CHECKSUM_DISCLOSURE,
  computeChecksum,
  explanationMatchesDocument,
  matchesChecksum,
  shortChecksum,
} from '@/modules/documents/domain/integrity'

const NOW = new Date('2026-08-07T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

const candidate = (overrides: Partial<CleanupCandidate> = {}): CleanupCandidate => ({
  id: 'd1',
  storageKey: 'documents/u1/identity/abc.pdf',
  status: DocumentStatus.AVAILABLE,
  deletedAt: null,
  purgedAt: null,
  createdAt: minutesAgo(5),
  ...overrides,
})

describe('leesbaarheid', () => {
  it('laat alleen beschikbare en verlopen documenten openen', () => {
    expect(isReadable(DocumentStatus.AVAILABLE)).toBe(true)
    // Verlopen betekent dat het attest niet meer geldig is, niet dat het weg is.
    expect(isReadable(DocumentStatus.EXPIRED)).toBe(true)

    expect(isReadable(DocumentStatus.PENDING)).toBe(false)
    expect(isReadable(DocumentStatus.FAILED)).toBe(false)
    expect(isReadable(DocumentStatus.DELETED)).toBe(false)
  })

  it('telt alleen beschikbare documenten als aanwezig bewijs', () => {
    // Een verlopen attest is geen geldig bewijs meer voor een checklist.
    expect(countsAsPresent(DocumentStatus.AVAILABLE)).toBe(true)
    expect(countsAsPresent(DocumentStatus.EXPIRED)).toBe(false)
    expect(countsAsPresent(DocumentStatus.PENDING)).toBe(false)
  })

  it('heeft voor elke status een label en een uitleg', () => {
    for (const status of Object.values(DocumentStatus)) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0)
      expect(STATUS_HINTS[status].length).toBeGreaterThan(0)
    }
  })
})

describe('staat er nog een bestand in de opslag', () => {
  it('weet dat een gewist document niets meer heeft', () => {
    expect(
      mayHaveStoredObject({ status: DocumentStatus.DELETED, purgedAt: NOW }),
    ).toBe(false)
  })

  it('weet dat een mislukte upload niets heeft achtergelaten', () => {
    expect(mayHaveStoredObject({ status: DocumentStatus.FAILED, purgedAt: null })).toBe(false)
  })

  it('gaat ervan uit dat een verwijderd maar niet gewist document er nog staat', () => {
    // Dit is het gevaarlijke geval: de gebruiker denkt dat het weg is.
    expect(mayHaveStoredObject({ status: DocumentStatus.DELETED, purgedAt: null })).toBe(true)
  })
})

describe('wat moet opgeruimd worden', () => {
  it('vindt een verwijderd maar niet gewist document', () => {
    expect(needsCleanup(candidate({ deletedAt: minutesAgo(60), purgedAt: null }), NOW)).toBe(
      'deleted_not_purged',
    )
  })

  it('laat een verwijderd én gewist document met rust', () => {
    expect(
      needsCleanup(candidate({ deletedAt: minutesAgo(60), purgedAt: minutesAgo(59) }), NOW),
    ).toBeNull()
  })

  it('vindt een rij die te lang op PENDING staat', () => {
    expect(
      needsCleanup(
        candidate({
          status: DocumentStatus.PENDING,
          createdAt: minutesAgo(PENDING_GRACE_MINUTES + 1),
        }),
        NOW,
      ),
    ).toBe('stuck_pending')
  })

  it('gunt een lopende upload zijn respijtperiode', () => {
    // Een upload die nog bezig is, mag niet halverwege opgeruimd worden.
    expect(
      needsCleanup(
        candidate({ status: DocumentStatus.PENDING, createdAt: minutesAgo(1) }),
        NOW,
      ),
    ).toBeNull()
  })

  it('laat een gewoon beschikbaar document met rust', () => {
    expect(needsCleanup(candidate(), NOW)).toBeNull()
  })
})

describe('een hangende rij herstellen', () => {
  it('zet hem op beschikbaar wanneer het bestand er wél is', () => {
    // Scenario 2: upload gelukt, rij bijwerken mislukt. Niets weggooien.
    expect(
      reconcilePending({ status: DocumentStatus.PENDING, createdAt: minutesAgo(60) }, true, NOW),
    ).toBe('mark_available')
  })

  it('zet hem op mislukt wanneer er niets staat en de tijd om is', () => {
    expect(
      reconcilePending({ status: DocumentStatus.PENDING, createdAt: minutesAgo(60) }, false, NOW),
    ).toBe('mark_failed')
  })

  it('laat hem met rust binnen de respijtperiode', () => {
    expect(
      reconcilePending({ status: DocumentStatus.PENDING, createdAt: minutesAgo(2) }, false, NOW),
    ).toBe('leave_alone')
  })

  it('raakt een rij die niet op PENDING staat niet aan', () => {
    expect(
      reconcilePending({ status: DocumentStatus.AVAILABLE, createdAt: minutesAgo(60) }, false, NOW),
    ).toBe('leave_alone')
  })

  it('is idempotent: tweemaal dezelfde beslissing', () => {
    const input = { status: DocumentStatus.PENDING, createdAt: minutesAgo(60) }
    expect(reconcilePending(input, true, NOW)).toBe(reconcilePending(input, true, NOW))
  })
})

describe('integriteit', () => {
  const data = Buffer.from('inhoud van een testbestand')

  it('geeft dezelfde hash voor dezelfde inhoud', () => {
    expect(computeChecksum(data)).toBe(computeChecksum(Buffer.from(data)))
  })

  it('geeft een andere hash bij een andere byte', () => {
    expect(computeChecksum(data)).not.toBe(computeChecksum(Buffer.from('inhoud van een testbestanD')))
  })

  it('produceert een sha256 in hex', () => {
    expect(computeChecksum(data)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('herkent ongewijzigde inhoud', () => {
    expect(matchesChecksum(data, computeChecksum(data))).toBe(true)
    expect(matchesChecksum(Buffer.from('anders'), computeChecksum(data))).toBe(false)
  })

  it('kort de weergave in', () => {
    expect(shortChecksum(computeChecksum(data))).toHaveLength(13)
    expect(shortChecksum(null)).toBe('—')
  })

  it('zegt erbij dat het geen bewijs van echtheid is', () => {
    // Een sha256 van een vervalste akte is een perfect geldige sha256.
    expect(CHECKSUM_DISCLOSURE.toLowerCase()).toContain('geen bewijs')
    expect(CHECKSUM_DISCLOSURE.toLowerCase()).toContain('echt')
  })
})

describe('hoort een uitleg nog bij het document', () => {
  it('herkent een actuele uitleg', () => {
    expect(explanationMatchesDocument('abc', 'abc')).toBe('current')
  })

  it('herkent een uitleg bij een oudere versie', () => {
    expect(explanationMatchesDocument('abc', 'xyz')).toBe('outdated')
  })

  it('doet geen uitspraak zonder checksums', () => {
    // Bij oudere rijen kunnen we het niet bepalen; dan niet doen alsof.
    expect(explanationMatchesDocument(null, 'abc')).toBe('unknown')
    expect(explanationMatchesDocument('abc', null)).toBe('unknown')
  })
})
