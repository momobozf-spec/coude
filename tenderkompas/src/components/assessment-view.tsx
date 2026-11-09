import type { assessment as assessmentTable, ConditionAssessment } from "@/db/schema";
import type { ProcedureBundle } from "@/lib/services/procedures";
import type { Criterion, Feasibility, Blocker } from "@/lib/domain/assessment-engine";
import { Badge, Card, ConditionBadge, FactLabel, InterpretationLabel, Notice, Unknown, AdviceBadge } from "./ui";
import { Evidence } from "./evidence";
import { REQ_CATEGORY_LABEL, REQ_KIND_LABEL } from "@/lib/labels";

type Assessment = typeof assessmentTable.$inferSelect;
type Relevance = { score: number; knownScore: number | null; unknownCount: number; criteria: Criterion[]; disclaimer: string; adviceReason?: string };

const CRIT_TONE = { match: "ok", partial: "info", no_match: "bad", unknown: "warn" } as const;
const CRIT_LABEL = { match: "Past", partial: "Deels", no_match: "Past niet", unknown: "Onbekend" } as const;

export function AssessmentView({ a, bundle, docHref, audience }: { a: Assessment; bundle: ProcedureBundle; docHref?: (id: string) => string; audience: "admin" | "client" }) {
  const rel = a.relevance as Relevance;
  const feas = a.feasibility as Feasibility;
  const blockers = a.blockers as Blocker[];
  const conditions = a.conditions as ConditionAssessment[];
  const reqById = new Map(bundle.requirements.map((r) => [r.id, r]));
  const lotName = (id: string | null) => (id ? bundle.lots.find((l) => l.id === id)?.lotKey ?? "?" : "Alle percelen");
  const awardCriteria = bundle.requirements.filter((r) => !r.supersededAt && r.kind === "award_criterion" && r.verificationStatus !== "rejected" && r.verificationStatus !== "evidence_not_found");
  const hard = blockers.filter((b) => b.hard);
  const soft = blockers.filter((b) => !b.hard);

  return (
    <div className="space-y-5">
      <Card title="Eindadvies">
        <div className="flex flex-wrap items-center gap-3">
          <AdviceBadge advice={a.advice} />
          <InterpretationLabel />
        </div>
        {rel.adviceReason && <p className="mt-2 text-sm">{rel.adviceReason}</p>}
        {hard.length > 0 && (
          <div className="mt-3">
            <Notice tone="bad" title="Harde blokkades (gaan altijd voor op de relevantiescore)">
              <ul className="list-disc pl-5">{hard.map((b, i) => <li key={i}>{b.label}</li>)}</ul>
            </Notice>
          </div>
        )}
        {soft.length > 0 && (
          <div className="mt-3">
            <Notice tone="warn" title="Obstakels om te bevestigen">
              <ul className="list-disc pl-5">{soft.map((b, i) => <li key={i}>{b.label}</li>)}</ul>
            </Notice>
          </div>
        )}
        {(a.fitExplanation || a.obstaclesNote || a.nextAction) && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-md bg-navy-50 p-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase text-navy-800">Waarom deze kans past</div>{a.fitExplanation ?? <Unknown>niet ingevuld</Unknown>}</div>
            <div className="rounded-md bg-navy-50 p-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase text-navy-800">Obstakels en onbekenden</div>{a.obstaclesNote ?? <Unknown>niet ingevuld</Unknown>}</div>
            <div className="rounded-md bg-navy-50 p-3 text-sm"><div className="mb-1 text-xs font-semibold uppercase text-navy-800">Eerstvolgende aanbevolen actie</div>{a.nextAction ?? <Unknown>niet ingevuld</Unknown>}</div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2">A. Inhoudelijke aansluiting <InterpretationLabel /></span>}>
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <div className="text-3xl font-semibold text-navy-900">{rel.score}<span className="text-base text-muted">/100</span></div>
            <div className="text-xs text-muted">
              relevantiescore{rel.knownScore !== null && ` · ${rel.knownScore}/100 op gekende criteria`} · {rel.unknownCount} criterium/criteria onbekend
            </div>
          </div>
          <p className="mb-3 text-xs text-muted">{rel.disclaimer}</p>
          <table className="tk">
            <thead><tr><th>Criterium</th><th>Resultaat</th><th>Uitleg</th></tr></thead>
            <tbody>
              {rel.criteria.map((c) => (
                <tr key={c.key}>
                  <td className="whitespace-nowrap">{c.label}<div className="text-xs text-muted">gewicht {c.weight}</div></td>
                  <td><Badge tone={CRIT_TONE[c.result]}>{CRIT_LABEL[c.result]}</Badge></td>
                  <td className="text-xs">{c.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={<span className="flex items-center gap-2">C. Praktische haalbaarheid <InterpretationLabel /></span>}>
          <ul className="space-y-2 text-sm">
            <li>
              Voorbereidingstijd:{" "}
              {feas.daysToFirstDeadline === null ? <Unknown /> : <strong>{feas.daysToFirstDeadline} dag(en)</strong>}{" "}
              {feas.deadlineKind && <span className="text-muted">tot de {feas.deadlineKind === "participation" ? "deelnamedeadline" : "indieningsdeadline"}</span>}{" "}
              <Badge tone={feas.result === "ok" ? "ok" : feas.result === "tight" ? "warn" : feas.result === "insufficient" ? "bad" : "warn"}>
                {feas.result === "ok" ? "Voldoende" : feas.result === "tight" ? "Krap" : feas.result === "insufficient" ? "Onvoldoende" : "Onbekend"}
              </Badge>
            </li>
            <li>
              Capaciteit volgens profiel:{" "}
              <Badge tone={feas.capacity === "ok" ? "ok" : feas.capacity === "insufficient" ? "bad" : "warn"}>{feas.capacity === "ok" ? "Beschikbaar" : feas.capacity === "insufficient" ? "Geen" : "Onbekend"}</Badge>
            </li>
          </ul>
          {a.missingInfo.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-sm font-semibold text-navy-900">Ontbrekende of onzekere gegevens</div>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-warn-700">{a.missingInfo.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="B. Toelatings- en selectievoorwaarden">
        {conditions.length === 0 ? (
          <Notice tone="warn">Er zijn nog geen voorwaarden vastgelegd. Of het bedrijf voldoet, is daardoor onbekend.</Notice>
        ) : (
          <div className="overflow-x-auto">
            <table className="tk">
              <thead><tr><th>Voorwaarde <FactLabel /></th><th>Perceel</th><th>Status <InterpretationLabel /></th><th>Bronbewijs</th></tr></thead>
              <tbody>
                {conditions.map((c) => {
                  const r = reqById.get(c.requirementId);
                  if (!r) return null;
                  return (
                    <tr key={c.requirementId}>
                      <td className="max-w-md">
                        <div className="text-xs text-muted">{REQ_KIND_LABEL[r.kind]} · {REQ_CATEGORY_LABEL[r.category]} · {r.mandatory === true ? "verplicht" : r.mandatory === false ? "niet verplicht" : "verplicht karakter onduidelijk"}</div>
                        <div className="text-sm">{r.text}</div>
                        {r.consortiumBasis === "documented" && <div className="mt-1 text-xs text-info-700">Bron laat samenwerking/beroep op derden toe{r.consortiumEvidence ? `: “${r.consortiumEvidence}”` : ""}</div>}
                      </td>
                      <td className="text-xs">{lotName(r.lotId)}</td>
                      <td className="text-xs">
                        <ConditionBadge status={c.status} />
                        <div className="mt-1 text-muted">{c.basis === "explicit_source" ? "Rechtstreeks uit bron vs. profiel" : "Onze interpretatie"}</div>
                        {c.note && <div className="mt-1">{c.note}</div>}
                        {audience === "admin" && c.suggestedStatus && c.status === "unknown" && <div className="mt-1 text-info-700">Suggestie (niet toegepast): {c.suggestedStatus} — {c.suggestionReason}</div>}
                      </td>
                      <td className="max-w-xs"><Evidence item={r} docs={bundle.documents} notices={bundle.notices} docHref={docHref} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {awardCriteria.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">Gunningscriteria <span className="text-xs font-normal text-muted">(los van de toelatingsvoorwaarden)</span></div>
            <table className="tk">
              <thead><tr><th>Criterium</th><th>Perceel</th><th>Gewicht</th><th>Bron</th></tr></thead>
              <tbody>
                {awardCriteria.map((r) => (
                  <tr key={r.id}>
                    <td className="text-sm">{r.text}</td>
                    <td className="text-xs">{lotName(r.lotId)}</td>
                    <td className="text-xs">{r.weight ?? <Unknown />}</td>
                    <td className="max-w-xs"><Evidence item={r} docs={bundle.documents} notices={bundle.notices} docHref={docHref} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
