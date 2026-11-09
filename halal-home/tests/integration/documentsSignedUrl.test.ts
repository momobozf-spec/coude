/**
 * De volledige levenscyclus van een gesigneerde download-URL, via de échte
 * route handler, tegen een echte database en een echte filesystem-opslag.
 *
 * ─── WAAROM DIT GEEN MOCK MAG ZIJN ───────────────────────────────────────────
 *
 * Dit is de IDOR-grens. Alles erachter — loonfiches, identiteitskaarten,
 * verkoopovereenkomsten — is precies wat er niet mag lekken. Een mock die
 * `findFirst({ userId })` naspeelt bewijst hier niets: hij bevestigt alleen dat
 * de test denkt zoals de code denkt. Als de WHERE-clausule de `userId` mist,
 * blijft de mock groen en lekt de echte database.
 *
 * Daarom draait elke zaak hieronder door `GET` uit
 * `src/app/api/documents/download/route.ts` heen, met een echte rij in
 * PostgreSQL en een echt bestand op schijf. Alleen de sessie is vervangen —
 * die kán niet echt zijn buiten een browser, en het is precies de variabele
 * die we willen kunnen omzetten van Alice naar Bob.
 *
 * ─── DE MATRIX ───────────────────────────────────────────────────────────────
 *
 *   handtekening | sessie      | staat document | verwacht
 *   -------------+-------------+----------------+---------------------------
 *   geldig       | eigenaar    | AVAILABLE      | 200 + inhoud
 *   geldig       | ándere      | AVAILABLE      | 404, geen inhoud
 *   geldig       | geen        | AVAILABLE      | fout, geen inhoud
 *   verlopen     | eigenaar    | AVAILABLE      | 401/400, geen inhoud
 *   vervalst     | eigenaar    | AVAILABLE      | 401/400, geen inhoud
 *   geldig       | eigenaar    | DELETED        | fout, geen inhoud
 *   geldig       | eigenaar    | gepurged       | fout, geen inhoud
 *   geldig       | eigenaar    | PENDING        | fout, geen inhoud
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { DocumentCategory, DocumentStatus } from '@prisma/client'

import { describeIfDatabase } from './setup'
import { createUser, deleteUser, prisma } from './helpers'

/**
 * De enige mock in dit bestand.
 *
 * `requireUserId()` leest de sessiecookie; buiten een browser bestaat die niet.
 * De autorisatielogica die we testen zit níet hierin — die zit in de route en
 * in de WHERE-clausule van de query, en die draaien allebei echt.
 */
const currentUserId = vi.hoisted(() => ({ value: null as string | null }))

vi.mock('@/modules/auth/session', () => ({
  requireUserId: async () => {
    if (!currentUserId.value) throw Object.assign(new Error('Niet ingelogd'), { status: 401 })
    return currentUserId.value
  },
}))

const { GET } = await import('@/app/api/documents/download/route')
const service = await import('@/modules/documents/service')
const repository = await import('@/modules/documents/repository')
const { getStorageProvider, LocalStorageProvider } = await import('@/server/storage')

const SECRET_CONTENT = 'loonfiche-die-niet-mag-lekken'

const pdf = (content: string) => Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.from(content)])

const request = (url: string) => new Request(url)

/** Voert de route uit en geeft status én body terug. */
async function fetchDownload(url: string) {
  const response = await GET(request(url))
  const buffer = Buffer.from(await response.arrayBuffer())
  return { status: response.status, body: buffer.toString('utf8') }
}

