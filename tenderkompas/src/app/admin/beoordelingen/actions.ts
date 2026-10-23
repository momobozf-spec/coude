"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessment, type ConditionAssessment } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { optStr, runAction, str } from "@/lib/action-helpers";
import { createAssessmentVersion, transitionAssessment, updateAssessmentInputs } from "@/lib/services/assessments";

const condStatus = z.enum(["met", "not_met", "unknown", "not_applicable"]);
const basis = z.enum(["explicit_source", "interpretation"]);

export async function saveAssessmentAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "assessmentId");
  await runAction(`/admin/beoordelingen/${id}`, async () => {
    const reqIds = fd.getAll("reqId").map(String);
    const conditions: ConditionAssessment[] = reqIds.map((rid) => ({
      requirementId: rid,
      status: condStatus.parse(str(fd, `status_${rid}`)),
      basis: basis.parse(str(fd, `basis_${rid}`) || "interpretation"),
      note: optStr(fd, `note_${rid}`),
    }));
    const row = await updateAssessmentInputs(
      db,
      id,
      { conditions, fitExplanation: optStr(fd, "fitExplanation"), obstaclesNote: optStr(fd, "obstaclesNote"), nextAction: optStr(fd, "nextAction") },
      admin.id,
    );
    if (row.id !== id) return { redirect: `/admin/beoordelingen/${row.id}`, message: "Nieuwe versie aangemaakt (de gepubliceerde versie blijft ongewijzigd tot publicatie)." };
    return "Beoordeling opgeslagen en herberekend.";
  });
}

export async function transitionAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "assessmentId");
  await runAction(`/admin/beoordelingen/${id}`, async () => {
    const to = z.enum(["to_review", "approved", "rejected", "published", "draft"]).parse(str(fd, "to"));
    await transitionAssessment(db, id, to, admin.id, optStr(fd, "comment"));
    return { to_review: "Ter controle gezet.", approved: "Goedgekeurd.", rejected: "Afgewezen.", published: "Gepubliceerd in het klantportaal.", draft: "Terug naar concept." }[to];
  });
}

export async function recalculateAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "assessmentId");
  await runAction(`/admin/beoordelingen/${id}`, async () => {
    const a = await db.query.assessment.findFirst({ where: eq(assessment.id, id) });
    if (!a) throw new Error("Niet gevonden");
    const n = await createAssessmentVersion(db, {
      organizationId: a.organizationId,
      procedureId: a.procedureId,
      actorUserId: admin.id,
      status: "draft",
      carryOver: { conditions: a.conditions, fitExplanation: a.fitExplanation, obstaclesNote: a.obstaclesNote, nextAction: a.nextAction },
      staleNoteForPrevious: a.status === "published" ? "Herberekening gestart door beheerder" : undefined,
    });
    return { redirect: `/admin/beoordelingen/${n.id}`, message: "Nieuwe versie berekend op de actuele bron- en profielgegevens." };
  });
}
