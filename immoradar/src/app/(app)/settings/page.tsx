import { requireAgencyUser } from "@/lib/auth/current-user";
import { tenantDb } from "@/repositories/tenant-db";
import { updateAgencySettings } from "../actions";
import { Card, PageHeader } from "../ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAgencyUser();
  const tenant = tenantDb(user.agencyId);
  const agency = await tenant.agency();
  const members = await tenant.agencyUsers();
  const canManage = user.role !== "AGENT";

  return (
    <>
      <PageHeader title="Settings" subtitle={agency.name} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-3 text-sm font-semibold text-slate-900">Notifications</div>
          <form action={updateAgencySettings} className="space-y-4">
            <div>
              <label htmlFor="telegramChatId" className="mb-1 block text-sm text-slate-600">Telegram chat ID</label>
              <input
                id="telegramChatId"
                name="telegramChatId"
                defaultValue={agency.telegramChatId ?? ""}
                placeholder="e.g. -1001234567890"
                disabled={!canManage}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              />
              <p className="mt-1 text-xs text-slate-400">
                Add the ImmoRadar bot to your team chat and paste the chat ID. Leave empty for in-app alerts only.
              </p>
            </div>
            <div>
              <label htmlFor="minAlertScore" className="mb-1 block text-sm text-slate-600">
                Minimum score for instant alerts
              </label>
              <input
                id="minAlertScore"
                name="minAlertScore"
                type="number"
                min={0}
                max={100}
                defaultValue={agency.minAlertScore}
                disabled={!canManage}
                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
            <div>
              <label htmlFor="digestHourLocal" className="mb-1 block text-sm text-slate-600">
                Morning brief hour (Brussels time)
              </label>
              <input
                id="digestHourLocal"
                name="digestHourLocal"
                type="number"
                min={0}
                max={23}
                defaultValue={agency.digestHourLocal}
                disabled={!canManage}
                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="digestEnabled" defaultChecked={agency.digestEnabled} disabled={!canManage} />
                Morning digest
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="instantAlertsEnabled" defaultChecked={agency.instantAlertsEnabled} disabled={!canManage} />
                Instant hot-opportunity alerts
              </label>
            </div>
            {canManage ? (
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Save settings
              </button>
            ) : (
              <p className="text-xs text-slate-400">Only agency admins can change settings.</p>
            )}
          </form>
        </Card>

        <Card>
          <div className="mb-3 text-sm font-semibold text-slate-900">Team</div>
          <ul className="space-y-2 text-sm">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between">
                <span className="font-medium text-slate-700">
                  {member.firstName} {member.lastName}
                </span>
                <span className="text-xs text-slate-400">{member.role.replaceAll("_", " ").toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            CRM data retention: {agency.crmRetentionDays ? `${agency.crmRetentionDays} days` : "indefinite"} ·
            Contact your platform administrator to change retention or delete CRM data.
          </div>
        </Card>
      </div>
    </>
  );
}
