import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { fact, importRun, lot, notice, procedure, source } from "@/db/schema";
import { sha256, stableStringify } from "@/lib/domain/fingerprint";
import { audit } from "@/lib/audit";
import { factValuesFromInput, refreshProcedure } from "@/lib/services/procedures";
import { mapTedNotice, type MappedTedNotice } from "./map";
import { buildTedQuery, yyyymmdd } from "./query";
import { defaultTedFields, excludedFieldsFromEnv, extraFieldsFromEnv, rejectedFieldsFromError } from "./fields";
import { TedApiError, tedSearchAll, type TedClientOptions } from "./client";

export type ImportStats = {
  fetched: number;
  newProcedures: number;
  newNotices: number;
  changedProcedures: number;
  duplicates: number;
  errors: { publicationNumber: string | null; message: string }[];
};

/**
 * Verwerkt één TED-aankondiging idempotent:
 * - zelfde publicatienummer + zelfde inhoud ⇒ duplicaat, geen wijziging;
 * - nieuwe publicatie voor bestaande procedure ⇒ geen nieuwe kans, wel nieuwe versie + hercontrole indien relevant gewijzigd.
 */
export async function ingestTedNotice(database: DB, raw: Record<string, unknown>, ctx: { importRunId: string | null; stats: ImportStats }) {
  const m: MappedTedNotice = mapTedNotice(raw);
  const contentHash = sha256(stableStringify(raw));
  const existingNotice = await database.query.notice.findFirst({
    where: and(eq(notice.sourceId, "ted"), eq(notice.publicationNumber, m.publicationNumber)),
  });
  if (existingNotice && existingNotice.contentHash === contentHash) {
    ctx.stats.duplicates++;
    return { status: "duplicate" as const, procedureId: existingNotice.procedureId };
  }

  let proc = await database.query.procedure.findFirst({ where: and(eq(procedure.sourceId, "ted"), eq(procedure.externalId, m.procedureExternalId)) });
  const isNewProcedure = !proc;
  const latestKnown = proc
    ? await database.query.notice.findMany({ where: eq(notice.procedureId, proc.id) })
    : [];
  const isLatest = !latestKnown.some((n) => n.publicationDate && m.publicationDate && n.publicationDate > m.publicationDate);

  const core = {
    title: m.title,
    titleLanguage: m.titleLanguage,
    buyerName: m.buyerName,
    buyerCountry: m.buyerCountries[0] ?? null,
    performanceCountries: m.performanceCountries,
    performanceNuts: m.performanceNuts,
    officialLanguages: m.officialLanguages,
    procedureType: m.procedureType,
    cpvCodes: m.cpvCodes,
    description: m.description,
  };
  if (!proc) {
    [proc] = await database.insert(procedure).values({ sourceId: "ted", externalId: m.procedureExternalId, ...core }).returning();
    ctx.stats.newProcedures++;
  } else if (isLatest) {
    // Kerngegevens volgen de meest recente publicatie; lege velden overschrijven bestaande waarden niet.
    const patch = Object.fromEntries(
      Object.entries(core).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)),
    );
    await database.update(procedure).set(patch).where(eq(procedure.id, proc.id));
  }

  let noticeId: string;
  if (existingNotice) {
    await database
      .update(notice)
      .set({ rawPayload: raw, contentHash, fetchedAt: new Date(), importRunId: ctx.importRunId, changeDescription: m.changeDescription })
      .where(eq(notice.id, existingNotice.id));
    noticeId = existingNotice.id;
  } else {
    const [n] = await database
      .insert(notice)
      .values({
        procedureId: proc.id,
        sourceId: "ted",
        publicationNumber: m.publicationNumber,
        noticeIdentifier: m.noticeIdentifier,
        noticeVersion: m.noticeVersion,
        noticeType: m.noticeType,
        formType: m.formType,
        publicationDateRaw: m.publicationDateRaw,
        publicationDate: m.publicationDate,
        url: m.url,
        language: m.titleLanguage,
        changeDescription: m.changeDescription,
        rawPayload: raw,
        contentHash,
        importRunId: ctx.importRunId,
      })
      .onConflictDoNothing()
      .returning();
    if (!n) {
      ctx.stats.duplicates++;
      return { status: "duplicate" as const, procedureId: proc.id };
    }
    noticeId = n.id;
    ctx.stats.newNotices++;
  }

  // Percelen
  const lotIdByKey = new Map<string, string>();
  for (const l of m.lots) {
    const [row] = await database
      .insert(lot)
      .values({ procedureId: proc.id, lotKey: l.lotKey, title: l.title, description: l.description })
      .onConflictDoUpdate({
        target: [lot.procedureId, lot.lotKey],
        // Lege TED-waarden overschrijven bestaande perceelgegevens niet.
        set: { title: sql`coalesce(excluded.title, ${lot.title})`, description: sql`coalesce(excluded.description, ${lot.description})` },
      })
      .returning();
    lotIdByKey.set(l.lotKey, row.id);
  }

  // Gestructureerde feiten uit de meest recente publicatie vervangen eerdere gestructureerde feiten.
  if (isLatest && m.facts.length) {
    const keys = Array.from(new Set(m.facts.map((f) => f.key)));
    const now = new Date();
    for (const key of keys) {
      await database
        .update(fact)
        .set({ supersededAt: now })
        .where(and(eq(fact.procedureId, proc.id), eq(fact.key, key), eq(fact.extractionMethod, "structured_field"), isNull(fact.supersededAt)));
    }
    for (const f of m.facts) {
      await database.insert(fact).values(
        factValuesFromInput({
          procedureId: proc.id,
          lotId: f.lotKey ? (lotIdByKey.get(f.lotKey) ?? null) : null,
          key: f.key,
          rawValue: f.rawValue,
          valueNumber: f.valueNumber,
          unit: f.unit,
          parsedDeadline: f.parsedDeadline,
          sourceNoticeId: noticeId,
          locator: `${f.locator} — publicatie ${m.publicationNumber}`,
          extractionMethod: "structured_field",
          verificationStatus: "unverified",
        }),
      );
    }
  }

  const r = await refreshProcedure(database, proc.id, { actorUserId: null, reason: `TED-publicatie ${m.publicationNumber}` });
  if (r.changed && !isNewProcedure) ctx.stats.changedProcedures++;
  return { status: existingNotice ? ("updated" as const) : ("new" as const), procedureId: proc.id, warnings: m.warnings };
}

