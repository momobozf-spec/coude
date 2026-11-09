import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { assessment, organization, procedure } from "@/db/schema";
import { AdviceBadge, AssessmentStatusBadge, Badge, Card, Empty, Flash, PageTitle } from "@/components/ui";
import { formatBrussels } from "@/lib/time";

export const metadata = { title: "Reviews" };

const FILTERS = [
  { key: "open", label: "Te behandelen" },
  { key: "stale", label: "Gepubliceerd met bronwijziging" },
  { key: "published", label: "Gepubliceerd" },
  { key: "all", label: "Alle huidige" },
] as const;

export default async function Reviews({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filter = (sp.filter ?? "open") as (typeof FILTERS)[number]["key"];
  const where =
    filter === "open"
      ? and(eq(assessment.isCurrent, true), inArray(assessment.status, ["draft", "to_review", "approved"]))
      : filter === "stale"
        ? and(eq(assessment.status, "published"), eq(assessment.stale, true))
        : filter === "published"
          ? eq(assessment.status, "published")
          : eq(assessment.isCurrent, true);
  const rows = await db
    .select({ a: assessment, p: procedure, o: organization })
    .from(assessment)
    .innerJoin(procedure, eq(procedure.id, assessment.procedureId))
    .innerJoin(organization, eq(organization.id, assessment.organizationId))
    .where(where)
    .orderBy(desc(assessment.updatedAt))
    .limit(300);
  return (
    <div>
      <PageTitle title="Reviews" subtitle="Workflow: concept → te controleren → goedgekeurd → gepubliceerd. Alleen goedgekeurde, actuele beoordelingen bereiken klanten." />
      <Flash searchParams={sp} />
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/admin/beoordelingen?filter=${f.key}`} className={`rounded-full border px-3 py-1 text-sm ${filter === f.key ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>{f.label}</Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? <Empty>Niets in deze selectie.</Empty> : (
          <table className="tk">
            <thead><tr><th>Opdracht</th><th>Klant</th><th>Versie</th><th>Status</th><th>Advies</th><th>Score</th><th>Bijgewerkt</th></tr></thead>
            <tbody>
              {rows.map(({ a, p, o }) => (
                <tr key={a.id}>
                  <td className="max-w-md"><Link href={`/admin/beoordelingen/${a.id}`} className="font-medium text-navy-800 hover:underline">{p.title}</Link>{a.stale && <div><Badge tone="warn">Bronwijziging: {a.staleReason}</Badge></div>}</td>
                  <td>{o.name}</td>
                  <td>v{a.version}</td>
                  <td><AssessmentStatusBadge status={a.status} /></td>
                  <td><AdviceBadge advice={a.advice} /></td>
                  <td>{a.relevanceScore ?? "—"}</td>
                  <td className="text-xs">{formatBrussels(a.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
