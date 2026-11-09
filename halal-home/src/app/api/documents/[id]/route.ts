import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { requireDocument, updateMetadata } from '@/modules/documents/repository'
import { deleteDocument } from '@/modules/documents/service'
import { recordAudit } from '@/modules/audit/service'
import { withErrorHandling } from '@/server/api/handler'

type Context = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  const document = await requireDocument(userId, id)

  await recordAudit({
    userId,
    action: 'DOCUMENT_VIEWED',
    entityType: 'Document',
    entityId: document.id,
    metadata: { category: document.category, result: 'success' },
  })

  // `storageKey` blijft binnen de applicatie.
  return NextResponse.json({
    document: {
      id: document.id,
      category: document.category,
      displayName: document.displayName ?? document.originalFilename,
      originalFilename: document.originalFilename,
      description: document.description,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      failureReason: document.failureReason,
      checksum: document.checksum,
      uploadedAt: document.uploadedAt,
      expiresAt: document.expiresAt,
      deletedAt: document.deletedAt,
      isDemo: document.isDemo,
      property: document.property,
      financingQuote: document.financingQuote,
    },
  })
})

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullish(),
  expiresAt: z.coerce.date().nullish(),
})

export const PATCH = withErrorHandling(async (request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  await updateMetadata(userId, id, patchSchema.parse(await request.json()))
  return NextResponse.json({ ok: true })
})

export const DELETE = withErrorHandling(async (_request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  await deleteDocument(userId, id)
  return new NextResponse(null, { status: 204 })
})
