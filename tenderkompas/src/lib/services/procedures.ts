import { and, asc, eq, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import {
  document,
  fact,
  lot,
  notice,
  procedure,
  requirement,
  type FactKey,
  type ProcedureLifecycle,
  type RequirementCategory,
  type RequirementKind,
} from "@/db/schema";
import { deriveLifecycle, effectiveLifecycle, isCancellationSignal, isSuspensionSignal } from "@/lib/domain/lifecycle";
import { procedureFingerprint, sha256, stableStringify } from "@/lib/domain/fingerprint";
import { audit } from "@/lib/audit";
import { parseFreeTextDeadline, type ParsedDeadline } from "@/lib/time";
import { reassessProcedure } from "./assessments";

export async function loadProcedureBundle(database: DB, procedureId: string) {
  const p = await database.query.procedure.findFirst({ where: eq(procedure.id, procedureId) });
  if (!p) return null;
  const [lots, facts, reqs, docs, notices] = await Promise.all([
    database.select().from(lot).where(eq(lot.procedureId, procedureId)).orderBy(asc(lot.lotKey)),
    database.select().from(fact).where(eq(fact.procedureId, procedureId)).orderBy(asc(fact.createdAt)),
    database.select().from(requirement).where(eq(requirement.procedureId, procedureId)).orderBy(asc(requirement.createdAt)),
    database.select().from(document).where(eq(document.procedureId, procedureId)).orderBy(asc(document.createdAt)),
    database.select().from(notice).where(eq(notice.procedureId, procedureId)).orderBy(asc(notice.publicationDate), asc(notice.createdAt)),
  ]);
  return { procedure: p, lots, facts, requirements: reqs, documents: docs, notices };
}
export type ProcedureBundle = NonNullable<Awaited<ReturnType<typeof loadProcedureBundle>>>;

function noticeCancelled(n: { noticeType: string | null; rawPayload: unknown }): boolean {
  if (n.noticeType === "cancellation") return true;
  const raw = (n.rawPayload ?? {}) as Record<string, unknown>;
  const codes = ([] as unknown[]).concat(raw["change-reason-code"] ?? []).map(String);
  return isCancellationSignal({
    changeReasonCodes: codes,
    competitionTermination: ([] as unknown[]).concat(raw["competition-termination-proc"] ?? []).map(String),
  });
}

export function computeFingerprint(b: Omit<ProcedureBundle, "notices"> & { lifecycle: ProcedureLifecycle }) {
  const lotKeyById = new Map(b.lots.map((l) => [l.id, l.lotKey]));
  return procedureFingerprint({
    lifecycle: b.lifecycle,
    summary: b.procedure.summaryNl,
    core: {
      title: b.procedure.title,
      description: b.procedure.description,
      buyerName: b.procedure.buyerName,
      cpvCodes: [...b.procedure.cpvCodes].sort(),
      officialLanguages: [...b.procedure.officialLanguages].sort(),
      performanceNuts: [...b.procedure.performanceNuts].sort(),
      performanceCountries: [...b.procedure.performanceCountries].sort(),
      procedureType: b.procedure.procedureType,
    },
    lots: b.lots.map((l) => ({ lotKey: l.lotKey, title: l.title, cpvCodes: l.cpvCodes })),
    facts: b.facts
      .filter((f) => !f.supersededAt)
      .map((f) => ({
        key: f.key,
        lotKey: f.lotId ? (lotKeyById.get(f.lotId) ?? f.lotId) : null,
        rawValue: f.rawValue,
        valueNumber: f.valueNumber,
        unit: f.unit,
        valueInstant: f.valueInstant,
        valueDate: f.valueDate,
        verificationStatus: f.verificationStatus,
      })),
    requirements: b.requirements
      .filter((r) => !r.supersededAt)
      .map((r) => ({
        kind: r.kind,
        category: r.category,
        lotKey: r.lotId ? (lotKeyById.get(r.lotId) ?? r.lotId) : null,
        text: r.text,
        mandatory: r.mandatory,
        consortiumBasis: r.consortiumBasis,
        verificationStatus: r.verificationStatus,
      })),
    documents: b.documents.map((d) => ({ sha256: d.sha256, textStatus: d.textStatus })),
  });
}

/**
 * Herberekent levensfase en vingerafdruk. Bij een wijziging worden alle klantbeoordelingen
 * opnieuw ter controle gezet (goedkeuring vervalt; gepubliceerde versie krijgt een wijzigingsmelding).
 */
export async function refreshProcedure(database: DB, procedureId: string, ctx: { actorUserId?: string | null; reason: string }) {
  const b = await loadProcedureBundle(database, procedureId);
  if (!b) throw new Error("Procedure niet gevonden");
  const lifecycle = deriveLifecycle(
    b.notices.map((n) => ({
      noticeType: n.noticeType,
      formType: n.formType,
      publicationDate: n.publicationDate,
      cancelled: noticeCancelled(n),
      suspended: isSuspensionSignal(([] as unknown[]).concat(((n.rawPayload ?? {}) as Record<string, unknown>)["change-reason-code"] ?? []).map(String)),
    })),
  );
  const fp = computeFingerprint({ ...b, lifecycle: effectiveLifecycle({ lifecycle, lifecycleOverride: b.procedure.lifecycleOverride }) });
  const changed = fp !== b.procedure.fingerprint;
  const now = new Date();
  await database
    .update(procedure)
    .set({
      lifecycle,
      fingerprint: fp,
      ...(changed && b.procedure.fingerprint ? { fingerprintChangedAt: now } : {}),
      lastCheckedAt: now,
    })
    .where(eq(procedure.id, procedureId));
  if (changed && b.procedure.fingerprint) {
    await audit(database, {
      actorUserId: ctx.actorUserId,
      action: "procedure.changed",
      entityType: "procedure",
      entityId: procedureId,
      details: { reason: ctx.reason },
    });
    await reassessProcedure(database, procedureId, { reason: `Bronwijziging: ${ctx.reason}`, actorUserId: ctx.actorUserId ?? null });
  }
  return { changed: changed && !!b.procedure.fingerprint, fingerprint: fp, lifecycle };
}

/* ---------------------------- Handmatige invoer ---------------------------- */

export type ManualNoticeKind = "cn-standard" | "pin-only" | "can-standard" | "change" | "cancellation";

export async function createManualProcedure(
  database: DB,
  input: {
    sourceId: "be-eprocurement" | "manual" | "demo";
    externalReference: string;
    title: string;
    titleLanguage?: string | null;
    buyerName?: string | null;
    buyerCountry?: string | null;
    performanceNuts?: string[];
    performanceCountries?: string[];
    officialLanguages?: string[];
    procedureType?: string | null;
    cpvCodes?: string[];
    description?: string | null;
    noticeKind: ManualNoticeKind;
    sourceUrl?: string | null;
    publicationDate?: string | null;
  },
  actorUserId: string | null,
) {
  const isDemo = input.sourceId === "demo";
  const existing = await database.query.procedure.findFirst({
    where: and(eq(procedure.sourceId, input.sourceId), eq(procedure.externalId, input.externalReference.trim())),
  });
  if (existing) throw new Error("Deze bronreferentie bestaat al; voeg een nieuwe publicatie toe aan de bestaande procedure.");
  const [p] = await database
    .insert(procedure)
    .values({
      sourceId: input.sourceId,
      externalId: input.externalReference.trim(),
      title: input.title.trim(),
      titleLanguage: input.titleLanguage ?? null,
      buyerName: input.buyerName ?? null,
      buyerCountry: input.buyerCountry ?? null,
      performanceNuts: input.performanceNuts ?? [],
      performanceCountries: input.performanceCountries ?? [],
      officialLanguages: input.officialLanguages ?? [],
      procedureType: input.procedureType ?? null,
      cpvCodes: input.cpvCodes ?? [],
      description: input.description ?? null,
      isDemo,
    })
    .returning();
  await addManualNotice(database, p.id, {
    kind: input.noticeKind,
    reference: input.externalReference.trim(),
    url: input.sourceUrl ?? null,
    publicationDate: input.publicationDate ?? null,
    changeDescription: null,
  }, actorUserId, { skipRefresh: true });
  await audit(database, { actorUserId, action: "procedure.created_manual", entityType: "procedure", entityId: p.id, details: { sourceId: input.sourceId } });
  await refreshProcedure(database, p.id, { actorUserId, reason: "aangemaakt" });
  return p.id;
}

export async function addManualNotice(
  database: DB,
  procedureId: string,
  input: { kind: ManualNoticeKind; reference: string; url: string | null; publicationDate: string | null; changeDescription: string | null },
  actorUserId: string | null,
  opts: { skipRefresh?: boolean } = {},
) {
  const p = await database.query.procedure.findFirst({ where: eq(procedure.id, procedureId) });
  if (!p) throw new Error("Procedure niet gevonden");
  const pubDate = input.publicationDate ? new Date(`${input.publicationDate}T12:00:00Z`) : null;
  const payload = { manual: true, kind: input.kind, reference: input.reference, url: input.url, changeDescription: input.changeDescription };
  const pubNo = `${input.reference}#${input.kind}#${input.publicationDate ?? "zonder-datum"}`;
  await database
    .insert(notice)
    .values({
      procedureId,
      sourceId: p.sourceId,
      publicationNumber: pubNo,
      noticeType: input.kind === "change" ? null : input.kind,
      formType: input.kind === "change" ? "change" : null,
      publicationDateRaw: input.publicationDate,
      publicationDate: pubDate,
      url: input.url,
      changeDescription: input.changeDescription,
      rawPayload: payload,
      contentHash: sha256(stableStringify(payload)),
    })
    .onConflictDoNothing();
  await audit(database, { actorUserId, action: "notice.added_manual", entityType: "procedure", entityId: procedureId, details: { kind: input.kind } });
  if (!opts.skipRefresh) await refreshProcedure(database, procedureId, { actorUserId, reason: `publicatie toegevoegd (${input.kind})` });
}

export async function upsertLot(database: DB, procedureId: string, input: { lotKey: string; title?: string | null; description?: string | null; cpvCodes?: string[] }) {
  const [row] = await database
    .insert(lot)
    .values({ procedureId, lotKey: input.lotKey.trim(), title: input.title ?? null, description: input.description ?? null, cpvCodes: input.cpvCodes ?? [] })
    .onConflictDoUpdate({
      target: [lot.procedureId, lot.lotKey],
      set: { title: input.title ?? null, description: input.description ?? null, cpvCodes: input.cpvCodes ?? [] },
    })
    .returning();
  return row;
}

export type FactInput = {
  procedureId: string;
  lotId?: string | null;
  key: FactKey;
  rawValue: string;
  valueNumber?: number | null;
  unit?: string | null;
  /** Context voor tijdzone-detectie (bv. bewijsfragment). */
  context?: string | null;
  sourceNoticeId?: string | null;
  documentId?: string | null;
  documentVersion?: number | null;
  locator?: string | null;
  evidenceSnippet?: string | null;
  extractionMethod: "structured_field" | "ai" | "manual";
  verificationStatus?: "unverified" | "verified" | "rejected" | "evidence_not_found";
  extractionRunId?: string | null;
  /** Reeds geparste deadline (bv. TED datum+tijd); anders wordt rawValue geparsed. */
  parsedDeadline?: ParsedDeadline | null;
};

const DEADLINE_KEYS = new Set(["submission_deadline", "participation_deadline", "questions_deadline"]);

export function factValuesFromInput(f: FactInput) {
  let valueInstant: Date | null = null;
  let valueDate: string | null = null;
  let timeKnown = false;
  let timezoneKnown = false;
  if (DEADLINE_KEYS.has(f.key)) {
    const parsed = f.parsedDeadline ?? parseFreeTextDeadline(f.rawValue, f.context ?? f.evidenceSnippet ?? null);
    valueInstant = parsed.instant;
    valueDate = parsed.date;
    timeKnown = parsed.timeKnown;
    timezoneKnown = parsed.timezoneKnown;
  }
  return {
    procedureId: f.procedureId,
    lotId: f.lotId ?? null,
    key: f.key,
    rawValue: f.rawValue,
    valueNumber: f.valueNumber === null || f.valueNumber === undefined ? null : String(f.valueNumber),
    unit: f.unit ?? null,
    valueInstant,
    valueDate,
    timeKnown,
    timezoneKnown,
    sourceNoticeId: f.sourceNoticeId ?? null,
    documentId: f.documentId ?? null,
    documentVersion: f.documentVersion ?? null,
    locator: f.locator ?? null,
    evidenceSnippet: f.evidenceSnippet ?? null,
    extractionMethod: f.extractionMethod,
    verificationStatus: f.verificationStatus ?? "unverified",
    extractionRunId: f.extractionRunId ?? null,
  };
}

/** Voegt een feit toe en vervangt (supersedes) het vorige actieve feit met dezelfde sleutel/perceel/methode. */
export async function setFact(database: DB, f: FactInput, actorUserId: string | null, opts: { refresh?: boolean } = { refresh: true }) {
  const now = new Date();
  await database
    .update(fact)
    .set({ supersededAt: now })
    .where(
      and(
        eq(fact.procedureId, f.procedureId),
        eq(fact.key, f.key),
        f.lotId ? eq(fact.lotId, f.lotId) : isNull(fact.lotId),
        eq(fact.extractionMethod, f.extractionMethod),
        isNull(fact.supersededAt),
      ),
    );
  const [row] = await database.insert(fact).values(factValuesFromInput(f)).returning();
  await audit(database, { actorUserId, action: "fact.set", entityType: "procedure", entityId: f.procedureId, details: { key: f.key, method: f.extractionMethod } });
  if (opts.refresh !== false) await refreshProcedure(database, f.procedureId, { actorUserId, reason: `feit gewijzigd (${f.key})` });
  return row;
}

export async function setFactVerification(database: DB, factId: string, status: "verified" | "rejected" | "unverified", actorUserId: string) {
  const [row] = await database.update(fact).set({ verificationStatus: status }).where(eq(fact.id, factId)).returning();
  if (!row) throw new Error("Feit niet gevonden");
  await audit(database, { actorUserId, action: "fact.verification", entityType: "fact", entityId: factId, details: { status } });
  await refreshProcedure(database, row.procedureId, { actorUserId, reason: "verificatiestatus feit gewijzigd" });
}

export type RequirementInput = {
  procedureId: string;
  lotId?: string | null;
  kind: RequirementKind;
  category: RequirementCategory;
  text: string;
  language?: string | null;
  mandatory: boolean | null;
  weight?: string | null;
  consortiumBasis?: "documented" | "not_allowed" | "unknown";
  consortiumEvidence?: string | null;
  sourceNoticeId?: string | null;
  documentId?: string | null;
  documentVersion?: number | null;
  locator?: string | null;
  evidenceSnippet?: string | null;
  extractionMethod: "structured_field" | "ai" | "manual";
  verificationStatus?: "unverified" | "verified" | "rejected" | "evidence_not_found";
  extractionRunId?: string | null;
};

export async function addRequirement(database: DB, r: RequirementInput, actorUserId: string | null, opts: { refresh?: boolean } = { refresh: true }) {
  const [row] = await database
    .insert(requirement)
    .values({
      procedureId: r.procedureId,
      lotId: r.lotId ?? null,
      kind: r.kind,
      category: r.category,
      text: r.text.trim(),
      language: r.language ?? null,
      mandatory: r.mandatory,
      weight: r.weight ?? null,
      consortiumBasis: r.consortiumBasis ?? "unknown",
      consortiumEvidence: r.consortiumEvidence ?? null,
      sourceNoticeId: r.sourceNoticeId ?? null,
      documentId: r.documentId ?? null,
      documentVersion: r.documentVersion ?? null,
      locator: r.locator ?? null,
      evidenceSnippet: r.evidenceSnippet ?? null,
      extractionMethod: r.extractionMethod,
      verificationStatus: r.verificationStatus ?? "unverified",
      extractionRunId: r.extractionRunId ?? null,
    })
    .returning();
  await audit(database, { actorUserId, action: "requirement.added", entityType: "procedure", entityId: r.procedureId, details: { kind: r.kind, method: r.extractionMethod } });
  if (opts.refresh !== false) await refreshProcedure(database, r.procedureId, { actorUserId, reason: "voorwaarde toegevoegd" });
  return row;
}

export async function updateRequirementStatus(
  database: DB,
  requirementId: string,
  patch: { verificationStatus?: "verified" | "rejected" | "unverified"; superseded?: boolean; mandatory?: boolean | null; consortiumBasis?: "documented" | "not_allowed" | "unknown"; consortiumEvidence?: string | null },
  actorUserId: string,
) {
  const [row] = await database
    .update(requirement)
    .set({
      ...(patch.verificationStatus ? { verificationStatus: patch.verificationStatus } : {}),
      ...(patch.superseded ? { supersededAt: new Date() } : {}),
      ...(patch.mandatory !== undefined ? { mandatory: patch.mandatory } : {}),
      ...(patch.consortiumBasis ? { consortiumBasis: patch.consortiumBasis } : {}),
      ...(patch.consortiumEvidence !== undefined ? { consortiumEvidence: patch.consortiumEvidence } : {}),
    })
    .where(eq(requirement.id, requirementId))
    .returning();
  if (!row) throw new Error("Voorwaarde niet gevonden");
  await audit(database, { actorUserId, action: "requirement.updated", entityType: "requirement", entityId: requirementId, details: { fields: Object.keys(patch) } });
  await refreshProcedure(database, row.procedureId, { actorUserId, reason: "voorwaarde gewijzigd" });
}

export async function setLifecycleOverride(database: DB, procedureId: string, value: ProcedureLifecycle | null, note: string | null, actorUserId: string) {
  await database.update(procedure).set({ lifecycleOverride: value, lifecycleOverrideNote: note }).where(eq(procedure.id, procedureId));
  await audit(database, { actorUserId, action: "procedure.lifecycle_override", entityType: "procedure", entityId: procedureId, details: { value } });
  await refreshProcedure(database, procedureId, { actorUserId, reason: "status handmatig gecorrigeerd" });
}

export async function setSummary(
  database: DB,
  procedureId: string,
  input: { summaryNl: string; isTranslation: boolean; method: "ai" | "manual"; verified: boolean },
  actorUserId: string | null,
) {
  await database
    .update(procedure)
    .set({ summaryNl: input.summaryNl, summaryIsTranslation: input.isTranslation, summaryMethod: input.method, summaryVerified: input.verified })
    .where(eq(procedure.id, procedureId));
  await audit(database, { actorUserId, action: "procedure.summary", entityType: "procedure", entityId: procedureId, details: { method: input.method, verified: input.verified } });
  await refreshProcedure(database, procedureId, { actorUserId, reason: "samenvatting gewijzigd" });
}
