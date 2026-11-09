/**
 * Documentlogica: de laag tussen route handlers en opslag/database.
 *
 * ─── DE VOLGORDE VAN EEN UPLOAD, EN WAAROM ───────────────────────────────────
 *
 *   1. valideren (type, grootte, magic bytes) — vóór er iets wordt geschreven;
 *   2. rij aanmaken met status PENDING;
 *   3. bestand naar de opslag;
 *   4. rij op AVAILABLE met grootte en checksum.
 *
 * Stap 2 vóór stap 3 is bewust. Andersom zou een geslaagde upload zonder rij
 * een weesbestand opleveren waarvan niemand weet dat het bestaat. Nu levert
 * elke storing een rij op die zichzelf verklaart — PENDING of FAILED — en die
 * de opruimtaak kan afhandelen.
 *
 * Zie `domain/lifecycle.ts` voor de vier storingsscenario's.
 */
import 'server-only'
import {
  AnalyticsEventType,
  DocumentCategory,
  DocumentStatus,
  type Prisma,
} from '@prisma/client'

import { prisma } from '@/server/db/prisma'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { recordAudit } from '@/modules/audit/service'
import { recordEvent } from '@/modules/analytics/service'
import { getStorageProvider } from '@/server/storage'
import {
  buildStorageKey,
  keyBelongsToUser,
  sanitizeFileName,
  validateUpload,
} from '@/server/storage/policy'
import { explainDocument } from '@/server/integrations/documentExplanation'
import { computeChecksum, explanationMatchesDocument } from './domain/integrity'
import { documentErrors } from './domain/errors'
import {
  isReadable,
  needsCleanup,
  reconcilePending,
  type CleanupReason,
} from './domain/lifecycle'
import * as repository from './repository'

export interface UploadInput {
  category: DocumentCategory
  originalFilename: string
  mimeType: string
  data: Buffer
  displayName?: string | null
  description?: string | null
  journeyId?: string | null
  propertyId?: string | null
  financingQuoteId?: string | null
  checklistItemKey?: string | null
  expiresAt?: Date | null
  /**
   * Identificeert één uploadhandeling. Zie `UploadResult.replayed` en de
   * toelichting bij `uploadDocument`.
   */
  idempotencyKey?: string | null
}

export interface UploadResult {
  documentId: string
  /**
   * Een eerder geüpload document met dezelfde inhoud, als dat er is.
   *
   * Uitsluitend informatief: de UI kan er "je hebt dit bestand al eens
   * geüpload" mee tonen. Het document is hoe dan ook aangemaakt. Een tweede
   * upload van dezelfde bytes tegenhouden zou fout zijn — twee maanden
   * loonfiche met dezelfde inhoud is een reëel geval, en de gebruiker zou dan
   * zonder uitleg een document missen.
   */
  duplicateOf: { id: string; name: string } | null
  /**
   * `true` wanneer dit verzoek een eerdere upload met dezelfde
   * `idempotencyKey` herhaalde. Er is dan géén nieuw document aangemaakt;
   * `documentId` verwijst naar het bestaande.
   */
  replayed: boolean
}

/**
 * Uploadt een document.
 *
 * Gooit bij ongeldige invoer vóór er iets geschreven wordt. Faalt de opslag
 * daarna alsnog, dan blijft er een rij op FAILED staan met de reden — geen
 * bestand, geen wees, en de gebruiker ziet wat er misging.
 *
 * ─── IDEMPOTENTIE, EN WAAROM NIET OP DE CHECKSUM ─────────────────────────────
 *
 * Een checksum beantwoordt "zijn dit dezelfde bytes?". De vraag die we hier
 * moeten beantwoorden is "is dit dezelfde handeling?". Dat zijn verschillende
 * vragen, en ze lopen allebei kanten op mis:
 *
 *   - twee verschillende handelingen, dezelfde bytes: dezelfde loonfiche voor
 *     twee aanvragen indienen. Op de checksum dedupliceren zou hier een
 *     document laten verdwijnen dat de gebruiker bewust aanmaakte;
 *   - één handeling, twee verzoeken: dubbelklik, of een browser die na een
 *     time-out opnieuw verstuurt. Hier hoort precies één document te ontstaan.
 *
 * Daarom stuurt de client een `idempotencyKey` mee die hij per uploadpoging
 * genereert. De checksum blijft bestaan, maar alleen als signaal richting de
 * gebruiker (`duplicateOf`) — hij blokkeert niets.
 *
 * De bestaanscontrole hieronder is niet waterdicht tegen gelijktijdigheid:
 * twee verzoeken kunnen er allebei doorheen glippen. De unique index op
 * `(userId, idempotencyKey)` vangt dat op; `IdempotencyConflictError` is dan
 * geen storing maar het signaal dat de ander won.
 */
