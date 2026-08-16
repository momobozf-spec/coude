import { requireAgencyUser } from "@/lib/auth/current-user";
import { tenantDb } from "@/repositories/tenant-db";
import { addTerritory, removeTerritory } from "../actions";
import { Badge, Card, PageHeader } from "../ui";

export const dynamic = "force-dynamic";

export default async function TerritoriesPage() {
  const user = await requireAgencyUser();
  const territories = await tenantDb(user.agencyId).territories();
  const canManage = user.role !== "AGENT";

  const kinds = [
    { kind: "POSTAL_CODE", label: "Postal codes", tone: "indigo" as const },
    { kind: "MUNICIPALITY", label: "Municipalities", tone: "green" as const },
    { kind: "PROVINCE", label: "Provinces", tone: "amber" as const },
  ];

  return (
    <>
      <PageHeader
        title="Territories"
        subtitle="Opportunities are matched to these areas automatically — postal code beats municipality beats province"
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {kinds.map(({ kind, label, tone }) => {
          const items = territories.filter((t) => t.kind === kind);
          return (
            <Card key={kind}>
              <div className="mb-3 text-sm font-semibold text-slate-900">{label}</div>
              {items.length === 0 ? (
                <p className="text-sm text-slate-400">None configured.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-center justify-between">
                      <Badge tone={tone}>{t.label}</Badge>
                      {canManage ? (
                        <form action={removeTerritory}>
                          <input type="hidden" name="territoryId" value={t.id} />
                          <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                            Remove
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      {canManage ? (
        <Card className="mt-5 max-w-xl">
          <div className="mb-3 text-sm font-semibold text-slate-900">Add territory</div>
          <form action={addTerritory} className="flex items-center gap-2">
            <select name="kind" className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
              <option value="POSTAL_CODE">Postal code</option>
              <option value="MUNICIPALITY">Municipality</option>
              <option value="PROVINCE">Province</option>
            </select>
            <input
              name="value"
              required
              placeholder="9000 or Gent or Oost-Vlaanderen"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Add
            </button>
          </form>
        </Card>
      ) : null}
    </>
  );
}
