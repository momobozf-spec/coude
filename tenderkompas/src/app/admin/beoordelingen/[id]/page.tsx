import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assessment, companyProfile, organization, reviewDecision, user, type ConditionAssessment } from "@/db/schema";
import { loadProcedureBundle } from "@/lib/services/procedures";
import { AssessmentView } from "@/components/assessment-view";
import { AssessmentStatusBadge, Badge, Card, Field, Flash, Notice, PageTitle, btn, CONDITION_LABEL } from "@/components/ui";
import { REQ_KIND_LABEL } from "@/lib/labels";
import { formatBrussels } from "@/lib/time";
import { checkPublishable, STATUS_LABEL } from "@/lib/domain/publication";
import { recalculateAction, saveAssessmentAction, transitionAction } from "../actions";

export const metadata = { title: "Beoordeling" };

export default async function AssessmentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const a = await db.query.assessment.findFirst({ where: eq(assessment.id, id) });
  if (!a) notFound();
  const [bundle, org, profile, versions, decisions] = await Promise.all([
    loadProcedureBundle(db, a.procedureId),
    db.query.organization.findFirst({ where: eq(organization.id, a.organizationId) }),
    db.query.companyProfile.findFirst({ where: eq(companyProfile.organizationId, a.organizationId) }),
    db.select().from(assessment).where(and(eq(assessment.organizationId, a.organizationId), eq(assessment.procedureId, a.procedureId))).orderBy(desc(assessment.version)),
    db
      .select({ d: reviewDecision, email: user.email })
      .from(reviewDecision)
      .leftJoin(user, eq(user.id, reviewDecision.reviewerUserId))
      .where(inArray(reviewDecision.assessmentId, (await db.select({ id: assessment.id }).from(assessment).where(and(eq(assessment.organizationId, a.organizationId), eq(assessment.procedureId, a.procedureId)))).map((x) => x.id)))
      .orderBy(desc(reviewDecision.createdAt)),
  ]);
  if (!bundle || !org) notFound();
  const editable = a.isCurrent && ["draft", "to_review", "approved", "published"].includes(a.status);
  const fpChanged = bundle.procedure.fingerprint !== a.procedureFingerprint;
  const profileChanged = (profile?.version ?? -1) !== a.profileVersion;
  const pub = checkPublishable({
    assessment: { ...a, status: "approved" },
    procedureFingerprint: bundle.procedure.fingerprint,
    currentProfileVersion: profile?.version ?? -1,
    procedureIsDemo: bundle.procedure.isDemo,
    organizationIsDemo: org.isDemo,
  });
  const conds = a.conditions as ConditionAssessment[];
  const reqById = new Map(bundle.requirements.map((r) => [r.id, r]));
  const hidden = <input type="hidden" name="assessmentId" value={a.id} />;

  return (
    <div className="space-y-5">
      <PageTitle
        title={<Link href={`/admin/procedures/${bundle.procedure.id}`} className="hover:underline">{bundle.procedure.title}</Link>}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Klant: <Link className="underline" href={`/admin/klanten/${org.id}`}>{org.name}</Link> · versie {a.version} <AssessmentStatusBadge status={a.status} />
            {!a.isCurrent && <Badge tone="neutral">niet de huidige versie</Badge>}
            <span className="text-xs">regels v{a.scoringConfigVersion} · profiel v{a.profileVersion}</span>
          </span>
        }
      />
      <Flash searchParams={sp} />
      {a.stale && <Notice tone="warn" title="Bronwijziging na publicatie">{a.staleReason}. De klant ziet deze versie met de melding dat een wijziging gecontroleerd wordt.</Notice>}
      {(fpChanged || profileChanged) && a.isCurrent && (
        <Notice tone="warn" title="Niet meer actueel">
          {fpChanged && "Brongegevens zijn gewijzigd sinds deze berekening. "}
          {profileChanged && "Het bedrijfsprofiel is gewijzigd. "}
          Herbereken voor goedkeuring of publicatie.
        </Notice>
      )}

      <Card title="Workflow">
        <div className="flex flex-wrap items-center gap-2">
          {a.isCurrent && a.status === "draft" && <T id={a.id} to="to_review" label="Ter controle aanbieden" kind="primary" />}
          {a.isCurrent && a.status === "to_review" && (
            <>
              <T id={a.id} to="approved" label="Goedkeuren" kind="primary" />
              <T id={a.id} to="rejected" label="Afwijzen" kind="danger" />
              <T id={a.id} to="draft" label="Terug naar concept" />
            </>
          )}
          {a.isCurrent && a.status === "approved" && (
            <>
              <T id={a.id} to="published" label="Publiceren naar klantportaal" kind="primary" />
              <T id={a.id} to="to_review" label="Goedkeuring intrekken" />
            </>
          )}
          {a.isCurrent && a.status === "rejected" && <T id={a.id} to="draft" label="Heropenen als concept" />}
          <form action={recalculateAction} className="inline">{hidden}<button className={btn("secondary", "sm")}>Herberekenen (nieuwe versie)</button></form>
        </div>
        {a.status === "approved" && !pub.ok && <div className="mt-3"><Notice tone="bad" title="Publicatie zal geweigerd worden">{pub.reasons.join(" ")}</Notice></div>}
      </Card>

      <AssessmentView a={a} bundle={bundle} docHref={(d) => `/api/documents/${d}`} audience="admin" />

      {editable && (
        <Card title="Voorwaarden toetsen en toelichting schrijven">
          <p className="mb-3 text-sm text-muted">
            Status per voorwaarde: voldaan, niet voldaan, onbekend of niet van toepassing. “Onbekend” blijft onbekend tot u het expliciet wijzigt; suggesties worden nooit automatisch overgenomen.
            {a.status === "approved" && " Opslaan trekt de goedkeuring in."}
            {a.status === "published" && " Opslaan maakt een nieuwe versie; de gepubliceerde versie blijft tot de nieuwe gepubliceerd is."}
          </p>
          <form action={saveAssessmentAction} className="space-y-4">
            {hidden}
            {conds.length > 0 && (
              <table className="tk">
                <thead><tr><th>Voorwaarde</th><th>Status</th><th>Basis</th><th>Toelichting</th></tr></thead>
                <tbody>
                  {conds.map((c) => {
                    const r = reqById.get(c.requirementId);
                    return (
                      <tr key={c.requirementId}>
                        <td className="max-w-md text-sm">
                          <input type="hidden" name="reqId" value={c.requirementId} />
                          <div className="text-xs text-muted">{r ? REQ_KIND_LABEL[r.kind] : ""}</div>
                          {r?.text}
                          {c.suggestedStatus && c.status === "unknown" && <div className="mt-1 text-xs text-info-700">Suggestie: {CONDITION_LABEL[c.suggestedStatus]} — {c.suggestionReason}</div>}
                        </td>
                        <td>
                          <select name={`status_${c.requirementId}`} defaultValue={c.status}>
                            {Object.entries(CONDITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </td>
                        <td>
                          <select name={`basis_${c.requirementId}`} defaultValue={c.basis}>
                            <option value="explicit_source">Expliciet uit bron vs. profiel</option>
                            <option value="interpretation">Onze interpretatie</option>
                          </select>
                        </td>
                        <td><input type="text" name={`note_${c.requirementId}`} defaultValue={c.note ?? ""} placeholder="bv. referentie X uit profiel" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Waarom deze kans past"><textarea name="fitExplanation" defaultValue={a.fitExplanation ?? ""} /></Field>
              <Field label="Concrete obstakels en onbekende gegevens"><textarea name="obstaclesNote" defaultValue={a.obstaclesNote ?? ""} /></Field>
              <Field label="Eerstvolgende aanbevolen actie"><textarea name="nextAction" defaultValue={a.nextAction ?? ""} /></Field>
            </div>
            <button className={btn("primary")}>Opslaan en herberekenen</button>
          </form>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Versies">
          <table className="tk">
            <thead><tr><th>Versie</th><th>Status</th><th>Advies</th><th>Aangemaakt</th></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className={v.id === a.id ? "bg-navy-50" : ""}>
                  <td><Link className="underline" href={`/admin/beoordelingen/${v.id}`}>v{v.version}</Link>{v.isCurrent && " (huidig)"}</td>
                  <td><AssessmentStatusBadge status={v.status} />{v.stale && <Badge tone="warn">bronwijziging</Badge>}</td>
                  <td className="text-xs">{v.advice}</td>
                  <td className="text-xs">{formatBrussels(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Reviewbesluiten">
          {decisions.length === 0 ? <p className="text-sm text-muted">Nog geen besluiten.</p> : (
            <ul className="space-y-1.5 text-sm">
              {decisions.map(({ d, email }) => (
                <li key={d.id}>{formatBrussels(d.createdAt)} — <strong>{d.decision}</strong> door {email ?? "onbekend"}{d.comment ? `: ${d.comment}` : ""}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Statussen: {Object.values(STATUS_LABEL).join(" · ")}</p>
        </Card>
      </div>
    </div>
  );
}

function T({ id, to, label, kind = "secondary" }: { id: string; to: string; label: string; kind?: "primary" | "secondary" | "danger" }) {
  return (
    <form action={transitionAction} className="inline">
      <input type="hidden" name="assessmentId" value={id} />
      <input type="hidden" name="to" value={to} />
      <button className={btn(kind, "sm")}>{label}</button>
    </form>
  );
}
