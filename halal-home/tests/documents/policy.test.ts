import { describe, expect, it } from 'vitest'
import { DocumentCategory } from '@prisma/client'

import {
  ALLOWED_MIME_TYPES,
  buildStorageKey,
  hasValidMagicBytes,
  keyBelongsToUser,
  sanitizeFileName,
  validateUpload,
} from '@/server/storage/policy'

const MAX = 10 * 1024 * 1024

const pdf = () => Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])

describe('toegestane bestandstypen', () => {
  it('werkt met een witte lijst', () => {
    // Een zwarte lijst mist altijd iets.
    expect(Object.keys(ALLOWED_MIME_TYPES)).toEqual(
      expect.arrayContaining(['application/pdf', 'image/jpeg', 'image/png']),
    )
  })

  it('weigert SVG', () => {
    // SVG is XML met scriptmogelijkheden: een XSS-vector zodra een browser het
    // rendert.
    expect(ALLOWED_MIME_TYPES['image/svg+xml']).toBeUndefined()
    expect(validateUpload({ mimeType: 'image/svg+xml', size: 100, maxBytes: MAX }).valid).toBe(
      false,
    )
  })

  it('weigert archieven en uitvoerbare bestanden', () => {
    for (const mimeType of ['application/zip', 'application/x-msdownload', 'text/html']) {
      expect(validateUpload({ mimeType, size: 100, maxBytes: MAX }).valid).toBe(false)
    }
  })
})

describe('uploadvalidatie', () => {
  it('laat een geldige PDF door', () => {
    const result = validateUpload({
      mimeType: 'application/pdf',
      size: 1024,
      maxBytes: MAX,
      buffer: pdf(),
    })
    expect(result.valid).toBe(true)
  })

  it('weigert een leeg bestand', () => {
    expect(validateUpload({ mimeType: 'application/pdf', size: 0, maxBytes: MAX }).valid).toBe(
      false,
    )
  })

  it('weigert een bestand boven de limiet', () => {
    const result = validateUpload({
      mimeType: 'application/pdf',
      size: MAX + 1,
      maxBytes: MAX,
    })
    expect(result.valid).toBe(false)
    expect(result.problems.join(' ')).toContain('MB')
  })

  it('weigert inhoud die niet bij het opgegeven type past', () => {
    // De Content-Type van een upload is een bewering van de client, geen feit.
    // Zonder deze controle komt een .html met "content-type: application/pdf"
    // er gewoon door.
    const html = Buffer.from('<html><script>alert(1)</script></html>')
    const result = validateUpload({
      mimeType: 'application/pdf',
      size: html.byteLength,
      maxBytes: MAX,
      buffer: html,
    })

    expect(result.valid).toBe(false)
    expect(result.problems.join(' ')).toContain('komt niet overeen')
  })
})

describe('herkenning aan de eerste bytes', () => {
  it('herkent PDF, PNG en JPEG', () => {
    expect(hasValidMagicBytes('application/pdf', pdf())).toBe(true)
    expect(hasValidMagicBytes('image/png', png())).toBe(true)
    expect(hasValidMagicBytes('image/jpeg', jpeg())).toBe(true)
  })

  it('herkent een verwisseld type niet', () => {
    expect(hasValidMagicBytes('application/pdf', png())).toBe(false)
    expect(hasValidMagicBytes('image/png', pdf())).toBe(false)
  })

  it('herkent WEBP aan de RIFF-container', () => {
    const webp = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
    ])
    expect(hasValidMagicBytes('image/webp', webp)).toBe(true)
  })

  it('herkent HEIC aan het ftyp-merk', () => {
    const heic = Buffer.concat([
      Buffer.from([0, 0, 0, 0x20]),
      Buffer.from('ftypheic', 'ascii'),
      Buffer.from([0, 0, 0, 0]),
    ])
    expect(hasValidMagicBytes('image/heic', heic)).toBe(true)
  })

  it('valt niet om op een te kort bestand', () => {
    expect(hasValidMagicBytes('application/pdf', Buffer.from([0x25]))).toBe(false)
    expect(hasValidMagicBytes('image/webp', Buffer.alloc(0))).toBe(false)
  })
})

describe('opslagsleutel', () => {
  const key = () =>
    buildStorageKey({
      userId: 'user_abc123',
      category: DocumentCategory.INCOME,
      mimeType: 'application/pdf',
    })

  it('bevat het gebruikers-id en de categorie', () => {
    expect(key()).toMatch(/^documents\/user_abc123\/income\//)
  })

  it('krijgt de juiste extensie', () => {
    expect(key().endsWith('.pdf')).toBe(true)
  })

  it('is elke keer anders', () => {
    // Een raadbare sleutel is een gelekte sleutel.
    expect(key()).not.toBe(key())
  })

  it('bevat nooit de bestandsnaam van de gebruiker', () => {
    // "loonfiche-mohamed-januari.pdf" in een sleutel lekt inhoud via logs,
    // foutmeldingen en URL's.
    const generated = key()
    expect(generated).not.toContain('loonfiche')
    // Alleen pad, uuid en extensie: geen andere tekens.
    expect(generated).toMatch(/^documents\/[\w-]+\/[a-z_]+\/[0-9a-f-]{36}\.pdf$/)
  })
})

describe('eigendom van een sleutel', () => {
  it('herkent de eigen sleutel', () => {
    expect(keyBelongsToUser('documents/user_a/income/abc.pdf', 'user_a')).toBe(true)
  })

  it('weigert de sleutel van iemand anders', () => {
    expect(keyBelongsToUser('documents/user_b/income/abc.pdf', 'user_a')).toBe(false)
  })

  it('trapt niet in een gebruikers-id dat als voorvoegsel begint', () => {
    // 'user_a' mag niet matchen op 'user_abc'.
    expect(keyBelongsToUser('documents/user_abc/income/x.pdf', 'user_a')).toBe(false)
  })
})

describe('bestandsnaam opschonen', () => {
  it('verwijdert padscheidingstekens', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toContain('/')
    expect(sanitizeFileName('map\\bestand.pdf')).not.toContain('\\')
  })

  it('verwijdert dubbele punten die path traversal mogelijk maken', () => {
    expect(sanitizeFileName('..%2f..%2fbestand.pdf')).not.toContain('..')
  })

  it('verwijdert aanhalingstekens en controletekens', () => {
    // Die breken een Content-Disposition-header en maken header-injectie mogelijk.
    const cleaned = sanitizeFileName('bestand".pdf\r\nX-Injected: 1')
    expect(cleaned).not.toContain('"')
    expect(cleaned).not.toContain('\r')
    expect(cleaned).not.toContain('\n')
  })

  it('kort een extreem lange naam in', () => {
    expect(sanitizeFileName('a'.repeat(500)).length).toBeLessThanOrEqual(200)
  })

  it('geeft een bruikbare naam terug wanneer er niets overblijft', () => {
    expect(sanitizeFileName('///')).toBeTruthy()
    expect(sanitizeFileName('')).toBe('document')
  })
})
