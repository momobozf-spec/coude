import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { digest, organization } from "@/db/schema";
import { Badge, Card, Empty, Field, Flash, Notice, PageTitle, btn } from "@/components/ui";
import { formatBrussels } from "@/lib/time";
import { getMailTransport } from "@/lib/mailer";
import { createDigestAction } from "./actions";
import { DIGEST_STATUS } from "@/lib/labels";

export const metadata = { title: "Digests" };


export default async function Digests({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [orgs, rows] = await Promise.all([
    db.select().from(organization).orderBy(organization.name),
    db.select({ d: digest, o: organization }).from(digest).innerJoin(organization, eq(organization.id, digest.organizationId)).orderBy(desc(digest.createdAt)).limit(100),
  ]);
  return (
    <div className="space-y-5">
      <PageTitle title="Digests en meldingen" subtitle="Enkel gecontroleerde, gepubliceerde kansen. Verzending vereist goedkeuring én een expliciete verzendactie." />
      <Flash searchParams={sp} />
      {!getMailTransport() && <Notice tone="warn">Geen e-mailprovider ingesteld: preview en export werken, verzending staat op “niet ingesteld”.</Notice>}
      <Card title="Nieuw concept">
        <form action={createDigestAction} className="grid gap-3 sm:grid-cols-[1fr_200px] md:grid-cols-[1fr_200px_1.5fr_auto] md:items-end">
          <Field label="Klant"><select name="organizationId" required defaultValue=""><option value="" disabled>Kies…</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          <Field label="Soort"><select name="kind"><option value="weekly">Wekelijkse selectie</option><option value="change_alert">Wijzigingsmelding</option></select></Field>
          <Field label="Inleiding (optioneel)"><input name="intro" type="text" maxLength={500} /></Field>
          <button className={btn()}>Concept maken</button>
        </form>
      </Card>
      <Card title="Verzendhistoriek">
        {rows.length === 0 ? <Empty>Nog geen digests.</Empty> : (
          <table className="tk">
            <thead><tr><th>Aangemaakt</th><th>Klant</th><th>Soort</th><th>Onderwerp</th><th>Kansen</th><th>Status</th></tr></thead>
            <tbody>{rows.map(({ d, o }) => (
              <tr key={d.id}>
                <td className="text-xs">{formatBrussels(d.createdAt)}</td>
                <td>{o.name}</td>
                <td className="text-xs">{d.kind === "weekly" ? "Wekelijks" : "Wijziging"}</td>
                <td><Link className="text-navy-800 underline" href={`/admin/digests/${d.id}`}>{d.subject}</Link></td>
                <td>{d.items.length}</td>
                <td><Badge tone={DIGEST_STATUS[d.status]?.tone ?? "neutral"}>{DIGEST_STATUS[d.status]?.label ?? d.status}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
