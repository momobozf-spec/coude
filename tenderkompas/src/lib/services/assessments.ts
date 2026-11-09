import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { DB } from "@/db";
import {
  assessment,
  companyProfile,
  organization,
  procedure,
  reviewDecision,
  scoringConfig,
  type AssessmentStatus,
  type ConditionAssessment,
} from "@/db/schema";
import { runAssessment, type EngineProfile, type EngineResult } from "@/lib/domain/assessment-engine";
import { DEFAULT_SCORING_CONFIG, scoringConfigSchema, type ScoringConfig } from "@/lib/domain/scoring-config";
import { canTransition, checkPublishable } from "@/lib/domain/publication";
import { audit } from "@/lib/audit";
import { loadProcedureBundle, type ProcedureBundle } from "./procedures";

export async function getActiveScoringConfig(database: DB): Promise<{ version: number; config: ScoringConfig }> {
  const row = await database.query.scoringConfig.findFirst({ where: eq(scoringConfig.active, true), orderBy: desc(scoringConfig.version) });
  if (row) return { version: row.version, config: scoringConfigSchema.parse(row.config) };
  await database
    .insert(scoringConfig)
    .values({ version: 1, config: DEFAULT_SCORING_CONFIG, active: true, note: "Standaardconfiguratie" })
    .onConflictDoNothing();
  return { version: 1, config: DEFAULT_SCORING_CONFIG };
}

export async function saveScoringConfig(database: DB, config: ScoringConfig, note: string, actorUserId: string) {
  const parsed = scoringConfigSchema.parse(config);
  const current = await getActiveScoringConfig(database);
  const version = current.version + 1;
  await database.transaction(async (tx) => {
    await tx.update(scoringConfig).set({ active: false }).where(eq(scoringConfig.active, true));
    await tx.insert(scoringConfig).values({ version, config: parsed, active: true, note });
  });
  await audit(database, { actorUserId, action: "scoring_config.saved", entityType: "scoring_config", entityId: String(version) });
  return version;
}

export function profileToEngine(p: typeof companyProfile.$inferSelect): EngineProfile {
  const num = (v: string | null) => (v === null || v === undefined ? null : Number(v));
  return {
    services: p.services,
    technologies: p.technologies,
    excludedWork: p.excludedWork,
    languages: p.languages,
    regions: p.regions,
    teamSize: p.teamSize,
    availableCapacityFte: num(p.availableCapacityFte),
    contractValueMinEur: num(p.contractValueMinEur),
    contractValueMaxEur: num(p.contractValueMaxEur),
    openToConsortium: p.openToConsortium,
    certifications: p.certifications,
  };
}

export function bundleToEngine(b: ProcedureBundle) {
  return {
    procedure: {
      title: b.procedure.title,
      description: b.procedure.description,
      summaryNl: b.procedure.summaryNl,
      cpvCodes: b.procedure.cpvCodes,
      officialLanguages: b.procedure.officialLanguages,
      performanceNuts: b.procedure.performanceNuts,
      performanceCountries: b.procedure.performanceCountries,
      lifecycle: b.procedure.lifecycle,
      lifecycleOverride: b.procedure.lifecycleOverride ?? null,
      lots: b.lots.map((l) => ({ id: l.id, lotKey: l.lotKey, title: l.title, description: l.description, cpvCodes: l.cpvCodes })),
    },
    facts: b.facts.map((f) => ({
      id: f.id,
      key: f.key,
      lotId: f.lotId,
      valueInstant: f.valueInstant,
      valueDate: f.valueDate,
      supersededAt: f.supersededAt,
      valueNumber: f.valueNumber === null ? null : Number(f.valueNumber),
      unit: f.unit,
      rawValue: f.rawValue,
      timeKnown: f.timeKnown,
      timezoneKnown: f.timezoneKnown,
      verificationStatus: f.verificationStatus,
    })),
    requirements: b.requirements.map((r) => ({
      id: r.id,
      lotId: r.lotId,
      kind: r.kind,
      category: r.category,
      text: r.text,
      mandatory: r.mandatory,
      consortiumBasis: r.consortiumBasis,
      verificationStatus: r.verificationStatus,
      supersededAt: r.supersededAt,
    })),
    documents: b.documents.map((d) => ({ id: d.id, filename: d.filename, textStatus: d.textStatus })),
  };
}

async function evaluate(database: DB, organizationId: string, procedureId: string, conditionInputs: ConditionAssessment[], now = new Date()) {
  const [org, profile, bundle, cfg] = await Promise.all([
    database.query.organization.findFirst({ where: eq(organization.id, organizationId) }),
    database.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, organizationId) }),
    loadProcedureBundle(database, procedureId),
    getActiveScoringConfig(database),
  ]);
  if (!org) throw new Error("Organisatie niet gevonden");
  if (!profile) throw new Error("Bedrijfsprofiel ontbreekt; vul eerst het profiel in.");
  if (!bundle) throw new Error("Procedure niet gevonden");
  if (bundle.procedure.isDemo !== org.isDemo) throw new Error("Demogegevens en live gegevens mogen niet gemengd worden.");
  const e = bundleToEngine(bundle);
  const result = runAssessment({
    profile: profileToEngine(profile),
    procedure: e.procedure,
    facts: e.facts,
    requirements: e.requirements,
    documents: e.documents,
    conditionInputs,
    config: cfg.config,
    now,
  });
  return { result, profile, bundle, cfg };
}

