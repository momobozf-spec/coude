/**
 * Download via een gesigneerde URL — uitsluitend voor de lokale opslagprovider.
 *
 * ─── TWEE SLOTEN, NIET ÉÉN ───────────────────────────────────────────────────
 *
 * Een gesigneerde URL bewijst dat wíj hem hebben uitgegeven en dat hij nog niet
 * verlopen is. Meer niet. Wie hem doorstuurt, doorstuurt ook de toegang.
 *
 * Daarom controleert deze route allebei:
 *
 *   1. de handtekening en de vervaltijd (is deze URL door ons gemaakt?);
 *   2. de sessie én of de sleutel bij díe gebruiker hoort (mag jíj hierbij?).
 *
 * Het tweede slot is het echte. Zonder die controle zou een gedeelde link
 * betekenen dat iedereen met de URL iemands loonfiche kan openen — precies wat
 * "geen voorspelbare directe download-URL's" moet voorkomen.
 *
 * Bij een S3-achtige provider geeft `signedUrl()` een presigned URL van de
 * provider zelf terug en komt deze route niet in beeld. Dat is dan wél een
 * URL-is-toegang-situatie, en juist daarom moet de TTL kort blijven
 * (`STORAGE_SIGNED_URL_TTL_SECONDS`).
 */
import { NextResponse } from 'next/server'

import { requireUserId } from '@/modules/auth/session'
import { documentErrors } from '@/modules/documents/domain/errors'
import { getStorageProvider, LocalStorageProvider } from '@/server/storage'
import { keyBelongsToUser } from '@/server/storage/policy'
import { prisma } from '@/server/db/prisma'
import { recordAudit } from '@/modules/audit/service'
import { withErrorHandling } from '@/server/api/handler'
import { isReadable } from '@/modules/documents/domain/lifecycle'
import { sanitizeFileName } from '@/server/storage/policy'

export const GET = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const key = params.get('key')
  const expires = Number(params.get('expires'))
  const signature = params.get('signature')

  if (!key || !signature || !Number.isFinite(expires)) {
    throw documentErrors.downloadTokenInvalid()
  }

  const provider = getStorageProvider()
  if (!(provider instanceof LocalStorageProvider)) {
    // Deze route hoort alleen bij de lokale provider. Bij een andere provider
    // is hij niet in gebruik en mag hij niets doen.
    throw documentErrors.downloadTokenInvalid()
  }

  // Slot 1: hebben wij deze URL uitgegeven, en is hij nog geldig?
  if (!provider.verifySignature(key, expires, signature)) {
    throw documentErrors.downloadTokenInvalid()
  }

  // Slot 2: hoort deze sleutel bij déze gebruiker? Een geldige handtekening van
  // iemand anders' document geeft geen toegang.
  if (!keyBelongsToUser(key, userId)) throw documentErrors.notFound()

  const document = await prisma.document.findFirst({
    where: { storageKey: key, userId },
    select: {
      id: true,
      mimeType: true,
      status: true,
      displayName: true,
      originalFilename: true,
      category: true,
    },
  })
  if (!document) throw documentErrors.notFound()
  if (!isReadable(document.status)) {
    throw documentErrors.notReadable('Dit document is niet beschikbaar.')
  }

  const data = await provider.get(key)

  await recordAudit({
    userId,
    action: 'DOCUMENT_DOWNLOADED',
    entityType: 'Document',
    entityId: document.id,
    metadata: { category: document.category, source: 'signed_url', result: 'success' },
  })

  const filename = sanitizeFileName(document.displayName ?? document.originalFilename)

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(data.byteLength),
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
})
