import { desc } from "drizzle-orm";
import { db } from "@/db";
import { scoringConfig } from "@/db/schema";
import { Card, Field, Flash, Notice, PageTitle, btn } from "@/components/ui";
import { getActiveScoringConfig } from "@/lib/services/assessments";
import { formatBrussels } from "@/lib/time";
import { saveScoringConfigAction, runRetentionAction } from "./actions";

export const metadata = { title: "Regels & gewichten" };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const active = await getActiveScoringConfig(db);
  const history = await db.select().from(scoringConfig).orderBy(desc(scoringConfig.version)).limit(20);
  return (
    <div className="space-y-5">
      <PageTitle title="Regels & gewichten" subtitle="Configureerbaar en geversioneerd. Elke beoordeling bewaart de versie waarmee ze berekend werd." />
      <Flash searchParams={sp} />
      <Card title={`Actieve configuratie (versie ${active.version})`}>
        <Notice tone="info">
          Gewichten bepalen enkel de relevantiescore (inhoudelijke aansluiting). Harde blokkades, onbekende voorwaarden en de levensfase van de opdracht worden altijd deterministisch toegepast en zijn niet uit te schakelen.
        </Notice>
        <form action={saveScoringConfigAction} className="mt-3 space-y-3">
          <Field label="Configuratie (JSON)"><textarea name="config" rows={16} className="font-mono text-xs" defaultValue={JSON.stringify(active.config, null, 2)} /></Field>
          <Field label="Wat wijzigt u en waarom? *"><input name="note" type="text" required /></Field>
          <button className={btn()}>Nieuwe versie opslaan</button>
        </form>
      </Card>
      <Card title="Versiegeschiedenis">
        <ul className="space-y-1 text-sm">{history.map((h) => <li key={h.id}>v{h.version} {h.active && "(actief)"} — {formatBrussels(h.createdAt)} — {h.note}</li>)}</ul>
      </Card>
      <Card title="Bewaartermijnen">
        <p className="mb-3 text-sm text-muted">
          Ruwe bronpayloads: {process.env.RETENTION_RAW_PAYLOAD_DAYS ?? 365} dagen · auditlog: {process.env.RETENTION_AUDIT_DAYS ?? 730} dagen · aanvragen: {process.env.RETENTION_LEADS_DAYS ?? 180} dagen (instelbaar via omgevingsvariabelen).
        </p>
        <form action={runRetentionAction}><button className={btn("secondary")}>Bewaartermijnen nu toepassen</button></form>
      </Card>
    </div>
  );
}