function resultColumns(result: EngineResult) {
  return {
    relevanceScore: result.relevance.score,
    relevance: { ...result.relevance, adviceReason: result.adviceReason, criticalMissing: result.criticalMissing },
    conditions: result.conditions,
    feasibility: result.feasibility,
    blockers: result.blockers,
    missingInfo: result.missingInfo,
    advice: result.advice,
  };
}

/** Maakt een nieuwe versie (concept) aan voor organisatie × procedure. */
export async function createAssessmentVersion(
  database: DB,
  input: {
    organizationId: string;
    procedureId: string;
    actorUserId: string | null;
    status?: "draft" | "to_review";
    carryOver?: { conditions: ConditionAssessment[]; fitExplanation: string | null; obstaclesNote: string | null; nextAction: string | null };
    staleNoteForPrevious?: string;
  },
) {
  const { result, profile, bundle, cfg } = await evaluate(database, input.organizationId, input.procedureId, input.carryOver?.conditions ?? []);
  return database.transaction(async (tx) => {
    const prev = await tx
      .select()
      .from(assessment)
      .where(and(eq(assessment.organizationId, input.organizationId), eq(assessment.procedureId, input.procedureId)))
      .orderBy(desc(assessment.version));
    const version = (prev[0]?.version ?? 0) + 1;
    for (const p of prev.filter((x) => x.isCurrent)) {
      if (p.status === "published") {
        // Blijft zichtbaar voor de klant, met melding dat een wijziging gecontroleerd wordt.
        await tx
          .update(assessment)
          .set({ isCurrent: false, stale: !!input.staleNoteForPrevious || p.stale, staleReason: input.staleNoteForPrevious ?? p.staleReason })
          .where(eq(assessment.id, p.id));
      } else {
        await tx.update(assessment).set({ isCurrent: false, status: "superseded" }).where(eq(assessment.id, p.id));
      }
    }
    const [row] = await tx
      .insert(assessment)
      .values({
        organizationId: input.organizationId,
        procedureId: input.procedureId,
        version,
        status: input.status ?? "draft",
        isCurrent: true,
        scoringConfigVersion: cfg.version,
        profileVersion: profile.version,
        procedureFingerprint: bundle.procedure.fingerprint,
        ...resultColumns(result),
        fitExplanation: input.carryOver?.fitExplanation ?? null,
        obstaclesNote: input.carryOver?.obstaclesNote ?? null,
        nextAction: input.carryOver?.nextAction ?? null,
        createdByUserId: input.actorUserId,
      })
      .returning();
    await audit(tx as unknown as DB, {
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      action: "assessment.version_created",
      entityType: "assessment",
      entityId: row.id,
      details: { version, advice: row.advice },
    });
    return row;
  });
}

/** Werkt voorwaarden en redactionele teksten bij; herberekent het advies. Goedkeuring vervalt bij wijziging. */
export async function updateAssessmentInputs(
  database: DB,
  assessmentId: string,
  input: { conditions: ConditionAssessment[]; fitExplanation: string | null; obstaclesNote: string | null; nextAction: string | null },
  actorUserId: string,
) {
  const a = await database.query.assessment.findFirst({ where: eq(assessment.id, assessmentId) });
  if (!a) throw new Error("Beoordeling niet gevonden");
  if (!a.isCurrent) throw new Error("Alleen de huidige versie kan bewerkt worden.");
  if (a.status === "published") {
    // Gepubliceerde versie nooit in-place wijzigen: nieuwe versie.
    return createAssessmentVersion(database, {
      organizationId: a.organizationId,
      procedureId: a.procedureId,
      actorUserId,
      status: "to_review",
      carryOver: input,
    });
  }
  const { result, profile, bundle, cfg } = await evaluate(database, a.organizationId, a.procedureId, input.conditions);
  const [row] = await database
    .update(assessment)
    .set({
      ...resultColumns(result),
      fitExplanation: input.fitExplanation,
      obstaclesNote: input.obstaclesNote,
      nextAction: input.nextAction,
      scoringConfigVersion: cfg.version,
      profileVersion: profile.version,
      procedureFingerprint: bundle.procedure.fingerprint,
      stale: false,
      staleReason: null,
      ...(a.status === "approved" ? { status: "to_review" as const, approvedAt: null, approvedByUserId: null } : {}),
    })
    .where(eq(assessment.id, assessmentId))
    .returning();
  await audit(database, { actorUserId, organizationId: a.organizationId, action: "assessment.updated", entityType: "assessment", entityId: assessmentId });
  return row;
}

