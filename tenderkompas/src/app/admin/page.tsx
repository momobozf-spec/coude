import Link from "next/link";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessment, importRun, leadRequest, organization, procedure, source } from "@/db/schema";
import { Badge, Card, Empty, Notice, PageTitle, ButtonLink } from "@/components/ui";
import { formatBrussels } from "@/lib/time";
import { aiConfigured } from "@/lib/ai/extract";
import { getMailTransport } from "@/lib/mailer";
import { isProductionMode } from "@/lib/demo-guard";

export const metadata = { title: "Beheer" };

export default async function AdminHome() {
  const [sources, runs, queue, stalePublished, orgs, newLeads, openUnassessed] = await Promise.all([
    db.select().from(source),
    db.select().from(importRun).orderBy(desc(importRun.startedAt)).limit(5),
    db
      .select({ a: assessment, p: procedure, o: organization })
      .from(assessment)
      .innerJoin(procedure, eq(procedure.id, assessment.procedureId))
      .innerJoin(organization, eq(organization.id, assessment.organizationId))
      .where(and(eq(assessment.isCurrent, true), inArray(assessment.status, ["draft", "to_review", "approved"])))
      .orderBy(desc(assessment.updatedAt))
      .limit(12),
    db.select({ n: count() }).from(assessment).where(and(eq(assessment.status, "published"), eq(assessment.stale, true))),
    db.select().from(organization).orderBy(organization.name),
    db.select({ n: count() }).from(leadRequest).where(eq(leadRequest.status, "new")),
    db
      .select({ n: count() })
      .from(procedure)
      .where(and(eq(procedure.lifecycle, "open"), sql`not exists (select 1 from assessment a where a.procedure_id = ${procedure.id})`)),
  ]);
  const ted = sources.find((s) => s.id === "ted");
  const demoOrgs = orgs.filter((o) => o.isDemo);
  return (
    <div className="space-y-5">
      <PageTitle
        title="Overzicht"
        subtitle="Werkvoorraad van de beheerder: invoer, importproblemen, reviews en klantselecties."
        actions={
          <>
            <ButtonLink href="/admin/procedures/nieuw">Opdracht handmatig invoeren</ButtonLink>
            <ButtonLink href="/admin/bronnen" kind="secondary">TED-import</ButtonLink>
          </>
        }
      />

      {isProductionMode() && demoOrgs.length > 0 && (
        <Notice tone="bad" title="Demodata aanwezig in productie">
          {demoOrgs.length} demo-organisatie(s) gevonden in een productieomgeving. Verwijder ze via Klanten → Gegevens verwijderen. Demodata wordt nooit automatisch geladen.
        </Notice>
      )}
      {ted && ted.lastRunStatus && ted.lastRunStatus !== "success" && ted.lastRunStatus !== "running" && (
        <Notice tone="bad" title="Laatste TED-import is niet volledig gelukt">
          Status: {ted.lastRunStatus}. Een mislukte import betekent niet dat er geen nieuwe kansen zijn. Zie{" "}
          <Link className="underline" href="/admin/bronnen">Bronnen & import</Link>.
        </Notice>
      )}
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Te behandelen beoordelingen" value={queue.length} href="/admin/beoordelingen" />
        <Stat label="Gepubliceerd met bronwijziging" value={stalePublished[0].n} href="/admin/beoordelingen?filter=stale" tone={stalePublished[0].n ? "warn" : undefined} />
        <Stat label="Open opdrachten zonder beoordeling" value={openUnassessed[0].n} href="/admin/procedures?filter=open" />
        <Stat label="Nieuwe aanvragen" value={newLeads[0].n} href="/admin/leads" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Reviewwachtrij" actions={<Link href="/admin/beoordelingen" className="text-sm text-navy-700 underline">Alles</Link>}>
          {queue.length === 0 ? (
            <Empty>Geen openstaande beoordelingen.</Empty>
          ) : (
            <table className="tk">
              <thead>
                <tr><th>Opdracht</th><th>Klant</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {queue.map(({ a, p, o }) => (
                  <tr key={a.id}>
                    <td className="max-w-xs">
                      <div className="line-clamp-2">{p.title}</div>
                      {a.stale && <Badge tone="warn">Bronwijziging</Badge>}
                    </td>
                    <td>{o.name}</td>
                    <td><Badge tone={a.status === "approved" ? "info" : a.status === "to_review" ? "warn" : "neutral"}>{a.status === "draft" ? "Concept" : a.status === "to_review" ? "Te controleren" : "Goedgekeurd"}</Badge></td>
                    <td><Link className="text-navy-700 underline" href={`/admin/beoordelingen/${a.id}`}>Openen</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Bronnen">
            <ul className="space-y-2 text-sm">
              {sources.filter((s) => s.id !== "demo").map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2">
                  <span>{s.name}</span>
                  {s.automation === "api" ? (
                    <span className="text-right text-xs">
                      {s.lastRunStatus ? <Badge tone={s.lastRunStatus === "success" ? "ok" : s.lastRunStatus === "running" ? "info" : "bad"}>{s.lastRunStatus}</Badge> : <Badge tone="warn">nooit uitgevoerd</Badge>}
                      <div className="text-muted">laatste succes: {s.lastSuccessAt ? formatBrussels(s.lastSuccessAt) : "nooit"}</div>
                    </span>
                  ) : (
                    <Badge tone="neutral">handmatig</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Integraties">
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">AI-extractie {aiConfigured() ? <Badge tone="ok">ingesteld</Badge> : <Badge tone="warn">niet ingesteld — handmatige analyse</Badge>}</li>
              <li className="flex justify-between">E-mailverzending {getMailTransport() ? <Badge tone="ok">ingesteld</Badge> : <Badge tone="warn">niet ingesteld — enkel preview/export</Badge>}</li>
              <li className="flex justify-between">Betaalintegratie <Badge tone="neutral">bewust niet gebouwd (pilot)</Badge></li>
            </ul>
          </Card>
          <Card title="Laatste importtaken">
            {runs.length === 0 ? <Empty>Nog geen importtaken.</Empty> : (
              <ul className="space-y-2 text-sm">
                {runs.map((r) => (
                  <li key={r.id}>
                    <div className="flex justify-between"><span>{formatBrussels(r.startedAt)}</span><Badge tone={r.status === "success" ? "ok" : r.status === "running" ? "info" : "bad"}>{r.status}</Badge></div>
                    <div className="text-xs text-muted">{r.fetchedCount} opgehaald · {r.newProcedures} nieuwe procedures · {r.changedProcedures} gewijzigd · {r.duplicateNotices} dubbel</div>
                    {r.errorMessage && <div className="text-xs text-bad-700">{r.errorMessage.slice(0, 200)}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="Klanten">
        {orgs.length === 0 ? <Empty>Nog geen klantorganisaties. <Link className="underline" href="/admin/klanten">Klant toevoegen</Link></Empty> : (
          <div className="flex flex-wrap gap-2">
            {orgs.map((o) => (
              <Link key={o.id} href={`/admin/klanten/${o.id}`} className="rounded-md border border-line px-3 py-2 text-sm hover:bg-navy-50">
                {o.name} {o.isDemo && <Badge tone="warn">demo</Badge>} <span className="text-xs text-muted">· {o.subscriptionStatus}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "warn" }) {
  return (
    <Link href={href} className={`rounded-lg border bg-white p-4 hover:bg-navy-50 ${tone === "warn" ? "border-warn-700/40" : "border-line"}`}>
      <div className="text-2xl font-semibold text-navy-900">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </Link>
  );
}
