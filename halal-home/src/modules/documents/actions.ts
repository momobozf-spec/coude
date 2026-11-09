'use server'

/**
 * Server actions voor de documentkluis.
 *
 * Keten: UI → action → service → repository/storage. Geen enkele action raakt
 * Prisma of de opslag rechtstreeks aan.
 *
 * De upload loopt via een `FormData` met het bestand erin. Dat is bewust: zo
 * gaat het bestand nooit als base64 door JSON, blijft het uit de logs, en kan
 * Next het als stream verwerken.
 */
import { revalidatePath } from 'next/cache'
import { DocumentCategory } from '@prisma/client'
import { z } from 'zod'

import { requireUserId } from '@/modules/auth/session'
import { isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { env } from '@/config/env'
import { findActiveJourney } from '@/modules/journey/repository'
import { syncChecklistAfterUpload } from './checklistBridge'
import { documentErrors } from './domain/errors'
import * as service from './service'

export interface ActionResult<T = undefined> {
  ok: boolean
  error?: string
  code?: string
  data?: T
}

function toResult<T>(error: unknown): ActionResult<T> {
  if (isAppError(error)) return { ok: false, error: error.message, code: error.code }

  // De fout zelf gaat de log in, maar nooit naar de browser: een storage- of
  // Prisma-fout bevat paden en tabelnamen.
  logger.error('Onverwachte fout in een document-action', {
    error: error instanceof Error ? error.message : String(error),
  })
  return { ok: false, error: 'Er ging iets mis. Probeer het opnieuw.', code: 'INTERNAL_ERROR' }
}

const uploadMetaSchema = z.object({
  category: z.enum(DocumentCategory),
  displayName: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  propertyId: z.string().min(1).optional(),
  financingQuoteId: z.string().min(1).optional(),
  checklistItemKey: z.string().min(1).max(120).optional(),
  // Vorm afgedwongen, niet de herkomst: de sleutel komt van de client en is
  // dus onbetrouwbare invoer. Beperkt tot een veilige tekenset en een vaste
  // maximumlengte, zodat hij geen onbegrensde tekst de kolom in draagt.
  // Botsen kan hij niet buiten de eigen gebruiker: de unique index staat op
  // `(userId, idempotencyKey)`.
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
})

export interface UploadActionData {
  documentId: string
  duplicateOf: { id: string; name: string } | null
  /** Zie `UploadResult.replayed`: dit verzoek maakte geen nieuw document aan. */
  replayed: boolean
  checklist: { linked: boolean; autoCompleted: boolean; reason: string | null } | null
}

/**
 * Uploadt een document.
 *
 * Stuurt de client een `idempotencyKey` mee, dan levert een tweede POST met
 * diezelfde sleutel geen tweede document op maar het bestaande, met
 * `replayed: true`. Zonder sleutel vervalt die bescherming; de upload wordt dan
 * gewoon uitgevoerd.
 *
 * De checksum blijft daarnaast bestaan, maar blokkeert niets: hij meldt
 * alleen dat er al een document met dezelfde inhoud is. Twee bewuste uploads
 * van hetzelfde bestand horen allebei te bestaan.
 */
export async function uploadDocumentAction(
  formData: FormData,
): Promise<ActionResult<UploadActionData>> {
  try {
    const userId = await requireUserId()

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return { ok: false, error: 'Kies een bestand.', code: 'UPLOAD_INVALID' }
    }
    if (file.size === 0) throw documentErrors.empty()
    if (file.size > env.STORAGE_MAX_UPLOAD_BYTES) {
      throw documentErrors.tooLarge(env.STORAGE_MAX_UPLOAD_BYTES)
    }

    const meta = uploadMetaSchema.parse({
      category: formData.get('category') ?? undefined,
      displayName: optionalText(formData, 'displayName'),
      description: optionalText(formData, 'description'),
      propertyId: optionalText(formData, 'propertyId'),
      financingQuoteId: optionalText(formData, 'financingQuoteId'),
      checklistItemKey: optionalText(formData, 'checklistItemKey'),
      idempotencyKey: optionalText(formData, 'idempotencyKey'),
    })

    const journey = await findActiveJourney(userId)

    const result = await service.uploadDocument(userId, {
      ...meta,
      originalFilename: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: Buffer.from(await file.arrayBuffer()),
      journeyId: journey?.id ?? null,
    })

    // De checklist bijwerken mag de upload nooit terugdraaien: het bestand is
    // opgeslagen, en dat is wat telt.
    let checklist: UploadActionData['checklist'] = null
    if (journey) {
      try {
        checklist = await syncChecklistAfterUpload(userId, journey.id, result.documentId)
      } catch (error) {
        logger.warn('Checklist bijwerken na upload mislukt', {
          error: error instanceof Error ? error.message : 'onbekend',
        })
      }
    }

    revalidatePath('/documents')
    revalidatePath('/checklists')
    revalidatePath('/dashboard')

    return { ok: true, data: { ...result, checklist } }
  } catch (error) {
    return toResult(error)
  }
}

function optionalText(form: FormData, key: string): string | undefined {
  const value = form.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

const idSchema = z.object({ documentId: z.string().min(1) })

export async function deleteDocumentAction(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { documentId } = idSchema.parse(input)

    await service.deleteDocument(userId, documentId)

    revalidatePath('/documents')
    revalidatePath('/checklists')
    revalidatePath('/dashboard')

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}

export async function requestExplanationAction(
  input: z.input<typeof idSchema>,
): Promise<
  ActionResult<{
    summary: string
    keyPoints: string[]
    attentionPoints: string[]
    questionsForProfessional: string[]
    disclaimer: string
    source: string
    createdAt: string
  }>
> {
  try {
    const userId = await requireUserId()
    const { documentId } = idSchema.parse(input)

    const explanation = await service.requestExplanation(userId, documentId)

    revalidatePath(`/documents/${documentId}`)

    return {
      ok: true,
      data: {
        summary: explanation.summary,
        keyPoints: explanation.keyPoints,
        attentionPoints: explanation.attentionPoints,
        questionsForProfessional: explanation.questionsForProfessional,
        disclaimer: explanation.disclaimer,
        source: explanation.source,
        createdAt: explanation.createdAt.toISOString(),
      },
    }
  } catch (error) {
    return toResult(error)
  }
}

const linkSchema = z.object({
  documentId: z.string().min(1),
  propertyId: z.string().min(1).nullish(),
  financingQuoteId: z.string().min(1).nullish(),
  checklistItemKey: z.string().min(1).max(120).nullish(),
})

export async function linkDocumentAction(
  input: z.input<typeof linkSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId()
    const { documentId, ...links } = linkSchema.parse(input)

    await service.linkDocument(userId, documentId, links)

    revalidatePath('/documents')
    revalidatePath(`/documents/${documentId}`)

    return { ok: true }
  } catch (error) {
    return toResult(error)
  }
}
