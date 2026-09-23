import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/tenant";
import { listAgencies } from "@/repositories/admin";
import { switchAgencyAction } from "@/actions/admin";
import { Notice, PageHeader, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgenciesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const agencies = await listAgencies(db, user);
  return (
    <>
      <PageHeader title="Agencies" subtitle="All tenants on the platform. Switch context to act as an agency." />
      <Notice searchParams={sp} />
      <Section title={`${agencies.length} agencies`}>
        <table className="table">
          <thead><tr><th>Agency</th><th>City</th><th>Users</th><th>Territories</th><th>CRM contacts</th><th>Opportunities</th><th>Alerts ≥</th><th>Digest</th><th></th></tr></thead>
          <tbody>
            {agencies.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}<p className="text-xs text-ink-500">{a.slug}</p></td>
                <td>{a.city ?? "—"}</td>
                <td className="tabular-nums">{a._count.users}</td>
                <td className="tabular-nums">{a._count.territories}</td>
                <td className="tabular-nums">{a._count.crmContacts}</td>
                <td className="tabular-nums">{a._count.opportunities}</td>
                <td className="tabular-nums">{a.alertMinScore}</td>
                <td>{a.digestEnabled ? `${a.digestHourLocal}:00` : "off"}</td>
                <td>
                  <form action={switchAgencyAction}>
                    <input type="hidden" name="agencyId" value={a.id} />
                    <button className="btn btn-sm" type="submit">Act as</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
