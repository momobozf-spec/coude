import Link from "next/link";
import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { listAlertRules, listAlerts } from "@/repositories/alerts";
import { formatDateTime, humanize } from "@/lib/format";
import { PageHeader, Pill, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { ctx } = await requireTenant();
  const [alerts, rules] = await Promise.all([listAlerts(db, ctx), listAlertRules(db, ctx)]);
  return (
    <>
      <PageHeader title="Alerts" subtitle="Every notification we generated for your agency, with delivery status. Duplicates are prevented by design." actions={<Link href="/settings" className="btn">Alert settings</Link>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {rules.map((r) => (
          <div key={r.id} className="card p-3 text-sm">
            <p className="font-medium">{humanize(r.type)}</p>
            <p className="text-xs text-ink-500">{r.enabled ? "Enabled" : "Disabled"} · {r.type === "HOT_OPPORTUNITY" ? `min score ${r.minScore}` : r.channel.toLowerCase()}</p>
          </div>
        ))}
      </div>
      <Section title={`Alert history (${alerts.length})`}>
        <table className="table">
          <thead><tr><th>Created</th><th>Type</th><th>Title</th><th>Recipient</th><th>Status</th></tr></thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-ink-500">{formatDateTime(a.createdAt)}</td>
                <td>{humanize(a.type)}</td>
                <td>{a.opportunity ? <Link href={`/opportunities/${a.opportunity.id}`} className="hover:text-brand-700">{a.title}</Link> : a.title}</td>
                <td className="text-ink-600">{a.user?.name ?? (a.recipient ? "Agency chat" : "—")}</td>
                <td><Pill value={a.status} />{a.error ? <p className="text-xs text-hot-600">{a.error}</p> : null}</td>
              </tr>
            ))}
            {!alerts.length ? <tr><td colSpan={5} className="text-center text-ink-500">No alerts yet.</td></tr> : null}
          </tbody>
        </table>
      </Section>
    </>
  );
}
