import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { digest, emailDelivery, organization } from "@/db/schema";
import { Badge, Card, Flash, Notice, PageTitle, btn } from "@/components/ui";
import { formatBrussels } from "@/lib/time";
import { recipientsFor } from "@/lib/services/digests";
import { getMailTransport } from "@/lib/mailer";
import { approveDigestAction, sendDigestAction, sendTestDigestAction } from "../actions";
import { DELIVERY_STATE, DELIVERY_STATUS, DIGEST_STATUS } from "@/lib/labels";

export const metadata = { title: "Digest" };

export default async function DigestDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db.query.digest.findFirst({ where: eq(digest.id, id) });
  if (!d) notFound();
  const [org, deliveries, recipients] = await Promise.all([
    db.query.organization.findFirst({ where: eq(organization.id, d.organizationId) }),
    db.select().from(emailDelivery).where(eq(emailDelivery.digestId, id)),
    recipientsFor(db, d.organizationId).catch(() => []),
  ]);
  const hidden = <input type="hidden" name="digestId" value={d.id} />;
  const st = DIGEST_STATUS[d.status] ?? { label: d.status, tone: "neutral" as const };
  const pref = d.kind === "weekly" ? org?.notificationSettings.weeklyDigest : org?.notificationSettings.changeAlerts;
  return (
    <div className="space-y-5">
      <PageTitle title={d.subject} subtitle={<span className="flex gap-2">{org?.name} · {d.kind === "weekly" ? "Wekelijkse selectie" : "Wijzigingsmelding"} <Badge tone={st.tone}>{st.label}</Badge></span>} />
      <Flash searchParams={sp} />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Klantvoorbeeld">
          <iframe title="Voorbeeld e-mail" srcDoc={d.html} sandbox="" className="h-[640px] w-full rounded border border-line bg-white" />
        </Card>
        <div className="space-y-5">
          <Card title="Acties">
            <div className="space-y-3 text-sm">
              <div>Ontvangers: {recipients.length ? recipients.join(", ") : <span className="text-warn-700">geen</span>}</div>
              {!pref && <Notice tone="warn">De klant heeft dit type melding uitgeschakeld.</Notice>}
              {d.status === "draft" && <form action={approveDigestAction}>{hidden}<button className={btn()}>Goedkeuren</button></form>}
              {d.status !== "draft" && (
                <form action={sendDigestAction}>
                  {hidden}
                  <button className={btn()} disabled={d.status === "handed_to_smtp"}>{d.status === "handed_to_smtp" ? "Al aan SMTP overhandigd" : getMailTransport() ? "Verzenden naar klant" : "Verzenden (SMTP niet ingesteld)"}</button>
                </form>
              )}
              <form action={sendTestDigestAction}>{hidden}<button className={btn("secondary")}>Testmail naar mijzelf</button></form>
              <p className="text-xs text-muted">Opnieuw verzenden is veilig: elke klantontvanger krijgt deze digest hoogstens één keer. “Aanvaard door SMTP” is geen bevestigde aflevering in de mailbox.</p>
              <div className="flex gap-2">
                <a className={btn("secondary", "sm")} href={`/api/admin/digests/${d.id}/export?format=html`}>Export HTML</a>
                <a className={btn("secondary", "sm")} href={`/api/admin/digests/${d.id}/export?format=txt`}>Export tekst</a>
              </div>
            </div>
          </Card>
          <Card title="Verzendregistratie">
            {deliveries.length === 0 ? <p className="text-sm text-muted">Nog geen verzendpogingen.</p> : (
              <table className="tk">
                <thead><tr><th>Soort</th><th>Ontvanger</th><th>Status</th><th>Pogingen</th><th>Overhandigd</th></tr></thead>
                <tbody>{deliveries.map((x) => (
                  <tr key={x.id}>
                    <td className="text-xs">{x.kind === "test" ? <Badge tone="neutral">Test</Badge> : "Klant"}</td>
                    <td className="text-xs">{x.recipient}</td>
                    <td>
                      <Badge tone={DELIVERY_STATUS[x.status]?.tone ?? "neutral"}>{DELIVERY_STATUS[x.status]?.label ?? x.status}</Badge>
                      {x.status === "handed_to_smtp" && <div className="text-xs text-muted">{DELIVERY_STATE[x.deliveryState] ?? x.deliveryState}</div>}
                      {x.smtpResponse && <div className="text-xs text-muted">SMTP: {x.smtpResponse}</div>}
                      {x.lastError && <div className="text-xs text-bad-700">{x.lastError}</div>}
                    </td>
                    <td>{x.attempts}</td>
                    <td className="text-xs">{x.handedOffAt ? formatBrussels(x.handedOffAt) : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
          <Card title="Platte tekst">
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">{d.textBody}</pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