export async function uploadDocument(
  userId: string,
  input: UploadInput,
): Promise<UploadResult> {
  // ── 1. Valideren ─────────────────────────────────────────────────────────
  const validation = validateUpload({
    mimeType: input.mimeType,
    size: input.data.byteLength,
    maxBytes: env.STORAGE_MAX_UPLOAD_BYTES,
    buffer: input.data,
  })
  if (!validation.valid) throw documentErrors.uploadInvalid(validation.problems)

  await assertLinksBelongToUser(userId, input)

  const idempotencyKey = input.idempotencyKey?.trim() || null

  // ── 1b. Is dit een herhaling van een eerdere poging? ─────────────────────
  if (idempotencyKey) {
    const replay = await replayUpload(userId, idempotencyKey, input)
    if (replay) return replay
  }

  const checksum = computeChecksum(input.data)
  const duplicate = await repository.findByChecksum(userId, checksum)

  const storageKey = buildStorageKey({
    userId,
    category: input.category,
    mimeType: input.mimeType,
  })

  // ── 2. Rij aanmaken (PENDING) ────────────────────────────────────────────
  let document: { id: string; storageKey: string }
  try {
    document = await repository.createPending({
      userId,
      storageKey,
      idempotencyKey,
      category: input.category,
      // De bestandsnaam van de gebruiker is onbetrouwbare invoer: opschonen
      // vóór opslag, en nooit als pad gebruiken.
      originalFilename: sanitizeFileName(input.originalFilename),
      displayName: input.displayName?.trim() || null,
      description: input.description?.trim() || null,
      mimeType: input.mimeType,
      sizeBytes: input.data.byteLength,
      journeyId: input.journeyId ?? null,
      propertyId: input.propertyId ?? null,
      financingQuoteId: input.financingQuoteId ?? null,
      checklistItemKey: input.checklistItemKey ?? null,
      expiresAt: input.expiresAt ?? null,
    } satisfies Prisma.DocumentUncheckedCreateInput)
  } catch (error) {
    // Een gelijktijdig verzoek met dezelfde sleutel won de race. Geef zijn
    // document terug in plaats van een fout: voor de gebruiker is dit gewoon
    // een geslaagde upload.
    if (error instanceof repository.IdempotencyConflictError && idempotencyKey) {
      const winner = await replayUpload(userId, idempotencyKey, input)
      if (winner) return winner
    }
    throw error
  }

  // ── 3. Naar de opslag ────────────────────────────────────────────────────
  try {
    await getStorageProvider().put(storageKey, input.data, input.mimeType)
  } catch (error) {
    // Scenario 1: rij bestaat, upload mislukt. Geen weesbestand.
    const reason = error instanceof Error ? error.message : 'onbekende opslagfout'
    await repository.markFailed(document.id, reason)

    logger.error('Upload naar de opslag mislukt', {
      entityKey: document.id,
      error: reason,
    })
    throw documentErrors.storageUnavailable()
  }

  // ── 4. Bevestigen ────────────────────────────────────────────────────────
  try {
    await repository.markAvailable(userId, document.id, {
      sizeBytes: input.data.byteLength,
      checksum,
    })
  } catch (error) {
    // Scenario 2: bestand staat er, rij bijwerken mislukt. De rij blijft op
    // PENDING; `reconcileDocument()` zet hem later alsnog goed. Niets weggooien:
    // het bestand ís er.
    logger.error('Document kon niet op AVAILABLE gezet worden', {
      entityKey: document.id,
      error: error instanceof Error ? error.message : 'onbekend',
    })
    throw error
  }

  await recordAudit({
    userId,
    action: 'DOCUMENT_UPLOADED',
    entityType: 'Document',
    entityId: document.id,
    // Geen bestandsnaam en geen inhoud: alleen type, grootte en categorie.
    metadata: {
      category: input.category,
      mimeType: input.mimeType,
      sizeBytes: input.data.byteLength,
      result: 'success',
    },
  })

  await recordEvent({
    userId,
    type: AnalyticsEventType.DOCUMENT_UPLOADED,
    entityKey: input.category,
  })

  return {
    documentId: document.id,
    duplicateOf: duplicate
      ? { id: duplicate.id, name: duplicate.displayName ?? duplicate.originalFilename }
      : null,
    replayed: false,
  }
}

