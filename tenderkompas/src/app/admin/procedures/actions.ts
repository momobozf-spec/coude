"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { procedure, type FactKey, type ProcedureLifecycle } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { list, optNum, optStr, runAction, str } from "@/lib/action-helpers";
import {
  addManualNotice,
  addRequirement,
  createManualProcedure,
  refreshProcedure,
  setFact,
  setFactVerification,
  setLifecycleOverride,
  setSummary,
  updateRequirementStatus,
  upsertLot,
  type ManualNoticeKind,
} from "@/lib/services/procedures";
import { fetchDocumentFromUrl, storeDocument } from "@/lib/services/documents";
import { runExtraction } from "@/lib/ai/extract";
import { createAssessmentVersion } from "@/lib/services/assessments";
import { audit } from "@/lib/audit";

const noticeKind = z.enum(["cn-standard", "pin-only", "can-standard", "change", "cancellation"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const urlOrNull = z.string().url().refine((u) => /^https?:\/\//.test(u), "Alleen http(s)").nullable();

export async function createProcedureAction(fd: FormData) {
  const admin = await requireAdmin();
  await runAction("/admin/procedures/nieuw", async () => {
    const input = z
      .object({
        sourceId: z.enum(["be-eprocurement", "manual", "demo"]),
        externalReference: z.string().min(2).max(200),
        title: z.string().min(3).max(500),
        titleLanguage: z.string().max(5).nullable(),
        buyerName: z.string().max(300).nullable(),
        buyerCountry: z.string().max(3).nullable(),
        performanceNuts: z.array(z.string().regex(/^[A-Z]{2}[A-Z0-9]{0,3}$/i, "NUTS-code zoals BE21")),
        officialLanguages: z.array(z.enum(["NLD", "FRA", "ENG", "DEU"])),
        procedureType: z.string().max(200).nullable(),
        cpvCodes: z.array(z.string().regex(/^\d{8}(-\d)?$/, "CPV-code met 8 cijfers")),
        description: z.string().max(20000).nullable(),
        noticeKind,
        sourceUrl: urlOrNull,
        publicationDate: date,
      })
      .parse({
        sourceId: str(fd, "sourceId"),
        externalReference: str(fd, "externalReference"),
        title: str(fd, "title"),
        titleLanguage: optStr(fd, "titleLanguage"),
        buyerName: optStr(fd, "buyerName"),
        buyerCountry: optStr(fd, "buyerCountry"),
        performanceNuts: list(fd, "performanceNuts").map((s) => s.toUpperCase()),
        officialLanguages: fd.getAll("officialLanguages").map(String),
        procedureType: optStr(fd, "procedureType"),
        cpvCodes: list(fd, "cpvCodes"),
        description: optStr(fd, "description"),
        noticeKind: str(fd, "noticeKind"),
        sourceUrl: optStr(fd, "sourceUrl"),
        publicationDate: optStr(fd, "publicationDate"),
      });
    const id = await createManualProcedure(db, input, admin.id);
    return { redirect: `/admin/procedures/${id}`, message: "Opdracht aangemaakt. Voeg nu deadlines, voorwaarden en documenten toe." };
  });
}

export async function updateCoreAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    await db
      .update(procedure)
      .set({
        title: z.string().min(3).max(500).parse(str(fd, "title")),
        buyerName: optStr(fd, "buyerName"),
        performanceNuts: list(fd, "performanceNuts").map((s) => s.toUpperCase()),
        performanceCountries: list(fd, "performanceCountries").map((s) => s.toUpperCase()),
        officialLanguages: fd.getAll("officialLanguages").map(String),
        procedureType: optStr(fd, "procedureType"),
        cpvCodes: z.array(z.string().regex(/^\d{8}(-\d)?$/)).parse(list(fd, "cpvCodes")),
        description: optStr(fd, "description"),
      })
      .where(eq(procedure.id, id));
    await audit(db, { actorUserId: admin.id, action: "procedure.core_updated", entityType: "procedure", entityId: id });
    await refreshProcedure(db, id, { actorUserId: admin.id, reason: "kerngegevens bewerkt" });
    return "Kerngegevens opgeslagen.";
  });
}

export async function addNoticeAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    await addManualNotice(
      db,
      id,
      {
        kind: noticeKind.parse(str(fd, "kind")) as ManualNoticeKind,
        reference: z.string().min(2).parse(str(fd, "reference")),
        url: urlOrNull.parse(optStr(fd, "url")),
        publicationDate: date.parse(optStr(fd, "publicationDate")),
        changeDescription: optStr(fd, "changeDescription"),
      },
      admin.id,
    );
    return "Publicatie toegevoegd; beoordelingen zijn opnieuw ter controle gezet indien relevant.";
  });
}

export async function addLotAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    await upsertLot(db, id, { lotKey: z.string().min(1).max(40).parse(str(fd, "lotKey")), title: optStr(fd, "title"), description: optStr(fd, "description"), cpvCodes: list(fd, "cpvCodes") });
    await refreshProcedure(db, id, { actorUserId: admin.id, reason: "perceel gewijzigd" });
    return "Perceel opgeslagen.";
  });
}

const FACT_KEYS = ["submission_deadline", "participation_deadline", "questions_deadline", "estimated_value", "framework_max_value", "lot_value", "published_budget", "contract_duration", "place_of_performance"] as const;

