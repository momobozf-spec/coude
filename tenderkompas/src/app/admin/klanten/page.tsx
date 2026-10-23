import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { assessment, companyProfile, membership, organization } from "@/db/schema";
import { Badge, Card, Empty, Field, Flash, PageTitle, btn } from "@/components/ui";
import { SUBSCRIPTION_LABEL } from "@/lib/labels";
import { formatBrussels } from "@/lib/time";
import { createOrgAction } from "./actions";

export const metadata = { title: "Klanten" };

export default async function Clients({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const orgs = await db.select().from(organization).orderBy(organization.name);
  const [profiles, members, published] = await Promise.all([
    db.select({ organizationId: companyProfile.organizationId, version: companyProfile.version, confirmed: companyProfile.lastConfirmedByClientAt }).from(companyProfile),
    db.select({ organizationId: membership.organizationId, n: count() }).from(membership).groupBy(membership.organizationId),
    db.select({ organizationId: assessment.organizationId, n: count() }).from(assessment).where(eq(assessment.status, "published")).groupBy(assessment.organizationId),
  ]);
  return (
    <div className="space-y-5">
      <PageTitle title="Klanten" subtitle="Pilotklanten met handmatig beheerde abonnementen. Facturatie gebeurt buiten de applicatie." />
      <Flash searchParams={sp} />
      <Card>
        {orgs.length === 0 ? <Empty>Nog geen klanten.</Empty> : (
          <table className="tk">
            <thead><tr><th>Organisatie</th><th>Abonnement</th><th>Profiel</th><th>Gebruikers</th><th>Gepubliceerde kansen</th></tr></thead>
            <tbody>
              {orgs.map((o) => {
                const p = profiles.find((x) => x.organizationId === o.id);
                return (
                  <tr key={o.id}>
                    <td><Link className="font-medium text-navy-800 hover:underline" href={`/admin/klanten/${o.id}`}>{o.name}</Link> {o.isDemo && <Badge tone="warn">demo</Badge>}</td>
                    <td>{SUBSCRIPTION_LABEL[o.subscriptionStatus]}</td>
                    <td className="text-xs">{p ? <>v{p.version} · {p.confirmed ? `bevestigd ${formatBrussels(p.confirmed, false)}` : <span className="text-warn-700">niet door klant bevestigd</span>}</> : <span className="text-warn-700">ontbreekt</span>}</td>
                    <td>{members.find((m) => m.organizationId === o.id)?.n ?? 0}</td>
                    <td>{published.find((m) => m.organizationId === o.id)?.n ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Klantorganisatie toevoegen">
        <form action={createOrgAction} className="grid gap-3 sm:grid-cols-[1fr_200px_auto_auto] sm:items-end">
          <Field label="Naam"><input name="name" type="text" required /></Field>
          <Field label="Abonnement">
            <select name="subscriptionStatus" defaultValue="pilot">{Object.entries(SUBSCRIPTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <label className="flex items-center gap-1 pb-2 font-normal"><input type="checkbox" name="isDemo" /> Demo (fictief)</label>
          <button className={btn()}>Toevoegen</button>
        </form>
      </Card>
    </div>
  );
}