export async function runTedImport(
  database: DB,
  input: { from?: Date; to?: Date; trigger: "manual" | "schedule" | "sample"; actorUserId: string | null; idempotencyKey?: string; maxPages?: number },
  clientOpts: TedClientOptions = {},
) {
  const src = await database.query.source.findFirst({ where: eq(source.id, "ted") });
  const to = input.to ?? new Date();
  let from = input.from;
  if (!from) {
    if (src?.cursor) {
      const y = Number(src.cursor.slice(0, 4)), mo = Number(src.cursor.slice(4, 6)), d = Number(src.cursor.slice(6, 8));
      from = new Date(Date.UTC(y, mo - 1, d) - 86_400_000); // 1 dag overlap; deduplicatie vangt dubbels op
    } else from = new Date(to.getTime() - 14 * 86_400_000);
  }
  const fields = defaultTedFields(extraFieldsFromEnv(), excludedFieldsFromEnv());
  const query = buildTedQuery({ from, to });
  const limit = Number(process.env.TED_PAGE_LIMIT ?? 100);
  const key = input.idempotencyKey ?? `${input.trigger}:${yyyymmdd(from)}-${yyyymmdd(to)}:${Date.now()}`;

  const existing = await database.query.importRun.findFirst({ where: and(eq(importRun.sourceId, "ted"), eq(importRun.idempotencyKey, key)) });
  if (existing && existing.status === "success") return { run: existing, skipped: true as const };
  const [run] = existing
    ? await database.update(importRun).set({ status: "running", startedAt: new Date(), errorMessage: null }).where(eq(importRun.id, existing.id)).returning()
    : await database
        .insert(importRun)
        .values({ sourceId: "ted", idempotencyKey: key, trigger: input.trigger, query, params: { from: from.toISOString(), to: to.toISOString(), fields, limit } })
        .returning();
  await database.update(source).set({ lastRunAt: new Date(), lastRunStatus: "running" }).where(eq(source.id, "ted"));

  let stats: ImportStats = { fetched: 0, newProcedures: 0, newNotices: 0, changedProcedures: 0, duplicates: 0, errors: [] };
  let total: number | null = null;
  let fatal: string | null = null;
  let activeFields = [...fields];
  const droppedFields: string[] = [];
  for (let attempt = 1; attempt <= 4; attempt++) {
    stats = { fetched: 0, newProcedures: 0, newNotices: 0, changedProcedures: 0, duplicates: 0, errors: [] };
    fatal = null;
    try {
      const res = await tedSearchAll(
        { query, fields: activeFields, limit, maxPages: input.maxPages ?? 200 },
        async (notices) => {
          for (const raw of notices) {
            stats.fetched++;
            try {
              await ingestTedNotice(database, raw, { importRunId: run.id, stats });
            } catch (e) {
              stats.errors.push({
                publicationNumber: (Array.isArray(raw["publication-number"]) ? raw["publication-number"][0] : raw["publication-number"]) as string | null,
                message: e instanceof Error ? e.message.slice(0, 300) : String(e),
              });
            }
          }
        },
        clientOpts,
      );
      total = res.totalNoticeCount;
      break;
    } catch (e) {
      fatal = e instanceof Error ? e.message : String(e);
      // Weigert TED één of meer opgevraagde velden (HTTP 400), laat die dan weg en probeer opnieuw.
      const rejected = e instanceof TedApiError && e.status === 400 ? rejectedFieldsFromError(e.body, activeFields).filter((f) => f !== "publication-number") : [];
      if (!rejected.length) break;
      droppedFields.push(...rejected);
      activeFields = activeFields.filter((f) => !rejected.includes(f));
    }
  }
  if (droppedFields.length) {
    const msg = `Door TED geweigerde velden weggelaten: ${droppedFields.join(", ")}.`;
    stats.errors.push({ publicationNumber: null, message: msg });
  }

  const incomplete = total !== null && stats.fetched < total;
  const status = fatal ? "failed" : stats.errors.length || incomplete ? "partial" : "success";
  const errorMessage = [
    fatal,
    incomplete ? `Onvolledig: ${stats.fetched} van ${total} aankondigingen opgehaald.` : null,
    stats.errors.length ? `${stats.errors.length} aankondiging(en) niet verwerkt: ${stats.errors.slice(0, 5).map((x) => `${x.publicationNumber}: ${x.message}`).join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const [done] = await database
    .update(importRun)
    .set({
      status,
      totalReported: total,
      fetchedCount: stats.fetched,
      newProcedures: stats.newProcedures,
      newNotices: stats.newNotices,
      changedProcedures: stats.changedProcedures,
      duplicateNotices: stats.duplicates,
      errorCount: stats.errors.length + (fatal ? 1 : 0),
      params: { from: from.toISOString(), to: to.toISOString(), fields: activeFields, droppedFields, limit },
      errorMessage: errorMessage || null,
      finishedAt: new Date(),
    })
    .where(eq(importRun.id, run.id))
    .returning();
  await database
    .update(source)
    .set({
      lastRunStatus: status,
      ...(status === "success" ? { lastSuccessAt: new Date(), cursor: yyyymmdd(to) } : {}),
    })
    .where(eq(source.id, "ted"));
  await audit(database, { actorUserId: input.actorUserId, action: `import.ted.${status}`, entityType: "import_run", entityId: run.id, details: { fetched: stats.fetched, errors: stats.errors.length } });
  return { run: done, skipped: false as const, stats };
}
