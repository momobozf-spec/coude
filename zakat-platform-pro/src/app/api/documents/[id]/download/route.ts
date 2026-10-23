import { NextResponse, type NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { handler } from '@/server/http/respond'
import { serverEnv } from '@/config/env'
import { ForbiddenError } from '@/lib/errors'
import { readReceiptBytes } from '@/server/modules/donations/receipt-service'
import { recordReportDownload } from '@/server/modules/reports/service'
import {
  InvalidDownloadTokenError,
  verifyDownloadToken,
} from '@/server/storage/signing'

type Context = { params: Promise<{ id: string }> }

/**
 * Stream a private receipt (§16).
 *
 * Three gates, all of which must pass:
 *
 *  1. A valid session — the file is never reachable anonymously.
 *  2. A signed token bound to this document *and* this user, still in date.
 *  3. A fresh ownership check in the database.
 *
 * The token alone is deliberately not sufficient. A signature that has leaked
 * into a browser history or a chat log should not be a key to somebody's
 * financial records, and access revoked in the database must take effect
 * immediately rather than when the token happens to expire.
 */
export const GET = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params

  const token = request.nextUrl.searchParams.get('token')
  if (!token) throw new ForbiddenError('Deze downloadlink is ongeldig.')

  let payload
  try {
    payload = verifyDownloadToken(token, serverEnv().AUTH_SECRET)
  } catch (error) {
    if (error instanceof InvalidDownloadTokenError) throw new ForbiddenError(error.message)
    throw error
  }

  if (payload.documentId !== id || payload.userId !== actor.userId) {
    throw new ForbiddenError('Deze downloadlink hoort niet bij dit document.')
  }

  // One path for every private document: receipts and generated reports both
  // resolve through the same ownership check.
  const { body, mimeType, fileName } = await readReceiptBytes(actor, id)

  // Records the download when this document is a generated report; a no-op
  // otherwise, so receipts are unaffected (§38).
  await recordReportDownload(actor, id)

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': mimeType,
      // `attachment` and a nosniff header keep the browser from rendering an
      // uploaded file inline in our own origin.
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, no-store',
    },
  })
})

export const dynamic = 'force-dynamic'
