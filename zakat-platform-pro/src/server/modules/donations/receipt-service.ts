import 'server-only'

import { randomUUID } from 'node:crypto'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { assertOwner } from '@/server/auth/scope'
import { recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { appBaseUrl, serverEnv } from '@/config/env'
import { NotFoundError } from '@/lib/errors'
import { getFileStorage } from '@/server/storage'
import {
  MAX_RECEIPT_BYTES,
  extensionForMimeType,
  type FileStorage,
} from '@/server/storage/types'
import {
  DOWNLOAD_TOKEN_TTL_SECONDS,
  createDownloadToken,
} from '@/server/storage/signing'
import {
  DonationNotFoundError,
  InvalidReceiptTypeError,
  ReceiptTooLargeError,
} from '@/server/modules/donations/errors'

/**
 * Donation receipts (§14–§18).
 *
 * Security posture, in order of what an attacker would try:
 *
 *  • The declared MIME type must be on the allowlist, and the stored extension
 *    is derived from *that*, never from the uploaded filename — `receipt.pdf.exe`
 *    cannot survive the round trip.
 *  • The storage key is a fresh UUID under the owner's id. The user's filename
 *    is kept only as a display label and never reaches the filesystem.
 *  • Size is checked against the actual buffer, not a client-supplied header.
 *  • Nothing is ever written under `public/`, so there is no path that serves a
 *    receipt without passing an ownership check.
 */

export interface ReceiptView {
  documentId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: Date
  /** Short-lived, signed, bound to this user and document. */
  downloadUrl: string
}

export interface UploadReceiptInput {
  fileName: string
  mimeType: string
  body: Buffer
}

/** Magic-number check for the formats we accept. */
function looksLikeDeclaredType(body: Buffer, mimeType: string): boolean {
  const head = body.subarray(0, 12)

  switch (mimeType.toLowerCase()) {
    case 'application/pdf':
      return head.subarray(0, 4).toString('latin1') === '%PDF'
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8
    case 'image/png':
      return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case 'image/webp':
      return (
        head.subarray(0, 4).toString('latin1') === 'RIFF' &&
        head.subarray(8, 12).toString('latin1') === 'WEBP'
      )
    default:
      return false
  }
}

export async function uploadDonationReceipt(
  actor: Actor,
  donationId: string,
  input: UploadReceiptInput,
  storage: FileStorage = getFileStorage(),
): Promise<ReceiptView> {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } })
  assertOwner(actor, donation)
  if (!donation) throw new DonationNotFoundError()

  const extension = extensionForMimeType(input.mimeType)
  if (!extension) throw new InvalidReceiptTypeError()

  if (input.body.byteLength === 0) {
    throw new InvalidReceiptTypeError('Het bestand is leeg.')
  }

  if (input.body.byteLength > MAX_RECEIPT_BYTES) {
    throw new ReceiptTooLargeError(MAX_RECEIPT_BYTES)
  }

  // A file whose contents do not match its declared type is either broken or an
  // attempt to smuggle something past the allowlist.
  if (!looksLikeDeclaredType(input.body, input.mimeType)) {
    throw new InvalidReceiptTypeError(
      'De inhoud van het bestand komt niet overeen met het opgegeven type.',
    )
  }

  // Generated key: the user's filename never touches the filesystem.
  const key = `receipts/${actor.userId}/${randomUUID()}.${extension}`
  const stored = await storage.put({ key, body: input.body, contentType: input.mimeType })

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        userId: actor.userId,
        householdId: donation.householdId,
        type: 'DONATION_RECEIPT',
        fileName: sanitiseDisplayName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: stored.sizeBytes,
        storageProvider: storage.backend === 's3' ? 'S3' : 'LOCAL',
        storageKey: stored.key,
        checksumSha256: stored.checksumSha256,
      },
    })

    // One primary receipt per donation, matching the schema's single FK (§18).
    await tx.donation.update({
      where: { id: donationId },
      data: { receiptDocumentId: created.id },
    })

    return created
  })

  await recordAudit({
    userId: actor.userId,
    action: 'RECEIPT_UPLOADED',
    entityType: 'Document',
    entityId: document.id,
    // No filename: a user's own label can be as sensitive as the amount (§28).
    metadata: { donationId, mimeType: document.mimeType },
  })

  trackEvent('RECEIPT_UPLOADED', actor.userId, { mimeType: document.mimeType })

  return toReceiptView(document, actor)
}

export async function getDonationReceipt(
  actor: Actor,
  donationId: string,
): Promise<ReceiptView | null> {
  const donation = await prisma.donation.findUnique({
    where: { id: donationId },
    select: { userId: true, householdId: true, receiptDocumentId: true },
  })

  assertOwner(actor, donation)
  if (!donation?.receiptDocumentId) return null

  const document = await prisma.document.findUnique({
    where: { id: donation.receiptDocumentId },
  })
  if (!document) return null

  return toReceiptView(document, actor)
}

export async function deleteDonationReceipt(
  actor: Actor,
  donationId: string,
  storage: FileStorage = getFileStorage(),
): Promise<void> {
  const donation = await prisma.donation.findUnique({ where: { id: donationId } })
  assertOwner(actor, donation)
  if (!donation?.receiptDocumentId) throw new NotFoundError('Er is geen bewijsstuk gekoppeld.')

  const document = await prisma.document.findUnique({
    where: { id: donation.receiptDocumentId },
  })
  if (!document || document.userId !== actor.userId) throw new NotFoundError()

  await prisma.$transaction(async (tx) => {
    await tx.donation.update({
      where: { id: donationId },
      data: { receiptDocumentId: null },
    })
    await tx.document.delete({ where: { id: document.id } })
  })

  // Storage is cleaned up after the database commits: an orphaned object is
  // harmless, a database row pointing at a deleted file is not.
  await storage.delete(document.storageKey)

  await recordAudit({
    userId: actor.userId,
    action: 'RECEIPT_DELETED',
    entityType: 'Document',
    entityId: document.id,
    metadata: { donationId },
  })
}

/**
 * Read a stored receipt after re-checking ownership.
 *
 * Called by the download route *in addition to* verifying the signed token —
 * a valid signature alone must never be sufficient to read financial data.
 */
export async function readReceiptBytes(
  actor: Actor,
  documentId: string,
  storage: FileStorage = getFileStorage(),
): Promise<{ body: Buffer; mimeType: string; fileName: string }> {
  const document = await prisma.document.findUnique({ where: { id: documentId } })

  // 404 rather than 403 — an existing-but-forbidden document is still a leak.
  if (!document || document.userId !== actor.userId) throw new NotFoundError()

  return {
    body: await storage.get(document.storageKey),
    mimeType: document.mimeType,
    fileName: document.fileName,
  }
}

function toReceiptView(
  document: { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: Date },
  actor: Actor,
): ReceiptView {
  const expiresAt = Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL_SECONDS

  const token = createDownloadToken(
    { documentId: document.id, userId: actor.userId, expiresAt },
    serverEnv().AUTH_SECRET,
  )

  return {
    documentId: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt,
    downloadUrl: `${appBaseUrl()}/api/documents/${document.id}/download?token=${encodeURIComponent(token)}`,
  }
}

/** Keep a readable label without letting path characters through. */
function sanitiseDisplayName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? 'bewijsstuk'
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'bewijsstuk'
}
