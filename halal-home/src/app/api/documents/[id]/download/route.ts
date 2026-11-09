/**
 * Documentdownload.
 *
 * ─── AUTORISATIE, NIET ALLEEN EEN TOKEN ──────────────────────────────────────
 *
 * De sleutel komt uit de rij die op `userId` gevonden is. Er is geen pad waarin
 * een client een `storageKey` meegeeft — dat zou betekenen dat het bezit van
 * een sleutel gelijkstaat aan toegang, en dan is één gelekte URL genoeg.
 *
 * De response gaat nooit in een cache: `no-store` staat hier én in
 * next.config.ts, want een proxy die een loonfiche bewaart is een datalek dat
 * niemand ziet gebeuren.
 */
import { NextResponse } from 'next/server'

import { requireUserId } from '@/modules/auth/session'
import { downloadDocument } from '@/modules/documents/service'
import { withErrorHandling } from '@/server/api/handler'

type Context = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  const { data, mimeType, filename } = await downloadDocument(userId, id)

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': mimeType,
      // `attachment` en niet `inline`: een PDF of HTML-achtig bestand dat de
      // browser zelf rendert, draait in de context van ons domein.
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(data.byteLength),
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
})
