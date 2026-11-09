import { desc } from "drizzle-orm";
import { db } from "@/db";
import { importRun, source } from "@/db/schema";
import { Badge, Card, Empty, Flash, KeyValue, Notice, PageTitle, btn } from "@/components/ui";
import { formatBrussels } from "@/lib/time";
import { TED_FIELDS } from "@/lib/ted/fields";
import { sampleReport } from "@/lib/ted/sample";
import { LIFECYCLE_LABEL } from "@/lib/domain/lifecycle";
import type { ProcedureLifecycle } from "@/db/schema";
import { runTedImportAction } from "./actions";

export const metadata = { title: "Bronnen & import" };

export default async function Sources({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [sources, runs, report] = await Promise.all([
    db.select().from(source),
    db.select().from(importRun).orderBy(desc(importRun.startedAt)).limit(30),
    sampleReport(db, 90),
  ]);
  const listOnly = Object.entries(TED_FIELDS).filter(([, v]) => v === "list-only").map(([k]) => k);
  return (
    <div className="space-y-5">
      <PageTitle title="Bronnen & import" subtitle="Werkelijke dekking per bron, importstatus en laatste geslaagde verwerking. We claimen nooit alle Belgische opdrachten te volgen." />
      <Flash searchParams={sp} />
      <div className="grid gap-5 lg:grid-cols-2">
        {sources.filter((s) => s.id !== "demo").map((s) => (
          <Card key={s.id} title={s.name}>
            <KeyValue
              items={[
                ["Werkwijze", s.automation === "api" ? <Badge tone="info">Automatisch (API)</Badge> : <Badge tone="neutral">Handmatige invoer</Badge>],
                ["Dekking", <span key="c" className="text-sm">{s.coverageNote}</span>],
                ...(s.automation === "api"
                  ? ([
                      ["Laatste run", s.lastRunAt ? <span key="l">{formatBrussels(s.lastRunAt)} <Badge tone={s.lastRunStatus === "success" ? "ok" : s.lastRunStatus === "running" ? "info" : "bad"}>{s.lastRunStatus}</Badge></span> : "nooit"],
                      ["Laatste geslaagde verwerking", s.lastSuccessAt ? formatBrussels(s.lastSuccessAt) : <span key="n" className="text-warn-700">nog nooit</span>],
                      ["Incrementeel vanaf", s.cursor ?? "eerste run: laatste 14 dagen"],
                    ] as [React.ReactNode, React.ReactNode][])
                  : []),
              ]}
            />
            {s.id === "ted" && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <form action={runTedImportAction}><input type="hidden" name="mode" value="incremental" /><button className={btn()}>Incrementele import starten</button></form>
                  <form action={runTedImportAction}><input type="hidden" name="mode" value="sample90" /><button className={btn("secondary")}>Steekproef laatste 90 dagen importeren</button></form>
                </div>
                <p className="text-xs text-muted">
                  Zoekfilter: land opdrachtgever BEL · CPV 72*/48* of gecontroleerde NL/FR/EN-zoektermen · alle publicatietypes (ook wijzigingen, gunningen en intrekkingen) · iteratiemodus · retries met backoff · deduplicatie op publicatienummer.
                </p>
                <Notice tone="warn" title="Nog niet live getest">
                  Alle {Object.keys(TED_FIELDS).length} opgevraagde velden staan in de officiële TED-veldenlijst. Deze velden ontbreken in het officiële antwoordschema en zijn dus onzeker: {listOnly.join(", ")}. Weigert TED een veld, dan wordt het weggelaten en staat dat in de importtaak. Verifieer met <code>npm run ted:verify-fields</code>.
                </Notice>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card title="Steekproef laatste 90 dagen (uit werkelijk geïmporteerde gegevens)">
        {!report.available ? (
          <Notice tone="warn">{report.message}</Notice>
        ) : (
          <div className="space-y-2 text-sm">
            <KeyValue
              items={[
                ["Periode", `vanaf ${formatBrussels(report.since, false)}`],
                ["TED-procedures in periode", report.totalProcedures],
                ["Potentieel relevante procedures", <strong key="r">{report.relevantProcedures}</strong>],
                ["Percelen bij relevante procedures", `${report.relevantLots} (+ ${report.relevantWithoutLots} procedure(s) zonder perceelinformatie)`],
                ["Per status", Object.entries(report.byLifecycle).map(([k, v]) => `${LIFECYCLE_LABEL[k as ProcedureLifecycle]}: ${v}`).join(" · ")],
              ]}
            />
            <p className="text-xs text-muted">Zoekmethode: TED Search API v3, filter hierboven; relevantie = gecontroleerde CPV-lijst of NL/FR/EN-termen (geen klantprofiel). Beperking: enkel TED; nationale publicaties zitten hier niet in.</p>
          </div>
        )}
      </Card>

      <Card title="Importtaken">
        {runs.length === 0 ? <Empty>Nog geen importtaken.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tk">
              <thead><tr><th>Start</th><th>Type</th><th>Status</th><th>Gerapporteerd</th><th>Opgehaald</th><th>Nieuw (proc./publ.)</th><th>Gewijzigd</th><th>Dubbel</th><th>Fouten</th></tr></thead>
              <tbody>{runs.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs">{formatBrussels(r.startedAt)}</td>
                  <td className="text-xs">{r.trigger}</td>
                  <td><Badge tone={r.status === "success" ? "ok" : r.status === "running" ? "info" : r.status === "partial" ? "warn" : "bad"}>{r.status}</Badge></td>
                  <td>{r.totalReported ?? "—"}</td>
                  <td>{r.fetchedCount}</td>
                  <td>{r.newProcedures} / {r.newNotices}</td>
                  <td>{r.changedProcedures}</td>
                  <td>{r.duplicateNotices}</td>
                  <td className="max-w-sm text-xs text-bad-700">{r.errorMessage ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
