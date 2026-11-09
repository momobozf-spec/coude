import { NextResponse } from 'next/server'
import { DocumentCategory } from '@prisma/client'

import { requireUserId } from '@/modules/auth/session'
import { listDocuments } from '@/modules/documents/repository'
import { withErrorHandling } from '@/server/api/handler'

/**
 * /api/documents
 *
 * Geeft alleen metadata, nooit inhoud. Downloaden gaat via
 * /api/documents/[id]/download.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const category = params.get('category')

  const documents = await listDocuments(userId, {
    category:
      category && (Object.values(DocumentCategory) as string[]).includes(category)
        ? (category as DocumentCategory)
        : undefined,
    propertyId: params.get('propertyId') ?? undefined,
  })

  // Bewust een expliciete projectie: `storageKey` mag de applicatie nooit
  // verlaten. Wie hem heeft, kan hem in een gesigneerde URL proberen te
  // gebruiken, en dan hangt alles af van één handtekeningcontrole.
  return NextResponse.json({
    documents: documents.map((document) => ({
      id: document.id,
      category: document.category,
      displayName: document.displayName ?? document.originalFilename,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      checksum: document.checksum,
      uploadedAt: document.uploadedAt,
      expiresAt: document.expiresAt,
      isDemo: document.isDemo,
      property: document.property,
      financingQuote: document.financingQuote,
    })),
  })
})
