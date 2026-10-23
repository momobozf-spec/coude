import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import { assessment, feedback, procedure, trackedOpportunity, fact, type FeedbackKind } from "@/db/schema";
import { opportunityState } from "@/lib/domain/lifecycle";
import { audit } from "@/lib/audit";
import { loadProcedureBundle } from "./procedures";

/**
 * Klantweergave. ALLE queries filteren op organizationId; publieke procedures worden alleen
 * getoond wanneer er een gepubliceerde beoordeling voor deze organisatie bestaat.
 */
export async function listClientOpportunities(database: DB, organizationId: string, now = new Date()) {
  const published = await database
    .select({ a: assessment, p: procedure })
    .from(assessment)
    .innerJoin(procedure, eq(procedure.id, assessment.procedureId))
    .where(and(eq(assessment.organizationId, organizationId), eq(assessment.status, "published")))
    .orderBy(desc(assessment.publishedAt));
  if (published.length === 0) return [];
  const procIds = published.map((r) => r.p.id);
  const [facts, pending, tracked, fb] = await Promise.all([
    database.select().from(fact).where(and(inArray(fact.procedureId, procIds), isNull(fact.supersededAt))),
    database
      .select({ procedureId: assessment.procedureId })
      .from(assessment)
      .where(and(eq(assessment.organizationId, organizationId), eq(assessment.isCurrent, true), inArray(assessment.status, ["draft", "to_review", "approved"]), inArray(assessment.procedureId, procIds))),
    database.select().from(trackedOpportunity).where(eq(trackedOpportunity.organizationId, organizationId)),
    database.select().from(feedback).where(eq(feedback.organizationId, organizationId)).orderBy(desc(feedback.createdAt)),
  ]);
  const pendingSet = new Set(pending.map((x) => x.procedureId));
  const trackedSet = new Set(tracked.map((t) => t.procedureId));
  return published.map(({ a, p }) => {
    const pf = facts.filter((f) => f.procedureId === p.id);
    const state = opportunityState(p, pf, now);
    const latestFeedback = fb.find((f) => f.procedureId === p.id) ?? null;
    return {
      assessment: a,
      procedure: p,
      state,
      changePending: a.stale || pendingSet.has(p.id),
      tracked: trackedSet.has(p.id),
      latestFeedback,
    };
  });
}

export async function getClientOpportunity(database: DB, organizationId: string, procedureId: string, now = new Date()) {
  const a = await database.query.assessment.findFirst({
    where: and(eq(assessment.organizationId, organizationId), eq(assessment.procedureId, procedureId), eq(assessment.status, "published")),
    orderBy: desc(assessment.version),
  });
  if (!a) return null; // geen gepubliceerde beoordeling voor deze organisatie ⇒ niet zichtbaar
  const bundle = await loadProcedureBundle(database, procedureId);
  if (!bundle) return null;
  const [newer, tracked, fb] = await Promise.all([
    database.query.assessment.findFirst({
      where: and(eq(assessment.organizationId, organizationId), eq(assessment.procedureId, procedureId), eq(assessment.isCurrent, true), inArray(assessment.status, ["draft", "to_review", "approved"])),
    }),
    database.query.trackedOpportunity.findFirst({ where: and(eq(trackedOpportunity.organizationId, organizationId), eq(trackedOpportunity.procedureId, procedureId)) }),
    database.select().from(feedback).where(and(eq(feedback.organizationId, organizationId), eq(feedback.procedureId, procedureId))).orderBy(desc(feedback.createdAt)),
  ]);
  return {
    assessment: a,
    bundle,
    state: opportunityState(bundle.procedure, bundle.facts, now),
    changePending: a.stale || !!newer,
    tracked: !!tracked,
    feedback: fb,
  };
}

async function assertPublishedFor(database: DB, organizationId: string, procedureId: string) {
  const a = await database.query.assessment.findFirst({
    where: and(eq(assessment.organizationId, organizationId), eq(assessment.procedureId, procedureId), eq(assessment.status, "published")),
  });
  if (!a) throw new Error("Geen toegang tot deze kans.");
  return a;
}

export async function recordFeedback(
  database: DB,
  input: { organizationId: string; procedureId: string; userId: string; kind: FeedbackKind; reason?: string | null },
) {
  const a = await assertPublishedFor(database, input.organizationId, input.procedureId);
  if (input.kind === "not_relevant" && !input.reason?.trim()) throw new Error("Geef een reden op bij 'niet relevant'.");
  await database.insert(feedback).values({
    organizationId: input.organizationId,
    procedureId: input.procedureId,
    assessmentId: a.id,
    userId: input.userId,
    kind: input.kind,
    reason: input.reason?.trim() || null,
  });
  if (input.kind === "interesting" || input.kind === "investigating" || input.kind === "bid_submitted") {
    await database
      .insert(trackedOpportunity)
      .values({ organizationId: input.organizationId, procedureId: input.procedureId, followedByUserId: input.userId })
      .onConflictDoNothing();
  }
  await audit(database, { actorUserId: input.userId, organizationId: input.organizationId, action: `feedback.${input.kind}`, entityType: "procedure", entityId: input.procedureId });
}

export async function setTracking(database: DB, input: { organizationId: string; procedureId: string; userId: string; follow: boolean }) {
  await assertPublishedFor(database, input.organizationId, input.procedureId);
  if (input.follow) {
    await database
      .insert(trackedOpportunity)
      .values({ organizationId: input.organizationId, procedureId: input.procedureId, followedByUserId: input.userId })
      .onConflictDoNothing();
  } else {
    await database
      .delete(trackedOpportunity)
      .where(and(eq(trackedOpportunity.organizationId, input.organizationId), eq(trackedOpportunity.procedureId, input.procedureId)));
  }
}

export const FEEDBACK_LABEL: Record<FeedbackKind, string> = {
  interesting: "Interessant",
  not_relevant: "Niet relevant",
  investigating: "Onderzoeken",
  bid_submitted: "Offerte ingediend",
  won: "Gewonnen",
  lost: "Verloren",
};