/**
 * Handelt een herhaald verzoek met een bekende `idempotencyKey` af.
 *
 * Geeft `null` wanneer de sleutel nog niet bestaat en de upload dus gewoon
 * door moet gaan.
 *
 * De status van de eerdere poging bepaalt wat er gebeurt:
 *
 *   - AVAILABLE — klaar. Het bestaande document teruggeven.
 *   - PENDING of FAILED — de vorige poging haalde de eindstreep niet. We
 *     schrijven het bestand alsnog weg op dezelfde storage key en maken de rij
 *     af. Een nieuwe rij aanmaken kan niet (de unique index staat dat terecht
 *     niet toe) en zou ook verkeerd zijn: het is dezelfde handeling.
 *   - DELETED of EXPIRED — de handeling is uitgevoerd en daarna ongedaan
 *     gemaakt. We laten hem niet herleven; dat zou een verwijdering stil
 *     terugdraaien. De client hoort een nieuwe sleutel te genereren voor een
 *     nieuwe upload.
 */
async function replayUpload(
  userId: string,
  idempotencyKey: string,
  input: UploadInput,
): Promise<UploadResult | null> {
  const existing = await repository.findByIdempotencyKey(userId, idempotencyKey)
  if (!existing) return null

  if (existing.status === DocumentStatus.PENDING || existing.status === DocumentStatus.FAILED) {
    await getStorageProvider().put(existing.storageKey, input.data, input.mimeType)
    await repository.markAvailable(userId, existing.id, {
      sizeBytes: input.data.byteLength,
      checksum: computeChecksum(input.data),
    })
  }

  logger.info('Upload herhaald met een bekende idempotency key', {
    entityKey: existing.id,
  })

  return { documentId: existing.id, duplicateOf: null, replayed: true }
}

/**
 * Controleert dat elk koppeldoel van deze gebruiker is.
 *
 * Zonder deze check kan iemand zijn document aan de woning of quote van een
 * ander hangen — en dan lekt via die relatie het bestaan van andermans data.
 */
