import type { NextRequest } from 'next/server'

import { requireActor } from '@/server/auth/actor'
import { created, handler, noContent, ok } from '@/server/http/respond'
import { RATE_LIMITS, enforce, rateLimitKey } from '@/server/http/rate-limit'
import {
  deleteDonationReceipt,
  getDonationReceipt,
  uploadDonationReceipt,
} from '@/server/modules/donations/receipt-service'
import { MAX_RECEIPT_BYTES } from '@/server/storage/types'
import {
  InvalidReceiptTypeError,
  ReceiptTooLargeError,
} from '@/server/modules/donations/errors'

type Context = { params: Promise<{ id: string }> }

/** Returns metadata plus a freshly signed, short-lived download link. */
export const GET = handler(async (_request: NextRequest, context: Context) => {
  const actor = await requireActor()
  const { id } = await context.params
  return ok({ receipt: await getDonationReceipt(actor, id) })
})

export const POST = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('receipts', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params

  // Reject on the declared length before reading the body into memory, so an
  // oversized upload cannot be used to exhaust the process.
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_RECEIPT_BYTES * 1.1) {
    throw new ReceiptTooLargeError(MAX_RECEIPT_BYTES)
  }

  const form = await request.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    throw new InvalidReceiptTypeError('Er is geen bestand meegestuurd.')
  }

  const body = Buffer.from(await file.arrayBuffer())

  const receipt = await uploadDonationReceipt(actor, id, {
    fileName: file.name,
    // The browser's declared type; the service checks it against the allowlist
    // and against the file's actual magic bytes.
    mimeType: file.type,
    body,
  })

  return created(receipt)
})

export const DELETE = handler(async (request: NextRequest, context: Context) => {
  const actor = await requireActor()
  enforce(rateLimitKey('receipts', actor.userId, request), RATE_LIMITS.write)

  const { id } = await context.params
  await deleteDonationReceipt(actor, id)
  return noContent()
})

export const dynamic = 'force-dynamic'
