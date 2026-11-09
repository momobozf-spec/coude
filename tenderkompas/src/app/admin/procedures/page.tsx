import Link from "next/link";
import { desc, isNull, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { assessment, fact, procedure } from "@/db/schema";
import { Badge, ButtonLink, Card, Empty, Flash, LifecycleBadge, PageTitle } from "@/components/ui";
import { effectiveLifecycle, opportunityState } from "@/lib/domain/lifecycle";
import { isPotentiallyRelevant } from "@/lib/domain/catalog";
import { describeDeadline, deadlineComparable } from "@/lib/time";
import { SOURCE_LABEL } from "@/lib/labels";

export const metadata = { title: "Opdrachten" };

const FILTERS = [
  { key: "relevant", label: "Potentieel relevant" },
  { key: "open", label: "Open inschrijving" },
  { key: "all", label: "Alles" },
  { key: "demo", label: "Demo" },
] as const;

export default async function Procedures({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filter = (sp.filter ?? "relevant") as (typeof FILTERS)[number]["key"];
  const procs = await db.select().from(procedure).orderBy(desc(procedure.updatedAt)).limit(500);
  const ids = procs.map((p) => p.id);
  const [facts, assessments] = ids.length
    ? await Promise.all([
        db.select().from(fact).where(and(inArray(fact.procedureId, ids), isNull(fact.supersededAt))),
        db.select({ procedureId: assessment.procedureId, status: assessment.status }).from(assessment).where(inArray(assessment.procedureId, ids)),
      ])
    : [[], []];
  const now = new Date();
  const rows = procs
    .map((p) => {
      const pf = facts.filter((f) => f.procedureId === p.id);
      const state = opportunityState(p, pf, now);
      const rel = isPotentiallyRelevant({ cpvCodes: p.cpvCodes, text: [p.title, p.description, p.summaryNl].filter(Boolean).join(" ") });
      const deadlines = pf
        .filter((f) => f.key === "submission_deadline" || f.key === "participation_deadline")
        .map((f) => ({ f, at: deadlineComparable(f) }))
        .filter((x) => x.at && x.at > now)
        .sort((a, b) => a.at!.getTime() - b.at!.getTime());
      return { p, state, rel, next: deadlines[0]?.f ?? null, nAssess: assessments.filter((a) => a.procedureId === p.id).length };
    })
    .filter((r) =>
      filter === "all" ? !r.p.isDemo : filter === "demo" ? r.p.isDemo : filter === "open" ? !r.p.isDemo && r.state.open : !r.p.isDemo && r.rel.relevant,
    );

  return (
    <div>
      <PageTitle
        title="Opdrachten"
        subtitle="Gedeelde publieke brongegevens. Klantvertrouwelijke beoordelingen staan apart per klant."
        actions={<ButtonLink href="/admin/procedures/nieuw">Handmatig invoeren</ButtonLink>}
      />
      <Flash searchParams={sp} />
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/procedures?filter=${f.key}`} className={`rounded-full border px-3 py-1 text-sm ${filter === f.key ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>
            {f.label}
          </Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty>Geen opdrachten in deze selectie.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tk">
              <thead>
                <tr><th>Opdracht</th><th>Bron</th><th>Status</th><th>Eerstvolgende deadline</th><th>Relevantie (prefilter)</th><th>Beoord.</th></tr>
              </thead>
              <tbody>
                {rows.map(({ p, state, rel, next, nAssess }) => {
                  const d = next ? describeDeadline(next) : null;
                  return (
                    <tr key={p.id}>
                      <td className="max-w-md">
                        <Link href={`/admin/procedures/${p.id}`} className="font-medium text-navy-800 hover:underline">{p.title}</Link>
                        <div className="text-xs text-muted">{p.buyerName ?? "opdrachtgever onbekend"}</div>
                      </td>
                      <td className="whitespace-nowrap text-xs">{SOURCE_LABEL[p.sourceId] ?? p.sourceId}</td>
                      <td>
                        <LifecycleBadge lifecycle={effectiveLifecycle(p)} />
                        {!state.open && state.reason === "expired" && <div className="mt-1"><Badge tone="neutral">verlopen</Badge></div>}
                      </td>
                      <td className="text-xs">{d ? <>{d.label}{d.caveat && <div className="text-warn-700">{d.caveat}</div>}</> : <span className="text-warn-700">onbekend</span>}</td>
                      <td className="max-w-xs text-xs text-muted">{rel.relevant ? rel.reasons.slice(0, 2).join("; ") : "—"}</td>
                      <td className="text-center">{nAssess}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
