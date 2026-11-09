/**
 * De lokale opslagprovider tegen een écht filesystem.
 *
 * ─── WAAROM DIT GEEN IN-MEMORY MOCK IS ───────────────────────────────────────
 *
 * Een in-memory Map als opslag is een prima testdubbel voor code die opslag
 * gebruikt, maar hij is waardeloos voor het testen van de opslag zelf. De
 * fouten die hier gevonden moeten worden zijn juist de filesystem-fouten:
 *
 *   - een sleutel met `..` die buiten de basismap wijst;
 *   - een submap die nog niet bestaat;
 *   - een bestand dat er niet is (ENOENT) — is dat een fout of een antwoord?
 *   - een tweede `delete` op iets dat al weg is;
 *   - binaire bytes die ongeschonden terugkomen.
 *
 * Een Map heeft geen paden, geen mappen en geen ENOENT. Hij zou alle vijf de
 * gevallen stilzwijgend laten slagen.
 *
 * Elke test hier draait op een eigen wegwerpmap in de temp-directory, die na
 * afloop volledig verdwijnt.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { LocalStorageProvider } from '@/server/storage/localProvider'
import { StorageError } from '@/lib/errors'

// Geen `describeIfDatabase`: hier is geen database bij betrokken. Deze suite
// hoort te draaien zolang er een schijf is.
describe('lokale opslag op een echt filesystem', () => {
  let baseDir: string
  let storage: LocalStorageProvider

  beforeAll(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), 'halalhome-storage-'))
    storage = new LocalStorageProvider(baseDir, 'x'.repeat(32))
  })

  afterAll(async () => {
    await rm(baseDir, { recursive: true, force: true })
    // Een test die zijn eigen rommel laat staan, vult op den duur de schijf van
    // wie hem draait.
    expect(existsSync(baseDir)).toBe(false)
  })

  const key = (name: string) => `documents/user-1/income/${name}`

  it('schrijft een bestand weg op de schijf, inclusief ontbrekende submappen', async () => {
    const result = await storage.put(key('a.pdf'), Buffer.from('%PDF-1.4 hallo'), 'application/pdf')

    expect(result.size).toBe(14)

    const onDisk = path.join(baseDir, 'documents', 'user-1', 'income', 'a.pdf')
    expect((await stat(onDisk)).size).toBe(14)
    expect((await readFile(onDisk)).toString()).toBe('%PDF-1.4 hallo')
  })

  it('leest exact dezelfde bytes terug', async () => {
    // Bewust binair en met een nulbyte: een provider die ergens tekst van maakt,
    // valt hier door de mand en niet pas bij een echte PDF van een gebruiker.
    const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0xfe, 0x0a, 0x7f])
    await storage.put(key('binair.pdf'), bytes, 'application/pdf')

    const read = await storage.get(key('binair.pdf'))
    expect(read.equals(bytes)).toBe(true)
  })

  it('overschrijft een bestaande sleutel zonder rest van de oude inhoud', async () => {
    await storage.put(key('over.pdf'), Buffer.from('een langere eerste inhoud'), 'application/pdf')
    await storage.put(key('over.pdf'), Buffer.from('kort'), 'application/pdf')

    expect((await storage.get(key('over.pdf'))).toString()).toBe('kort')
  })

  it('meldt of een bestand bestaat', async () => {
    await storage.put(key('bestaat.pdf'), Buffer.from('x'), 'application/pdf')

    expect(await storage.exists(key('bestaat.pdf'))).toBe(true)
    expect(await storage.exists(key('bestaat-niet.pdf'))).toBe(false)
  })

  it('geeft metadata terug, en null in plaats van een fout als er niets is', async () => {
    await storage.put(key('meta.pdf'), Buffer.from('twaalf bytes'), 'application/pdf')

    const metadata = await storage.getMetadata(key('meta.pdf'))
    expect(metadata?.size).toBe(12)
    expect(metadata?.lastModified).toBeInstanceOf(Date)

    // Niet bestaan is een antwoord: de opruimtaak leunt erop om te bepalen of
    // een PENDING-rij een bestand heeft.
    expect(await storage.getMetadata(key('niets.pdf'))).toBeNull()
  })

  it('gooit een StorageError bij het lezen van een bestand dat er niet is', async () => {
    await expect(storage.get(key('verdwenen.pdf'))).rejects.toBeInstanceOf(StorageError)
  })

  it('lekt het absolute pad niet in de foutmelding', async () => {
    // De onderliggende ENOENT bevat het volledige pad. Dat verraadt de
    // mapstructuur van de server aan wie de fout te zien krijgt.
    await expect(storage.get(key('verdwenen.pdf'))).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(baseDir) }),
    )
  })

  it('wist een bestand echt van de schijf', async () => {
    await storage.put(key('weg.pdf'), Buffer.from('x'), 'application/pdf')
    const onDisk = path.join(baseDir, 'documents', 'user-1', 'income', 'weg.pdf')
    expect(existsSync(onDisk)).toBe(true)

    await storage.delete(key('weg.pdf'))

    expect(existsSync(onDisk)).toBe(false)
    expect(await storage.exists(key('weg.pdf'))).toBe(false)
  })

  it('laat een tweede delete gewoon slagen', async () => {
    // De opruimtaak kan dezelfde sleutel twee keer tegenkomen, en twee runs
    // kunnen elkaar overlappen. Een fout op "al weg" zou die taak onterecht
    // laten mislukken.
    await storage.put(key('dubbel.pdf'), Buffer.from('x'), 'application/pdf')

    await expect(storage.delete(key('dubbel.pdf'))).resolves.toBeUndefined()
    await expect(storage.delete(key('dubbel.pdf'))).resolves.toBeUndefined()
    await expect(storage.delete(key('nooit-bestaan.pdf'))).resolves.toBeUndefined()
  })

  it('weigert een sleutel die uit de basismap ontsnapt', async () => {
    // Zonder deze controle is een documentdownload een willekeurige-bestandslezer.
    const buiten = path.join(baseDir, '..', 'geheim.txt')
    await writeFile(buiten, 'dit mag niet gelezen worden')

    try {
      for (const escape of [
        '../geheim.txt',
        'documents/../../geheim.txt',
        './documents/user-1/../../../geheim.txt',
      ]) {
        await expect(storage.get(escape)).rejects.toBeInstanceOf(StorageError)
        await expect(storage.put(escape, Buffer.from('x'), 'text/plain')).rejects.toBeInstanceOf(
          StorageError,
        )
      }

      // En het bestand buiten de map is ongemoeid gebleven.
      expect((await readFile(buiten)).toString()).toBe('dit mag niet gelezen worden')
    } finally {
      await rm(buiten, { force: true })
    }
  })

  it('weigert een absoluut pad als sleutel', async () => {
    const absolute = path.join(baseDir, '..', 'ook-geheim.txt')
    await expect(storage.get(absolute)).rejects.toBeInstanceOf(StorageError)
  })

  it('geeft een gesigneerde URL die zichzelf laat verifiëren', async () => {
    const url = new URL(await storage.signedUrl(key('sign.pdf'), 300))

    const signedKey = url.searchParams.get('key')!
    const expires = Number(url.searchParams.get('expires'))
    const signature = url.searchParams.get('signature')!

    expect(storage.verifySignature(signedKey, expires, signature)).toBe(true)
    expect(storage.verifySignature(signedKey, expires, 'a'.repeat(signature.length))).toBe(false)
    expect(storage.verifySignature('andere/sleutel', expires, signature)).toBe(false)
    expect(storage.verifySignature(signedKey, expires + 1, signature)).toBe(false)
  })

  it('weigert een handtekening die verlopen is', async () => {
    const url = new URL(await storage.signedUrl(key('oud.pdf'), 30))
    const signedKey = url.searchParams.get('key')!
    const signature = url.searchParams.get('signature')!
    const verlopen = Math.floor(Date.now() / 1000) - 1

    expect(storage.verifySignature(signedKey, verlopen, signature)).toBe(false)
  })

  it('overleeft een grote payload zonder de bytes te verminken', async () => {
    // 5 MB, net onder de uploadlimiet. Kleine buffers verbergen fouten in
    // stream- of encodingafhandeling.
    const groot = Buffer.alloc(5 * 1024 * 1024)
    for (let i = 0; i < groot.length; i += 1) groot[i] = i % 251

    await storage.put(key('groot.pdf'), groot, 'application/pdf')
    const terug = await storage.get(key('groot.pdf'))

    expect(terug.byteLength).toBe(groot.byteLength)
    expect(terug.equals(groot)).toBe(true)
  })
})