export async function transitionAssessment(
  database: DB,
  assessmentId: string,
  to: AssessmentStatus,
  actorUserId: string,
  comment?: string | null,
) {
  const a = await database.query.assessment.findFirst({ where: eq(assessment.id, assessmentId) });
  if (!a) throw new Error("Beoordeling niet gevonden");
  if (!a.isCurrent && to !== "superseded") throw new Error("Er bestaat een nieuwere versie; werk die bij.");
  if (!canTransition(a.status, to)) throw new Error(`Overgang ${a.status} → ${to} is niet toegestaan.`);

  const now = new Date();
  if (to === "approved") {
    const p = await database.query.procedure.findFirst({ where: eq(procedure.id, a.procedureId) });
    if (!p || p.fingerprint !== a.procedureFingerprint) throw new Error("Brongegevens zijn gewijzigd; herbereken eerst de beoordeling.");
  }
  if (to === "published") {
    const [p, org, profile] = await Promise.all([
      database.query.procedure.findFirst({ where: eq(procedure.id, a.procedureId) }),
      database.query.organization.findFirst({ where: eq(organization.id, a.organizationId) }),
      database.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, a.organizationId) }),
    ]);
    const check = checkPublishable({
      assessment: a,
      procedureFingerprint: p?.fingerprint ?? "",
      currentProfileVersion: profile?.version ?? -1,
      procedureIsDemo: p?.isDemo ?? false,
      organizationIsDemo: org?.isDemo ?? false,
    });
    if (!check.ok) throw new Error(`Publicatie geweigerd: ${check.reasons.join(" ")}`);
  }

  await database.transaction(async (tx) => {
    if (to === "published") {
      // Vorige gepubliceerde versie(s) vervangen.
      await tx
        .update(assessment)
        .set({ status: "superseded", stale: false })
        .where(
          and(
            eq(assessment.organizationId, a.organizationId),
            eq(assessment.procedureId, a.procedureId),
            eq(assessment.status, "published"),
            ne(assessment.id, a.id),
          ),
        );
    }
    await tx
      .update(assessment)
      .set({
        status: to,
        ...(to === "approved" ? { approvedAt: now, approvedByUserId: actorUserId } : {}),
        ...(to === "published" ? { publishedAt: now } : {}),
        ...(to === "to_review" || to === "draft" ? { approvedAt: null, approvedByUserId: null } : {}),
      })
      .where(eq(assessment.id, a.id));
    const decision = { to_review: "submit", approved: "approve", rejected: "reject", published: "publish", draft: "reopen", superseded: "supersede" }[to];
    await tx.insert(reviewDecision).values({ assessmentId: a.id, reviewerUserId: actorUserId, decision, comment: comment ?? null });
  });
  await audit(database, { actorUserId, organizationId: a.organizationId, action: `assessment.${to}`, entityType: "assessment", entityId: a.id });
}

/**
 * Bij een bronwijziging: elke organisatie met een actieve beoordeling krijgt een nieuwe versie "te controleren".
 * Eerdere goedkeuring vervalt; een gepubliceerde versie blijft zichtbaar met wijzigingsmelding.
 */
export async function reassessProcedure(database: DB, procedureId: string, ctx: { reason: string; actorUserId: string | null }) {
  const current = await database
    .select()
    .from(assessment)
    .where(and(eq(assessment.procedureId, procedureId), eq(assessment.isCurrent, true), inArray(assessment.status, ["draft", "to_review", "approved", "published"])));
  const results = [];
  for (const a of current) {
    results.push(
      await createAssessmentVersion(database, {
        organizationId: a.organizationId,
        procedureId,
        actorUserId: ctx.actorUserId,
        status: "to_review",
        carryOver: { conditions: a.conditions, fitExplanation: a.fitExplanation, obstaclesNote: a.obstaclesNote, nextAction: a.nextAction },
        staleNoteForPrevious: ctx.reason,
      }),
    );
  }
  return results;
}

/** Na een profielwijziging: actieve beoordelingen van deze organisatie herberekenen. */
export async function reassessOrganization(database: DB, organizationId: string, actorUserId: string | null) {
  const current = await database
    .select()
    .from(assessment)
    .where(and(eq(assessment.organizationId, organizationId), eq(assessment.isCurrent, true), inArray(assessment.status, ["draft", "to_review", "approved", "published"])));
  for (const a of current) {
    await createAssessmentVersion(database, {
      organizationId,
      procedureId: a.procedureId,
      actorUserId,
      status: "to_review",
      carryOver: { conditions: a.conditions, fitExplanation: a.fitExplanation, obstaclesNote: a.obstaclesNote, nextAction: a.nextAction },
      staleNoteForPrevious: "Bedrijfsprofiel gewijzigd",
    });
  }
}
