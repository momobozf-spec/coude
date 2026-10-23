'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Trash2, Upload } from 'lucide-react'

import { Button, FieldError } from '@/components/ui'
import { donationApi, DonationApiError } from '@/modules/donations/api'
import type { ReceiptView } from '@/server/modules/donations/receipt-service'

/**
 * Receipt upload and download (§14–§18).
 *
 * The download link is minted server-side, is signed, expires, and still passes
 * an ownership check on use. There is no path here that produces a public URL.
 */

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

export function ReceiptPanel({
  donationId,
  receipt,
  editable,
}: {
  donationId: string
  receipt: ReceiptView | null
  editable: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    setError(null)
    setBusy(true)

    try {
      await donationApi.uploadReceipt(donationId, file)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof DonationApiError ? caught.message : 'Uploaden lukte niet.',
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)

    try {
      await donationApi.deleteReceipt(donationId)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof DonationApiError ? caught.message : 'Verwijderen lukte niet.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (receipt) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{receipt.fileName}</p>
              <p className="text-xs text-muted">
                {Math.max(1, Math.round(receipt.sizeBytes / 1024))} kB
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={receipt.downloadUrl}
              className="text-sm font-medium text-primary hover:underline"
            >
              Openen
            </a>
            {editable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Bewijsstuk verwijderen"
                disabled={busy}
                onClick={remove}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>

        <p className="text-xs text-muted">
          Deze link is persoonlijk en verloopt na tien minuten. Bewijsstukken zijn nooit
          publiek toegankelijk.
        </p>

        <FieldError>{error}</FieldError>
      </div>
    )
  }

  if (!editable) {
    return <p className="text-sm text-muted">Geen bewijsstuk gekoppeld.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" aria-hidden />
        {busy ? 'Bezig…' : 'Bewijsstuk uploaden'}
      </Button>

      <p className="text-xs text-muted">PDF, JPG, PNG of WEBP. Maximaal 8 MB.</p>

      <FieldError>{error}</FieldError>
    </div>
  )
}