export async function addFactAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const key = z.enum(FACT_KEYS).parse(str(fd, "key")) as FactKey;
    const raw = z.string().min(1).max(500).parse(str(fd, "rawValue"));
    const locator = z.string().min(2, "Vermeld het bronveld, de pagina of de sectie").max(300).parse(str(fd, "locator"));
    await setFact(
      db,
      {
        procedureId: id,
        lotId: optStr(fd, "lotId"),
        key,
        rawValue: raw,
        valueNumber: optNum(fd, "valueNumber"),
        unit: optStr(fd, "unit"),
        context: optStr(fd, "evidenceSnippet"),
        documentId: optStr(fd, "documentId"),
        locator,
        evidenceSnippet: optStr(fd, "evidenceSnippet"),
        extractionMethod: "manual",
        verificationStatus: fd.get("verified") === "on" ? "verified" : "unverified",
      },
      admin.id,
    );
    return "Feit opgeslagen.";
  });
}

export async function verifyFactAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    await setFactVerification(db, str(fd, "factId"), z.enum(["verified", "rejected", "unverified"]).parse(str(fd, "status")), admin.id);
    return "Verificatiestatus bijgewerkt.";
  });
}

export async function addRequirementAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const mandatory = str(fd, "mandatory");
    await addRequirement(
      db,
      {
        procedureId: id,
        lotId: optStr(fd, "lotId"),
        kind: z.enum(["exclusion", "selection", "award_criterion", "other"]).parse(str(fd, "kind")),
        category: z.enum(["reference", "certification", "financial", "language", "security_clearance", "staffing", "legal", "other"]).parse(str(fd, "category")),
        text: z.string().min(3).max(3000).parse(str(fd, "text")),
        language: optStr(fd, "language"),
        mandatory: mandatory === "yes" ? true : mandatory === "no" ? false : null,
        weight: optStr(fd, "weight"),
        consortiumBasis: z.enum(["documented", "not_allowed", "unknown"]).parse(str(fd, "consortiumBasis") || "unknown"),
        consortiumEvidence: optStr(fd, "consortiumEvidence"),
        documentId: optStr(fd, "documentId"),
        locator: z.string().min(2, "Vermeld de pagina, sectie of het bronveld").max(300).parse(str(fd, "locator")),
        evidenceSnippet: optStr(fd, "evidenceSnippet"),
        extractionMethod: "manual",
        verificationStatus: fd.get("verified") === "on" ? "verified" : "unverified",
      },
      admin.id,
    );
    return "Voorwaarde toegevoegd.";
  });
}

export async function updateRequirementAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const op = str(fd, "op");
    const reqId = str(fd, "requirementId");
    if (op === "verify") await updateRequirementStatus(db, reqId, { verificationStatus: "verified" }, admin.id);
    else if (op === "reject") await updateRequirementStatus(db, reqId, { verificationStatus: "rejected" }, admin.id);
    else if (op === "remove") await updateRequirementStatus(db, reqId, { superseded: true }, admin.id);
    else throw new Error("Onbekende bewerking");
    return "Voorwaarde bijgewerkt.";
  });
}

export async function uploadDocumentAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Kies een bestand.");
    const buf = Buffer.from(await file.arrayBuffer());
    const res = await storeDocument(db, { procedureId: id, filename: file.name, declaredType: file.type, buffer: buf, sourceUrl: optStr(fd, "sourceUrl") }, admin.id);
    if (res.duplicate) return "Dit document was al opgeladen (identieke inhoud).";
    const d = res.document;
    return d.textStatus === "ok" ? `Document opgeslagen: ${d.textStatusDetail}.` : `Document opgeslagen MAAR tekstextractie: ${d.textStatus} — ${d.textStatusDetail}`;
  });
}

export async function fetchDocumentAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const res = await fetchDocumentFromUrl(db, { procedureId: id, url: z.string().url().parse(str(fd, "url")) }, admin.id);
    return res.duplicate ? "Document was al aanwezig." : `Document opgehaald (${res.document.textStatus}).`;
  });
}

export async function runExtractionAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const r = await runExtraction(db, id, admin.id);
    if (r.reused) return "Bestaande extractie voor dezelfde documenten hergebruikt (geen nieuwe kosten).";
    if (r.run.status !== "success") throw new Error(`Extractie ${r.run.status}: ${r.run.errorMessage ?? (r.run.validationIssues ?? []).join("; ")}`);
    return "AI-extractie uitgevoerd. Alle geëxtraheerde gegevens staan op 'niet gecontroleerd' — verifieer ze.";
  });
}

export async function setSummaryAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const text = z.string().min(10).max(5000).parse(str(fd, "summaryNl"));
    const p = await db.query.procedure.findFirst({ where: eq(procedure.id, id) });
    await setSummary(db, id, { summaryNl: text, isTranslation: fd.get("isTranslation") === "on", method: p?.summaryMethod === "ai" && text === p.summaryNl ? "ai" : "manual", verified: fd.get("verified") === "on" }, admin.id);
    return "Samenvatting opgeslagen.";
  });
}

export async function setLifecycleAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const v = str(fd, "lifecycle");
    const val = v === "" ? null : (z.enum(["prior_information", "open", "awarded", "cancelled", "unknown"]).parse(v) as ProcedureLifecycle);
    if (val && !optStr(fd, "note")) throw new Error("Geef een toelichting (bron) voor een handmatige statuscorrectie.");
    await setLifecycleOverride(db, id, val, optStr(fd, "note"), admin.id);
    return "Status bijgewerkt.";
  });
}

export async function startAssessmentAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "procedureId");
  await runAction(`/admin/procedures/${id}`, async () => {
    const a = await createAssessmentVersion(db, { organizationId: z.uuid().parse(str(fd, "organizationId")), procedureId: id, actorUserId: admin.id });
    return { redirect: `/admin/beoordelingen/${a.id}`, message: "Conceptbeoordeling aangemaakt." };
  });
}
