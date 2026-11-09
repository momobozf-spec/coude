'use client'

import { useRef, useState, useTransition } from 'react'
import { AlertCircle, Check, Info, Upload } from 'lucide-react'
import { DocumentCategory } from '@prisma/client'

import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { uploadDocumentAction, type UploadActionData } from '@/modules/documents/actions'
import {
  DOCUMENT_CATEGORY_HINTS,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_ORDER,
  formatBytes,
} from '@/modules/documents/domain/labels'
import { cn } from '@/lib/utils'

/**
 * Uploaden, met slepen of met de bestandskiezer.
 *
 * ─── DUBBELE VERZENDING ──────────────────────────────────────────────────────
 *
 * De knop blokkeert tijdens het verzenden, maar dat is niet genoeg: een
 * dubbelklik op een trage verbinding komt er soms toch doorheen, en een
 * browser die na een time-out opnieuw verstuurt komt er sowieso doorheen.
 *
 * Daarom krijgt elke bestandskeuze een `idempotencyKey`. Die gaat mee met elke
 * poging voor dát bestand en verdwijnt pas als de upload gelukt is. Twee
 * verzoeken met dezelfde sleutel leveren één document op; de server geeft bij
 * de tweede `replayed: true` terug.
 *
 * Mislukt een poging, dan blijft de sleutel staan. Opnieuw proberen is immers
 * dezelfde handeling — en als de eerste poging serverkant tóch half slaagde,
 * maakt de server die rij af in plaats van er een tweede naast te zetten.
 *
 * De checksum blijft daarnaast bestaan, maar met een ander doel: die meldt dat
 * er al een document met dezelfde inhoud is. Dat is informatie voor de
 * gebruiker, geen blokkade — twee loonfiches met identieke inhoud mogen
 * allebei bestaan.
 */
const MAX_MB = 10
const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.heic,.webp'

export function DocumentUpload({ defaultCategory }: { defaultCategory: DocumentCategory }) {
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // In een ref en niet in state: de sleutel hoort niet bij wat er getekend
  // wordt, en een render mag hem niet opnieuw aanmaken.
  const idempotencyKey = useRef<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadActionData | null>(null)
  const [pending, startTransition] = useTransition()

  function reset() {
    setFile(null)
    setError(null)
    // Pas hier weggooien, niet bij een mislukking: een volgende upload is een
    // nieuwe handeling en hoort dus een nieuwe sleutel te krijgen.
    idempotencyKey.current = null
    formRef.current?.reset()
    if (inputRef.current) inputRef.current.value = ''
  }

  function submit(formData: FormData) {
    if (!file) {
      setError('Kies eerst een bestand.')
      return
    }

    setError(null)
    setResult(null)
    formData.set('file', file)
    idempotencyKey.current ??= crypto.randomUUID()
    formData.set('idempotencyKey', idempotencyKey.current)

    startTransition(async () => {
      const response = await uploadDocumentAction(formData)

      if (!response.ok || !response.data) {
        // De sleutel blijft staan, zodat opnieuw proberen dezelfde handeling
        // blijft en er geen tweede document uit kan komen.
        setError(response.error ?? 'De upload lukte niet.')
        return
      }

      setResult(response.data)
      reset()
    })
  }

  function pick(selected: File | undefined) {
    if (!selected) return

    if (selected.size > MAX_MB * 1024 * 1024) {
      setError(`Het bestand is groter dan ${MAX_MB} MB.`)
      return
    }
    setError(null)
    setFile(selected)
    // Ander bestand kiezen is een andere handeling.
    idempotencyKey.current = crypto.randomUUID()
  }

  return (
    <Card>
      <CardHeader
        title="Document toevoegen"
        description={`PDF, JPG, PNG, HEIC of WEBP, tot ${MAX_MB} MB.`}
      />

      <form ref={formRef} action={submit} className="space-y-4">
        {/* Slepen is een extraatje; de knop eronder werkt altijd, ook met
            toetsenbord. */}
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            pick(event.dataTransfer.files[0])
          }}
          className={cn(
            'rounded-xl border-2 border-dashed p-6 text-center transition-colors',
            dragging ? 'border-[var(--accent)] bg-[var(--color-olive-50)]' : 'border-[var(--color-sand-300)]',
          )}
        >
          <Upload size={22} className="mx-auto text-[var(--muted)]" aria-hidden />

          {file ? (
            <p className="mt-2 text-sm">
              <span className="font-medium">{file.name}</span>
              <span className="block text-xs text-[var(--muted)]">{formatBytes(file.size)}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Sleep een bestand hierheen, of kies er een.
            </p>
          )}

          <label
            htmlFor="file"
            className="mt-3 inline-flex min-h-9 cursor-pointer items-center rounded-xl border bg-[var(--surface)] px-3 text-sm font-medium hover:bg-[var(--color-sand-100)]"
          >
            {file ? 'Ander bestand kiezen' : 'Bestand kiezen'}
          </label>
          <input
            ref={inputRef}
            id="file"
            name="file"
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </div>

        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm font-medium">
            Categorie
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as DocumentCategory)}
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          >
            {DOCUMENT_CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {DOCUMENT_CATEGORY_HINTS[category]}
          </p>
        </div>

        <div>
          <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">
            Naam <span className="font-normal text-[var(--muted)]">(optioneel)</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            maxLength={200}
            placeholder="Bijvoorbeeld: loonfiche januari"
            className="min-h-11 w-full rounded-xl border bg-[var(--background)] px-3 text-base"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="flex gap-2 rounded-xl bg-[var(--color-rust-soft)]/30 px-3 py-2.5 text-sm text-[var(--color-rust-deep)]"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {error}
              {file && (
                <button
                  type="submit"
                  className="mt-1 block font-medium underline underline-offset-4"
                >
                  Opnieuw proberen
                </button>
              )}
            </span>
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending || !file} className="w-full sm:w-auto">
          {pending ? 'Bezig met uploaden…' : 'Uploaden'}
        </Button>

        {/* Live region: een schermlezer hoort de voortgang zonder dat de focus
            verspringt. */}
        <p aria-live="polite" className="sr-only">
          {pending ? 'Bezig met uploaden' : result ? 'Upload gelukt' : ''}
        </p>
      </form>

      {result && (
        <div className="mt-4 rounded-xl bg-[var(--color-olive-50)] px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-olive-700)]">
            <Check size={15} aria-hidden />
            Document opgeslagen
          </p>

          {result.replayed && (
            <p className="mt-1.5 flex gap-2 text-sm text-[var(--muted)]">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              Deze upload was al verwerkt. Er is één document opgeslagen, geen twee.
            </p>
          )}

          {result.duplicateOf && (
            <p className="mt-1.5 flex gap-2 text-sm text-[var(--muted)]">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              Je had dit bestand al geüpload als “{result.duplicateOf.name}”. Beide staan nu in je
              kluis.
            </p>
          )}

          {result.checklist?.autoCompleted && (
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Het bijbehorende checklist-item is afgevinkt.
            </p>
          )}
          {result.checklist?.linked && !result.checklist.autoCompleted && (
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Gekoppeld aan je checklist. {result.checklist.reason}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
