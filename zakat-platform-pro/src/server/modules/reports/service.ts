import 'server-only'

import { randomUUID } from 'node:crypto'

import type { AnnualReport } from '@/generated/prisma/client'

import { prisma } from '@/server/db/prisma'
import type { Actor } from '@/server/auth/actor'
import { recordAudit } from '@/server/services/audit'
import { trackEvent } from '@/server/services/analytics'
import { NotFoundError } from '@/lib/errors'
import { serverEnv, appBaseUrl } from '@/config/env'
import { getFileStorage } from '@/server/storage'
import type { FileStorage } from '@/server/storage/types'
import {
  DOWNLOAD_TOKEN_TTL_SECONDS,
  createDownloadToken,
} from '@/server/storage/signing'
import {
  ReportGenerationFailedError,
  ReportNotAvailableError,
} from '@/server/modules/reminders/errors'
import {
  ANNUAL_REPORT_VERSION,
  buildAnnualReport,
  type AnnualReportData,
} from '@/server/modules/reports/annual-report'
import { getReportRenderer, type ReportRenderer } from '@/server/modules/reports/renderer'

/**
 * Report generation and snapshots (§31, §33, §36).
 *
 * ── Live preview versus frozen snapshot ──────────────────────────────────────
 * Browsing a year always recomputes from current donations, so it reflects a
 * donation voided this morning. **Generating** a report writes an
 * `AnnualReport` row holding a copy of that data plus the rendered file. A
 * report downloaded in January therefore still reads the same in June, after a
 * charity was renamed or a donation corrected — the same discipline the Zakat
 * calculation and donation history already follow.
 *
 * Files use the phase-3 storage and signing path: private storage, generated key,
 * short-lived signed link, ownership re-checked on download (§33).
 */

export interface GeneratedReportView {
  id: string
  year: number
  sequence: number
  reportVersion: string
  generatedAt: Date
  hasFile: boolean
  fileName: string | null
  /** Signed, expires; minted only after the ownership check. */
  downloadUrl: string | null
}

function toView(
  report: AnnualReport & { document: { fileName: string } | null },
  actor: Actor,
): GeneratedReportView {
  return {
    id: report.id,
    year: report.year,
    sequence: report.sequence,
    reportVersion: report.reportVersion,
    generatedAt: report.generatedAt,
    hasFile: Boolean(report.documentId),
    fileName: report.document?.fileName ?? null,
    downloadUrl: report.documentId ? signedUrlFor(report.documentId, actor) : null,
  }
}

function signedUrlFor(documentId: string, actor: Actor): string {
  const token = createDownloadToken(
    {
      documentId,
      userId: actor.userId,
      expiresAt: Math.floor(Date.now() / 1000) + DOWNLOAD_TOKEN_TTL_SECONDS,
    },
    serverEnv().AUTH_SECRET,
  )

  return `${appBaseUrl()}/api/documents/${documentId}/download?token=${encodeURIComponent(token)}`
}

/** Previously generated snapshots for a year, newest first. */
export async function listGeneratedReports(
  actor: Actor,
  year?: number,
): Promise<GeneratedReportView[]> {
  const rows = await prisma.annualReport.findMany({
    where: { userId: actor.userId, ...(year ? { year } : {}) },
    include: { document: { select: { fileName: true } } },
    orderBy: [{ year: 'desc' }, { sequence: 'desc' }],
  })

  return rows.map((row) => toView(row, actor))
}

/**
 * Read back a stored snapshot exactly as it was written.
 *
 * Never recomputed — that is the entire point of storing it (§31).
 */
export async function readGeneratedReport(
  actor: Actor,
  id: string,
): Promise<{ view: GeneratedReportView; data: AnnualReportData }> {
  const row = await prisma.annualReport.findFirst({
    where: { id, userId: actor.userId },
    include: { document: { select: { fileName: true } } },
  })

  if (!row) throw new ReportNotAvailableError()

  return { view: toView(row, actor), data: row.data as unknown as AnnualReportData }
}

