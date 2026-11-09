import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, FlaskConical, Shield } from 'lucide-react'

import { Card, CardHeader } from '@/components/ui/Card'
import { ExplanationPanel } from './ExplanationPanel'
import { requireUserId } from '@/modules/auth/session'
import { requireDocument, listExplanations } from '@/modules/documents/repository'
import { getExplanationView } from '@/modules/documents/service'
import { recordAudit } from '@/modules/audit/service'
import { describeDataSentToProvider } from '@/server/integrations/documentExplanation'
import {
  CHECKSUM_DISCLOSURE,
  EXPLANATION_OUTDATED_NOTICE,
  shortChecksum,
} from '@/modules/documents/domain/integrity'
import { isReadable, STATUS_HINTS, STATUS_LABELS } from '@/modules/documents/domain/lifecycle'
import { DOCUMENT_CATEGORY_LABELS, formatBytes } from '@/modules/documents/domain/labels'
import { isAppError } from '@/lib/errors'
import { formatDate } from '@/lib/utils'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  // Geen documentnaam in de paginatitel: die belandt in de browsergeschiedenis
  // en in gedeelde schermen.
  void id
  return { title: 'Document' }
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const userId = await requireUserId()
  const { id } = await params

  const document = await requireDocument(userId, id).catch((error) => {
    if (isAppError(error) && error.status === 404) notFound()
    throw error
  })

  const [explanationView, history] = await Promise.all([
    getExplanationView(userId, id),
    listExplanations(userId, id),
  ])

  await recordAudit({
    userId,
    action: 'DOCUMENT_VIEWED',
    entityType: 'Document',
    entityId: document.id,
    metadata: { category: document.category, result: 'success' },
  })

  return (
    <div className="space-y-5">
      <Link
        href="/documents"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden />
        Mijn documenten
      </Link>

      {document.isDemo && (
        <Card className="border-[var(--color-amber-deep)]/30 bg-[var(--color-amber-soft)]/15">
          <p className="flex gap-3 text-sm leading-relaxed text-[var(--muted)]">
            <FlaskConical
              size={17}
              className="mt-0.5 shrink-0 text-[var(--color-amber-deep)]"
              aria-hidden
            />
            <span>
              <span className="block font-medium text-[var(--color-amber-deep)]">
                Voorbeelddocument
              </span>
              Dit record komt uit de ontwikkeldata. Er hoort geen echt bestand bij, en het is geen
              echte akte of attest.
            </span>
          </p>
        </Card>
      )}

      <header>
        <p className="text-sm text-[var(--muted)]">
          {DOCUMENT_CATEGORY_LABELS[document.category]}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {document.displayName ?? document.originalFilename}
        </h1>
        {document.description && (
          <p className="mt-1.5 leading-relaxed text-[var(--muted)]">{document.description}</p>
        )}
      </header>

      {isReadable(document.status) ? (
        <a
          href={`/api/documents/${document.id}/download`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hover:opacity-90"
        >
          <Download size={16} aria-hidden />
          Document downloaden
        </a>
      ) : (
        <Card>
          <p className="font-medium">{STATUS_LABELS[document.status]}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {STATUS_HINTS[document.status]}
            {document.failureReason && ` (${document.failureReason})`}
          </p>
        </Card>
      )}

      {/* ── Metadata ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader title="Gegevens" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Spec label="Bestandsnaam" value={document.originalFilename} />
          <Spec label="Type" value={document.mimeType} />
          <Spec label="Grootte" value={formatBytes(document.sizeBytes)} />
          <Spec label="Geüpload" value={formatDate(document.uploadedAt)} />
          <Spec label="Status" value={STATUS_LABELS[document.status]} />
          <Spec
            label="Geldig tot"
            value={document.expiresAt ? formatDate(document.expiresAt) : 'Niet ingesteld'}
          />
        </dl>

        {(document.property || document.financingQuote) && (
          <div className="mt-4 border-t pt-3 text-sm">
            <p className="text-xs font-medium text-[var(--muted)]">Hoort bij</p>
            {document.property && (
              <Link
                href={`/properties/${document.property.id}`}
                className="mt-0.5 block text-[var(--accent)] underline underline-offset-4"
              >
                {document.property.title}
              </Link>
            )}
            {document.financingQuote && (
              <p className="mt-0.5">
                {document.financingQuote.productName} — {document.financingQuote.providerName}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Integriteit ─────────────────────────────────────────────────── */}
      {document.checksum && (
        <Card>
          <CardHeader title="Controlewaarde" />
          <p className="font-mono text-sm">{shortChecksum(document.checksum)}</p>
          <p className="mt-2 flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
            <Shield size={13} className="mt-0.5 shrink-0" aria-hidden />
            {CHECKSUM_DISCLOSURE}
          </p>
        </Card>
      )}

      {/* ── Uitleg ──────────────────────────────────────────────────────── */}
      <ExplanationPanel
        documentId={document.id}
        categoryLabel={DOCUMENT_CATEGORY_LABELS[document.category]}
        canExplain={isReadable(document.status)}
        dataSentToProvider={describeDataSentToProvider(false)}
        initial={
          explanationView
            ? {
                summary: explanationView.explanation.summary,
                keyPoints: explanationView.explanation.keyPoints,
                attentionPoints: explanationView.explanation.attentionPoints,
                questionsForProfessional: explanationView.explanation.questionsForProfessional,
                disclaimer: explanationView.explanation.disclaimer,
                source: explanationView.explanation.source,
                createdAt: explanationView.explanation.createdAt.toISOString(),
                outdated: explanationView.freshness === 'outdated',
                outdatedNotice: EXPLANATION_OUTDATED_NOTICE,
              }
            : null
        }
        previousCount={Math.max(0, history.length - 1)}
      />
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="truncate font-medium" title={value}>
        {value}
      </dd>
    </div>
  )
}
