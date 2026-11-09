/**
 * Documentbeveiliging zonder database.
 *
 * De spion legt vast dat élke query op `userId` filtert. Voor documenten is
 * dat strenger dan elders: een ontbrekende filter is hier geen bug maar een
 * datalek van iemands identiteitskaart.
 *
 * De IDOR-tests mét echte data staan in tests/integration/documents.test.ts en
 * draaien alleen met `TEST_DATABASE_URL`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { model: string; method: string; args: Record<string, unknown> }[] = []

const USER = 'user_aaa'
const OTHER = 'user_bbb'

function createSpyClient() {
  const handler = (modelName: string) =>
    new Proxy(
      {},
      {
        get(_t, method: string) {
          return (args: Record<string, unknown> = {}) => {
            calls.push({ model: modelName, method, args })
            if (method === 'findMany') return Promise.resolve([])
            if (method === 'count') return Promise.resolve(0)
            if (method === 'groupBy') return Promise.resolve([])
            if (method === 'updateMany') return Promise.resolve({ count: 1 })
            return Promise.resolve({
              id: 'doc_1',
              userId: USER,
              storageKey: `documents/${USER}/identity/abc.pdf`,
              status: 'AVAILABLE',
              category: 'IDENTITY',
              mimeType: 'application/pdf',
              originalFilename: 'kaart.pdf',
              displayName: null,
              checksum: 'abc',
            })
          }
        },
      },
    )

  return new Proxy(
    {},
    {
      get(_target, modelName: string) {
        if (modelName === 'then') return undefined
        return handler(modelName)
      },
    },
  )
}

vi.mock('@/server/db/prisma', () => ({ prisma: createSpyClient() }))

import { DocumentStatus } from '@prisma/client'
import * as repository from '@/modules/documents/repository'
import {
  buildStorageKey,
  keyBelongsToUser,
  sanitizeFileName,
} from '@/server/storage/policy'

const userIdInWhere = (where: unknown): string | undefined => {
  if (!where || typeof where !== 'object') return undefined
  const record = where as Record<string, unknown>
  return typeof record.userId === 'string' ? record.userId : undefined
}

beforeEach(() => {
  calls.length = 0
})

describe('elke leesactie filtert op de ingelogde gebruiker', () => {
  it('listDocuments', async () => {
    await repository.listDocuments(USER)
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('findDocument gebruikt findFirst met userId', async () => {
    await repository.findDocument(USER, 'doc_1')

    expect(calls[0]?.method).toBe('findFirst')
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('findByChecksum', async () => {
    await repository.findByChecksum(USER, 'abc')
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('countByCategory', async () => {
    await repository.countByCategory(USER)
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('listExplanations', async () => {
    await repository.listExplanations(USER, 'doc_1')
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('latestExplanation', async () => {
    await repository.latestExplanation(USER, 'doc_1')
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })
})

describe('elke schrijfactie filtert op de ingelogde gebruiker', () => {
  it('markAvailable', async () => {
    await repository.markAvailable(USER, 'doc_1', { sizeBytes: 10, checksum: 'abc' })

    expect(calls[0]?.method).toBe('updateMany')
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('markDeleted', async () => {
    await repository.markDeleted(USER, 'doc_1', true)
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('updateMetadata', async () => {
    await repository.updateMetadata(USER, 'doc_1', { displayName: 'x' })
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })

  it('updateLinks', async () => {
    await repository.updateLinks(USER, 'doc_1', { propertyId: 'p1' })
    expect(userIdInWhere(calls[0]?.args.where)).toBe(USER)
  })
})

describe('een id van iemand anders geeft geen toegang', () => {
  it('de userId uit de sessie wint van het meegegeven document-id', async () => {
    await repository.findDocument(USER, 'document_van_iemand_anders')

    const where = calls[0]?.args.where as Record<string, unknown>
    expect(where.userId).toBe(USER)
    expect(where.userId).not.toBe(OTHER)
    expect(where.id).toBe('document_van_iemand_anders')
  })

  it('geen enkele lookup gebruikt findUnique op een id alleen', async () => {
    calls.length = 0
    await repository.findDocument(USER, 'x')
    await repository.findByChecksum(USER, 'x')
    await repository.latestExplanation(USER, 'x')

    for (const call of calls) {
      expect(call.method, `${call.model}.${call.method}`).not.toBe('findUnique')
    }
  })

  it('markDeleted van iemand anders raakt niets', async () => {
    // De updateMany-vorm zorgt dat een verkeerde userId nul rijen raakt in
    // plaats van de rij van een ander.
    await repository.markDeleted(OTHER, 'doc_van_user_aaa', true)

    const where = calls[0]?.args.where as Record<string, unknown>
    expect(where.userId).toBe(OTHER)
  })
})

describe('opslagsleutels', () => {
  it('bevatten nooit de bestandsnaam van de gebruiker', () => {
    const key = buildStorageKey({
      userId: USER,
      category: 'INCOME',
      mimeType: 'application/pdf',
    })

    expect(key).not.toContain('loonfiche')
    expect(key).toMatch(/^documents\/user_aaa\/income\/[0-9a-f-]{36}\.pdf$/)
  })

  it('zijn niet raadbaar: elke keer een andere uuid', () => {
    const make = () =>
      buildStorageKey({ userId: USER, category: 'IDENTITY', mimeType: 'application/pdf' })
    expect(make()).not.toBe(make())
  })

  it('horen bij precies één gebruiker', () => {
    const key = buildStorageKey({ userId: USER, category: 'BANK', mimeType: 'image/png' })

    expect(keyBelongsToUser(key, USER)).toBe(true)
    expect(keyBelongsToUser(key, OTHER)).toBe(false)
  })

  it('laten zich niet foppen met een gebruikers-id dat een voorvoegsel is', () => {
    expect(keyBelongsToUser('documents/user_aaabbb/bank/x.pdf', 'user_aaa')).toBe(false)
  })
})

describe('bestandsnamen zijn onbetrouwbare invoer', () => {
  it('verwijderen padscheidingstekens', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toContain('/')
  })

  it('verwijderen header-injectie', () => {
    const cleaned = sanitizeFileName('bestand".pdf\r\nX-Injected: 1')
    expect(cleaned).not.toContain('"')
    expect(cleaned).not.toContain('\r')
    expect(cleaned).not.toContain('\n')
  })

  it('houden een bruikbare naam over', () => {
    expect(sanitizeFileName('loonfiche januari.pdf')).toBe('loonfiche januari.pdf')
    expect(sanitizeFileName('')).toBe('document')
  })
})

describe('de statusfilter verbergt verwijderde documenten', () => {
  it('sluit DELETED standaard uit', async () => {
    await repository.listDocuments(USER)

    const where = calls[0]?.args.where as Record<string, unknown>
    expect(where.status).toEqual({ not: DocumentStatus.DELETED })
  })

  it('toont ze alleen wanneer er expliciet om gevraagd wordt', async () => {
    await repository.listDocuments(USER, { includeDeleted: true })

    const where = calls[0]?.args.where as Record<string, unknown>
    expect(where.status).toBeUndefined()
  })
})
