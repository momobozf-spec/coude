'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { DocumentStatus } from '@prisma/client'
import { Download, FileText, FlaskConical, Loader2, Trash2, TriangleAlert } from 'lucide-react'

import { deleteDocumentAction } from '@/modules/documents/actions'
import { STATUS_HINTS, STATUS_LABELS, isReadable } from '@/modules/documents/domain/lifecycle'
import { formatBytes } from '@/modules/documents/domain/labels'
import { cn, formatDate } from '@/lib/utils'

export interface DocumentRowData {
  id: string
  displayName: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  status: DocumentStatus
  uploadedAt: string
  expiresAt: string | null
  isDemo: boolean
  propertyTitle: string | null
  quoteName: string | null
}

/** De statuskleur is nooit het enige signaal: er staat altijd een woord bij. */
const STATUS_TONES: Record<DocumentStatus, string> = {
  PENDING: 'text-[var(--color-amber-deep)]',
  AVAILABLE: 'text-[var(--muted)]',
  FAILED: 'text-[var(--color-rust-deep)]',
  EXPIRED: 'text-[var(--color-amber-deep)]',
  DELETED: 'text-[var(--muted)]',
}

export function DocumentRow({ document }: { document: DocumentRowData }) {
  const [removed, setRemoved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (removed) return null

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deleteDocumentAction({ documentId: document.id })
      if (result.ok) setRemoved(true)
      else setError(result.error ?? 'Verwijderen lukte niet.')
    })
  }

  const readable = isReadable(document.status)

  return (
    <li className="rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[var(--muted)]" aria-hidden>
          {document.status === DocumentStatus.PENDING ? (
            <Loader2 size={18} className="animate-spin" />
          ) : document.status === DocumentStatus.FAILED ? (
            <TriangleAlert size={18} />
          ) : (
            <FileText size={18} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href={`/documents/${document.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {document.displayName}
            </Link>

            {document.isDemo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-amber-soft)]/40 px-2 py-0.5 text-[11px] text-[var(--color-amber-deep)]">
                <FlaskConical size={10} aria-hidden />
                Voorbeeld
              </span>
            )}
          </div>

          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {formatBytes(document.sizeBytes)} · {formatDate(document.uploadedAt)}
            {document.expiresAt && ` · geldig tot ${formatDate(document.expiresAt)}`}
          </p>

          {/* De status staat er als woord, niet alleen als kleur of icoon. */}
          {document.status !== DocumentStatus.AVAILABLE && (
            <p className={cn('mt-1 text-xs', STATUS_TONES[document.status])}>
              <span className="font-medium">{STATUS_LABELS[document.status]}.</span>{' '}
              {STATUS_HINTS[document.status]}
            </p>
          )}

          {(document.propertyTitle || document.quoteName) && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Hoort bij {document.propertyTitle ?? document.quoteName}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-1.5 text-xs text-[var(--color-rust-deep)]">
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {readable && (
              <a
                href={`/api/documents/${document.id}/download`}
                className="inline-flex items-center gap-1 text-sm text-[var(--accent)] underline-offset-4 hover:underline"
              >
                <Download size={13} aria-hidden />
                Downloaden
                <span className="sr-only">: {document.displayName}</span>
              </a>
            )}

            {confirming ? (
              <span className="inline-flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[var(--muted)]">
                  Het bestand wordt echt gewist. Zeker weten?
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={remove}
                  className="font-medium text-[var(--color-rust-deep)] underline underline-offset-4"
                >
                  Verwijderen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-[var(--muted)] underline underline-offset-4"
                >
                  Annuleren
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1 text-sm text-[var(--muted)] underline-offset-4 hover:underline"
              >
                <Trash2 size={13} aria-hidden />
                Verwijderen
                <span className="sr-only">: {document.displayName}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
