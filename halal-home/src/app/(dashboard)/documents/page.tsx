import type { Metadata } from 'next'
import Link from 'next/link'
import { DocumentCategory } from '@prisma/client'
import { FileText, Lock } from 'lucide-react'

import { Card, CardHeader, EmptyState } from '@/components/ui/Card'
import { DocumentUpload } from './DocumentUpload'
import { DocumentRow } from './DocumentRow'
import { requireUserId } from '@/modules/auth/session'
import { listDocuments } from '@/modules/documents/repository'
import { DOCUMENT_CATEGORY_LABELS } from '@/modules/documents/domain/labels'

export const metadata: Metadata = { title: 'Mijn documenten' }

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const userId = await requireUserId()
  const { category: rawCategory } = await searchParams

  const category =
    rawCategory && (Object.values(DocumentCategory) as string[]).includes(rawCategory)
      ? (rawCategory as DocumentCategory)
      : undefined

  const documents = await listDocuments(userId, { category })

  // Groeperen per categorie: een platte lijst van dertig bestanden is geen kluis
  // maar een downloadmap.
  const byCategory = new Map<DocumentCategory, typeof documents>()
  for (const document of documents) {
    const list = byCategory.get(document.category) ?? []
    list.push(document)
    byCategory.set(document.category, list)
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mijn documenten</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <Lock size={13} aria-hidden />
          Alleen jij kan bij deze bestanden. Ze staan in privéopslag en zijn niet via een
          publieke link te openen.
        </p>
      </header>

      <DocumentUpload defaultCategory={category ?? DocumentCategory.IDENTITY} />

      {category && (
        <p className="text-sm">
          Gefilterd op {DOCUMENT_CATEGORY_LABELS[category]}.{' '}
          <Link href="/documents" className="text-[var(--accent)] underline underline-offset-4">
            Toon alles
          </Link>
        </p>
      )}

      {documents.length === 0 ? (
        <Card>
          <EmptyState
            title={
              category
                ? `Nog geen documenten in ${DOCUMENT_CATEGORY_LABELS[category].toLowerCase()}`
                : 'Je kluis is nog leeg'
            }
            description="Upload de documenten die je financier en je notaris van je vragen. Je vindt ze hier terug wanneer je ze nodig hebt, en je checklist wordt automatisch bijgewerkt waar dat kan."
          />
        </Card>
      ) : (
        [...byCategory.entries()].map(([key, group]) => (
          <Card key={key}>
            <CardHeader
              title={DOCUMENT_CATEGORY_LABELS[key]}
              description={`${group.length} ${group.length === 1 ? 'document' : 'documenten'}`}
            />
            <ul className="space-y-2">
              {group.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={{
                    id: document.id,
                    displayName: document.displayName ?? document.originalFilename,
                    originalFilename: document.originalFilename,
                    mimeType: document.mimeType,
                    sizeBytes: document.sizeBytes,
                    status: document.status,
                    uploadedAt: document.uploadedAt.toISOString(),
                    expiresAt: document.expiresAt?.toISOString() ?? null,
                    isDemo: document.isDemo,
                    propertyTitle: document.property?.title ?? null,
                    quoteName: document.financingQuote?.productName ?? null,
                  }}
                />
              ))}
            </ul>
          </Card>
        ))
      )}

      <p className="flex gap-2 px-1 text-xs leading-relaxed text-[var(--muted)]">
        <FileText size={13} className="mt-0.5 shrink-0" aria-hidden />
        Verwijderen wist het bestand echt uit de opslag. De regel dat je het ooit uploadde blijft
        staan in je audittrail — dat is voor jouw eigen overzicht, en bevat nooit de inhoud.
      </p>
    </div>
  )
}