describeIfDatabase('gesigneerde download-URL', () => {
  let alice: string
  let bob: string
  let documentId: string
  let storageKey: string
  let validUrl: string

  beforeAll(async () => {
    alice = (await createUser('Alice')).id
    bob = (await createUser('Bob')).id

    currentUserId.value = alice
    const result = await service.uploadDocument(alice, {
      category: DocumentCategory.INCOME,
      originalFilename: 'loonfiche.pdf',
      mimeType: 'application/pdf',
      data: pdf(SECRET_CONTENT),
    })
    documentId = result.documentId
    storageKey = (await repository.requireDocument(alice, documentId)).storageKey
    validUrl = await service.createDownloadUrl(alice, documentId)
  })

  afterAll(async () => {
    currentUserId.value = null
    await deleteUser(alice)
    await deleteUser(bob)
    await prisma.$disconnect()
  })

  beforeEach(() => {
    currentUserId.value = alice
  })

  it('geeft de inhoud aan de eigenaar met een geldige handtekening', async () => {
    const { status, body } = await fetchDownload(validUrl)

    expect(status).toBe(200)
    expect(body).toContain(SECRET_CONTENT)
  })

  it('geeft niets aan een ándere ingelogde gebruiker, ook met dezelfde geldige URL', async () => {
    // Het scenario waar het om draait: Alice deelt per ongeluk haar
    // download-link. Bob is ingelogd, de handtekening klopt, en toch hoort hij
    // niets te krijgen. De URL bewijst alleen dat wíj hem uitgaven.
    currentUserId.value = bob

    const { status, body } = await fetchDownload(validUrl)

    expect(status).toBe(404)
    expect(body).not.toContain(SECRET_CONTENT)
  })

  it('geeft niets aan wie niet ingelogd is', async () => {
    currentUserId.value = null

    const { body } = await fetchDownload(validUrl)
    expect(body).not.toContain(SECRET_CONTENT)
  })

  it('weigert een verlopen handtekening', async () => {
    const provider = getStorageProvider()
    if (!(provider instanceof LocalStorageProvider)) throw new Error('verwacht lokale opslag')

    // Een handtekening die geldig wás: correct gemaakt, maar verlopen. Zo wordt
    // bewezen dat de vervaltijd getoetst wordt en niet alleen de hash.
    const expired = Math.floor(Date.now() / 1000) - 60
    const url = new URL(validUrl)
    url.searchParams.set('expires', String(expired))
    url.searchParams.set('signature', signFor(provider, storageKey, expired))

    const { status, body } = await fetchDownload(url.toString())

    expect(status).toBeGreaterThanOrEqual(400)
    expect(body).not.toContain(SECRET_CONTENT)
  })

  it('weigert een vervalste handtekening', async () => {
    const url = new URL(validUrl)
    url.searchParams.set('signature', 'a'.repeat(64))

    const { status, body } = await fetchDownload(url.toString())

    expect(status).toBeGreaterThanOrEqual(400)
    expect(body).not.toContain(SECRET_CONTENT)
  })

  it('weigert een opgerekte vervaltijd zonder nieuwe handtekening', async () => {
    // De klassieke poging: expires ophogen en de rest laten staan. De
    // handtekening dekt beide velden, dus dit hoort te falen.
    const url = new URL(validUrl)
    url.searchParams.set('expires', String(Math.floor(Date.now() / 1000) + 86_400))

    const { status, body } = await fetchDownload(url.toString())

    expect(status).toBeGreaterThanOrEqual(400)
    expect(body).not.toContain(SECRET_CONTENT)
  })

  it('weigert een sleutel die naar de map van iemand anders wijst', async () => {
    const url = new URL(validUrl)
    url.searchParams.set('key', storageKey.replace(alice, bob))

    const { status, body } = await fetchDownload(url.toString())

    expect(status).toBeGreaterThanOrEqual(400)
    expect(body).not.toContain(SECRET_CONTENT)
  })

  it('weigert een sleutel die uit de opslagmap probeert te ontsnappen', async () => {
    const url = new URL(validUrl)
    url.searchParams.set('key', `documents/${alice}/../../../.env`)

    const { body } = await fetchDownload(url.toString())
    expect(body).not.toContain('DATABASE_URL')
  })

  it('weigert een verzoek zonder handtekening', async () => {
    const url = new URL(validUrl)
    url.searchParams.delete('signature')

    const { status, body } = await fetchDownload(url.toString())

    expect(status).toBeGreaterThanOrEqual(400)
    expect(body).not.toContain(SECRET_CONTENT)
  })

  it('geeft niets meer terug zodra het document verwijderd is', async () => {
    const own = await service.uploadDocument(alice, {
      category: DocumentCategory.INCOME,
      originalFilename: 'weg.pdf',
      mimeType: 'application/pdf',
      data: pdf('dit-wordt-verwijderd'),
    })
    const url = await service.createDownloadUrl(alice, own.documentId)

    // De URL werkte vóór het verwijderen — anders bewijst de test hierna niets.
    expect((await fetchDownload(url)).body).toContain('dit-wordt-verwijderd')

    await service.deleteDocument(alice, own.documentId)

    const { status, body } = await fetchDownload(url)
    expect(status).toBeGreaterThanOrEqual(400)
    expect(body).not.toContain('dit-wordt-verwijderd')
  })

  it('geeft niets terug voor een document dat nog op PENDING staat', async () => {
    const pending = await service.uploadDocument(alice, {
      category: DocumentCategory.INCOME,
      originalFilename: 'bezig.pdf',
      mimeType: 'application/pdf',
      data: pdf('nog-niet-bevestigd'),
    })
    const url = await service.createDownloadUrl(alice, pending.documentId)

    await prisma.document.update({
      where: { id: pending.documentId },
      data: { status: DocumentStatus.PENDING },
    })

    const { status, body } = await fetchDownload(url)
    expect(status).toBeGreaterThanOrEqual(400)
    expect(body).not.toContain('nog-niet-bevestigd')
  })

  it('legt elke geslaagde download vast in de audittrail, zonder inhoud', async () => {
    await fetchDownload(validUrl)

    const audit = await prisma.auditLog.findFirst({
      where: { userId: alice, action: 'DOCUMENT_DOWNLOADED', entityId: documentId },
      orderBy: { createdAt: 'desc' },
    })

    expect(audit).not.toBeNull()
    expect(JSON.stringify(audit?.metadata)).not.toContain(SECRET_CONTENT)
  })

  it('laat de browser de inhoud niet cachen of sniffen', async () => {
    const response = await GET(request(validUrl))

    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
  })

  it('gebruikt een korte geldigheidsduur', async () => {
    const expires = Number(new URL(validUrl).searchParams.get('expires'))
    const ttl = expires - Math.floor(Date.now() / 1000)

    expect(ttl).toBeGreaterThan(0)
    // Een uur is al ruim voor een download; alles daarboven is een gelekte link
    // die te lang blijft werken.
    expect(ttl).toBeLessThanOrEqual(3600)
  })
})

/**
 * Maakt een handtekening zoals de provider dat zou doen.
 *
 * Bewust via de provider zelf en niet met een eigen HMAC-implementatie: als het
 * signeeralgoritme verandert, moet deze test meeveranderen zonder dat we het
 * geheim of het formaat hier hoeven te herhalen.
 */
function signFor(provider: InstanceType<typeof LocalStorageProvider>, key: string, expiresAt: number): string {
  return (
    provider as unknown as { sign(key: string, expiresAt: number): string }
  ).sign(key, expiresAt)
}