async function assertLinksBelongToUser(userId: string, input: UploadInput): Promise<void> {
  if (input.journeyId) {
    const journey = await prisma.homeBuyingJourney.findFirst({
      where: { id: input.journeyId, userId },
      select: { id: true },
    })
    if (!journey) throw documentErrors.linkTargetNotFound()
  }

  if (input.financingQuoteId) {
    const quote = await prisma.financingQuote.findFirst({
      where: { id: input.financingQuoteId, userId },
      select: { id: true },
    })
    if (!quote) throw documentErrors.linkTargetNotFound()
  }

  if (input.propertyId) {
    // `Property` is globaal, dus "van deze gebruiker" bestaat niet. Wat we wél
    // eisen: hij moet hem bewaard hebben. Anders kan iemand met een geraden
    // propertyId zijn documenten aan willekeurige panden hangen.
    const saved = await prisma.savedProperty.findFirst({
      where: { userId, propertyId: input.propertyId },
      select: { id: true },
    })
    if (!saved) throw documentErrors.linkTargetNotFound()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Downloaden
// ─────────────────────────────────────────────────────────────────────────────

export interface DownloadPayload {
  data: Buffer
  mimeType: string
  filename: string
}

/**
 * Haalt de inhoud op, na autorisatie.
 *
 * De sleutel komt uit de rij die op `userId` gevonden is — nooit uit de request.
 * `keyBelongsToUser` is een tweede slot voor het geval die volgorde ooit
 * omgedraaid wordt.
 */
export async function downloadDocument(
  userId: string,
  documentId: string,
): Promise<DownloadPayload> {
  const document = await repository.requireDocument(userId, documentId)

  if (!isReadable(document.status)) {
    throw documentErrors.notReadable(
      document.status === DocumentStatus.DELETED
        ? 'Dit document is verwijderd.'
        : 'Dit document is niet beschikbaar om te downloaden.',
    )
  }

  if (!keyBelongsToUser(document.storageKey, userId)) {
    logger.error('Opslagsleutel hoort niet bij de gebruiker', { entityKey: document.id })
    throw documentErrors.storageKeyInvalid()
  }

  const data = await getStorageProvider().get(document.storageKey)

  await recordAudit({
    userId,
    action: 'DOCUMENT_DOWNLOADED',
    entityType: 'Document',
    entityId: document.id,
    metadata: { category: document.category, result: 'success' },
  })

  return {
    data,
    mimeType: document.mimeType,
    filename: sanitizeFileName(document.displayName ?? document.originalFilename),
  }
}

/** Een kortlevende URL. De TTL komt uit de configuratie, niet uit de aanroeper. */
export async function createDownloadUrl(userId: string, documentId: string): Promise<string> {
  const document = await repository.requireDocument(userId, documentId)

  if (!isReadable(document.status)) {
    throw documentErrors.notReadable('Dit document is niet beschikbaar.')
  }

  return getStorageProvider().signedUrl(
    document.storageKey,
    env.STORAGE_SIGNED_URL_TTL_SECONDS,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Verwijderen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verwijdert een document.
 *
 * Volgorde: autoriseren → bestand wissen → relaties opruimen → rij bijwerken →
 * audit. Het bestand gaat écht weg; de rij blijft voor de audittrail.
 *
 * Mislukt het wissen, dan wordt de rij tóch op DELETED gezet maar blijft
 * `purgedAt` leeg — en dan pakt `purgeOrphans()` het later opnieuw op. De
 * gebruiker mag niet denken dat zijn loonfiche weg is terwijl hij in de opslag
 * staat, dus dit is een expliciete opruimtaak en geen hoop.
 */
export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  const document = await repository.requireDocument(userId, documentId)

  if (document.status === DocumentStatus.DELETED) throw documentErrors.alreadyDeleted()

  let purged = false
  try {
    await getStorageProvider().delete(document.storageKey)
    purged = true
  } catch (error) {
    logger.error('Bestand kon niet uit de opslag gewist worden; blijft in de opruimwachtrij', {
      entityKey: document.id,
      error: error instanceof Error ? error.message : 'onbekend',
    })
  }

  // De koppeling met checklist-items losmaken: een afgevinkt item mag niet naar
  // een verwijderd document blijven wijzen.
  await prisma.userChecklistItem.updateMany({
    where: { userId, documentId },
    data: { documentId: null },
  })

  await repository.markDeleted(userId, documentId, purged)

  await recordAudit({
    userId,
    action: 'DOCUMENT_DELETED',
    entityType: 'Document',
    entityId: documentId,
    metadata: { category: document.category, result: purged ? 'purged' : 'purge_pending' },
  })

  await recordEvent({
    userId,
    type: AnalyticsEventType.DOCUMENT_DELETED,
    entityKey: document.category,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Koppelen
// ─────────────────────────────────────────────────────────────────────────────

export async function linkDocument(
  userId: string,
  documentId: string,
  links: { propertyId?: string | null; financingQuoteId?: string | null; checklistItemKey?: string | null },
): Promise<void> {
  const document = await repository.requireDocument(userId, documentId)

  await assertLinksBelongToUser(userId, {
    ...document,
    data: Buffer.alloc(0),
    propertyId: links.propertyId ?? null,
    financingQuoteId: links.financingQuoteId ?? null,
    journeyId: null,
  } as UploadInput)

  await repository.updateLinks(userId, documentId, links)

  await recordAudit({
    userId,
    action: links.propertyId || links.financingQuoteId ? 'DOCUMENT_LINKED' : 'DOCUMENT_UNLINKED',
    entityType: 'Document',
    entityId: documentId,
    metadata: {
      propertyLinked: Boolean(links.propertyId),
      quoteLinked: Boolean(links.financingQuoteId),
      result: 'success',
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Uitleg
// ─────────────────────────────────────────────────────────────────────────────

export async function requestExplanation(userId: string, documentId: string) {
  const document = await repository.requireDocument(userId, documentId)

  if (!isReadable(document.status)) {
    throw documentErrors.explanationNotSupported(
      'Dit document is niet beschikbaar, dus we kunnen er geen uitleg bij geven.',
    )
  }

  await recordAudit({
    userId,
    action: 'DOCUMENT_EXPLANATION_REQUESTED',
    entityType: 'Document',
    entityId: documentId,
    metadata: { category: document.category, result: 'requested' },
  })

  await recordEvent({
    userId,
    type: AnalyticsEventType.DOCUMENT_EXPLANATION_REQUESTED,
    entityKey: document.category,
  })

  // Er gaat bewust geen `extractedText` mee: tekstextractie bestaat nog niet.
  // Zie `describeDataSentToProvider()` voor wat een provider wél ontvangt.
  const explanation = await explainDocument({
    category: document.category,
    displayName: document.displayName ?? document.originalFilename,
    mimeType: document.mimeType,
    extractedText: null,
    sourceChecksum: document.checksum,
  })

  // Nieuwe rij, nooit een update: zo blijft zichtbaar dát er opnieuw
  // gegenereerd is en overschrijft niets een eerdere uitleg.
  const saved = await repository.createExplanation({
    documentId,
    userId,
    source: explanation.source,
    provider: explanation.provider,
    model: explanation.model,
    version: explanation.version,
    sourceChecksum: explanation.sourceChecksum,
    summary: explanation.summary,
    keyPoints: explanation.keyPoints,
    attentionPoints: explanation.attentionPoints,
    questionsForProfessional: explanation.questionsForProfessional,
    disclaimer: explanation.disclaimer,
  })

  await recordAudit({
    userId,
    action: 'DOCUMENT_EXPLANATION_CREATED',
    entityType: 'DocumentExplanation',
    entityId: saved.id,
    metadata: { source: explanation.source, result: 'success' },
  })

  return saved
}

export async function getExplanationView(userId: string, documentId: string) {
  const [document, explanation] = await Promise.all([
    repository.requireDocument(userId, documentId),
    repository.latestExplanation(userId, documentId),
  ])

  if (!explanation) return null

  return {
    explanation,
    // Beschrijft deze uitleg nog het bestand dat er nu staat?
    freshness: explanationMatchesDocument(document.checksum, explanation.sourceChecksum),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Opruimen
// ─────────────────────────────────────────────────────────────────────────────

export interface CleanupReport {
  purged: number
  markedAvailable: number
  markedFailed: number
  failures: number
}

/**
 * Ruimt inconsistenties tussen database en opslag op.
 *
 * Idempotent en veilig om herhaald te draaien: elke actie controleert eerst wat
 * er werkelijk in de opslag staat.
 *
 * Bedoeld als onderhoudstaak (cron), niet aanroepbaar vanuit een
 * gebruikersroute — hij gaat systeembreed over alle gebruikers.
 */
export async function purgeOrphans(now: Date = new Date()): Promise<CleanupReport> {
  const storage = getStorageProvider()
  const candidates = await repository.listCleanupCandidates()

  const report: CleanupReport = { purged: 0, markedAvailable: 0, markedFailed: 0, failures: 0 }

  for (const candidate of candidates) {
    const reason: CleanupReason | null = needsCleanup(candidate, now)
    if (!reason) continue

    try {
      if (reason === 'deleted_not_purged') {
        // Scenario 3: verwijderd, maar het wissen mislukte eerder.
        await storage.delete(candidate.storageKey)
        await repository.markPurged(candidate.id)
        report.purged++
        continue
      }

      // Scenario 2 en 4: een rij die op PENDING bleef hangen.
      const metadata = await storage.getMetadata(candidate.storageKey)
      const action = reconcilePending(candidate, metadata !== null, now)

      if (action === 'mark_available') {
        await prisma.document.updateMany({
          where: { id: candidate.id },
          data: { status: DocumentStatus.AVAILABLE, sizeBytes: metadata!.size },
        })
        report.markedAvailable++
      } else if (action === 'mark_failed') {
        await repository.markFailed(
          candidate.id,
          'De upload is nooit bevestigd. Er staat geen bestand in de opslag.',
        )
        report.markedFailed++
      }
    } catch (error) {
      report.failures++
      logger.warn('Opruimen van een document mislukt; volgende ronde opnieuw', {
        entityKey: candidate.id,
        error: error instanceof Error ? error.message : 'onbekend',
      })
    }
  }

  return report
}

/** Eén document tegen de opslag houden. Voor de detailpagina. */
export async function reconcileDocument(
  userId: string,
  documentId: string,
  now: Date = new Date(),
): Promise<DocumentStatus> {
  const document = await repository.requireDocument(userId, documentId)
  if (document.status !== DocumentStatus.PENDING) return document.status

  const metadata = await getStorageProvider().getMetadata(document.storageKey)
  const action = reconcilePending(document, metadata !== null, now)

  if (action === 'mark_available' && metadata) {
    await prisma.document.updateMany({
      where: { id: documentId, userId },
      data: { status: DocumentStatus.AVAILABLE, sizeBytes: metadata.size },
    })
    return DocumentStatus.AVAILABLE
  }

  if (action === 'mark_failed') {
    await repository.markFailed(documentId, 'De upload is nooit bevestigd.')
    return DocumentStatus.FAILED
  }

  return DocumentStatus.PENDING
}
