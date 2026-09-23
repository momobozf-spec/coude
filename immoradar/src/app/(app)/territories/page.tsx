import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { listTerritories } from "@/repositories/territories";
import { addTerritoryAction, removeTerritoryAction } from "@/actions/territories";
import { humanize } from "@/lib/format";
import { Notice, PageHeader, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TerritoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { user, ctx } = await requireTenant();
  const territories = await listTerritories(db, ctx);
  const canWrite = hasPermission(user.role, "territory:write");
  const groups = ["POSTAL_CODE", "MUNICIPALITY", "PROVINCE"] as const;
  return (
    <>
      <PageHeader title="Territories" subtitle="Opportunities are only created for properties inside your territories. Postal codes match exactly, municipalities and provinces more loosely (lower territory score)." />
      <Notice searchParams={sp} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {groups.map((g) => (
            <Section key={g} title={`${humanize(g)}s (${territories.filter((t) => t.type === g).length})`}>
              <div className="flex flex-wrap gap-2">
                {territories.filter((t) => t.type === g).map((t) => (
                  <form key={t.id} action={removeTerritoryAction} className="flex items-center gap-1 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-sm">
                    <input type="hidden" name="id" value={t.id} />
                    <span className="font-medium">{t.value}</span>
                    {canWrite ? <button type="submit" className="text-ink-400 hover:text-hot-600" title="Remove">×</button> : null}
                  </form>
                ))}
                {!territories.some((t) => t.type === g) ? <p className="text-sm text-ink-500">None</p> : null}
              </div>
            </Section>
          ))}
        </div>
        {canWrite ? (
          <Section title="Add territory">
            <form action={addTerritoryAction} className="space-y-3">
              <div>
                <label className="label">Type</label>
                <select name="type" className="input" defaultValue="POSTAL_CODE">
                  <option value="POSTAL_CODE">Postal code</option>
                  <option value="MUNICIPALITY">Municipality</option>
                  <option value="PROVINCE">Province</option>
                </select>
              </div>
              <div>
                <label className="label">Value(s)</label>
                <input name="value" className="input" placeholder="9000, 9030, 9040" required />
                <p className="mt-1 text-xs text-ink-500">Separate multiple values with commas.</p>
              </div>
              <button className="btn btn-primary" type="submit">Add</button>
            </form>
          </Section>
        ) : null}
      </div>
    </>
  );
}