/**
 * Freeze a year into a snapshot and render it to a file.
 *
 * Transactional around the database writes: a snapshot row without its document,
 * or a document nothing points at, would both be worse than failing outright.
 * The file is written to storage first so the transaction has something real to
 * commit against.
 */
export async function generateAnnualReport(
  actor: Actor,
  year: number,
  options: { renderer?: ReportRenderer; storage?: FileStorage; now?: Date } = {},
): Promise<GeneratedReportView> {
  const renderer = options.renderer ?? getReportRenderer()
  const storage = options.storage ?? getFileStorage()
  const now = options.now ?? new Date()

  const data = await buildAnnualReport(actor, year, now)

  let rendered
  try {
    rendered = await renderer.renderAnnualReport(data)
  } catch (error) {
    throw new ReportGenerationFailedError(
      error instanceof Error ? error.message : 'Onbekende fout bij het renderen.',
    )
  }

  // Generated key under the owner's id, exactly as receipts do — the filename a
  // user sees never reaches the filesystem.
  const key = `reports/${actor.userId}/${randomUUID()}.${rendered.extension}`
  const stored = await storage.put({
    key,
    body: rendered.body,
    contentType: rendered.mimeType,
  })

  const previous = await prisma.annualReport.findFirst({
    where: { userId: actor.userId, periodType: 'GREGORIAN_YEAR', year },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  })

  const sequence = (previous?.sequence ?? 0) + 1

  const report = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        userId: actor.userId,
        type: 'ZAKAT_REPORT',
        fileName: `barakah-overzicht-${year}.${rendered.extension}`,
        mimeType: rendered.mimeType,
        sizeBytes: stored.sizeBytes,
        storageProvider: storage.backend === 's3' ? 'S3' : 'LOCAL',
        storageKey: stored.key,
        checksumSha256: stored.checksumSha256,
      },
    })

    return tx.annualReport.create({
      data: {
        userId: actor.userId,
        periodType: 'GREGORIAN_YEAR',
        year,
        sequence,
        reportVersion: ANNUAL_REPORT_VERSION,
        // The frozen copy. Cast through unknown because Prisma's JSON type does
        // not accept a structured interface directly.
        data: data as unknown as object,
        documentId: document.id,
        generatedAt: now,
      },
      include: { document: { select: { fileName: true } } },
    })
  })

  await recordAudit({
    userId: actor.userId,
    action: 'REPORT_GENERATED',
    entityType: 'AnnualReport',
    entityId: report.id,
    // Year and version only — no amounts, no recipient names (§38).
    metadata: { year, sequence, reportVersion: ANNUAL_REPORT_VERSION },
  })

  trackEvent('ANNUAL_REPORT_GENERATED', actor.userId, { reportYear: year })

  return toView(report, actor)
}

/** Record that a stored report was downloaded (§38). */
export async function recordReportDownload(actor: Actor, documentId: string): Promise<void> {
  const report = await prisma.annualReport.findFirst({
    where: { userId: actor.userId, documentId },
    select: { id: true, year: true },
  })

  if (!report) return

  await recordAudit({
    userId: actor.userId,
    action: 'REPORT_DOWNLOADED',
    entityType: 'AnnualReport',
    entityId: report.id,
    metadata: { year: report.year },
  })
}

/** Read the bytes of a generated report after re-checking ownership. */
export async function readReportBytes(
  actor: Actor,
  documentId: string,
  storage: FileStorage = getFileStorage(),
): Promise<{ body: Buffer; mimeType: string; fileName: string }> {
  const document = await prisma.document.findUnique({ where: { id: documentId } })

  if (!document || document.userId !== actor.userId) throw new NotFoundError()

  return {
    body: await storage.get(document.storageKey),
    mimeType: document.mimeType,
    fileName: document.fileName,
  }
}
