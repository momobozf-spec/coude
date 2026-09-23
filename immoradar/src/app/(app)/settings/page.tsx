import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";
import { updateAgencySettingsAction, updateMyTelegramAction } from "@/actions/settings";
import { Notice, PageHeader, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { user, ctx } = await requireTenant();
  const agency = await db.agency.findUniqueOrThrow({ where: { id: ctx.agencyId } });
  const users = await db.user.findMany({ where: { agencyId: ctx.agencyId }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true, telegramChatId: true } });
  const canWrite = hasPermission(user.role, "settings:write");
  return (
    <>
      <PageHeader title="Settings" subtitle={agency.name} />
      <Notice searchParams={sp} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Agency configuration">
          <form action={updateAgencySettingsAction} className="space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <div>
                <label className="label">Telegram chat id (agency channel)</label>
                <input name="telegramChatId" className="input" defaultValue={agency.telegramChatId ?? ""} placeholder="-1001234567890" />
                <p className="mt-1 text-xs text-ink-500">Alerts go to the assigned agent&apos;s personal chat when set, otherwise to this channel.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Minimum score for instant alerts</label>
                  <input name="alertMinScore" type="number" min={0} max={100} className="input" defaultValue={agency.alertMinScore} />
                </div>
                <div>
                  <label className="label">Morning brief hour (local)</label>
                  <input name="digestHourLocal" type="number" min={0} max={23} className="input" defaultValue={agency.digestHourLocal} />
                </div>
                <div>
                  <label className="label">Dormant after (months)</label>
                  <input name="dormantMonths" type="number" min={1} max={120} className="input" defaultValue={agency.dormantMonths} />
                </div>
                <div>
                  <label className="label">CRM retention (days, empty = keep)</label>
                  <input name="crmRetentionDays" type="number" min={30} max={3650} className="input" defaultValue={agency.crmRetentionDays ?? ""} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="digestEnabled" defaultChecked={agency.digestEnabled} /> Send the morning opportunity brief</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="autoAssignByAgent" defaultChecked={agency.autoAssignByAgent} /> Auto-assign opportunities to the CRM contact&apos;s agent</label>
              {canWrite ? <button className="btn btn-primary" type="submit">Save</button> : <p className="text-xs text-ink-500">Only agency admins can change these settings.</p>}
            </fieldset>
          </form>
        </Section>
        <div className="space-y-6">
          <Section title="My notifications">
            <form action={updateMyTelegramAction} className="space-y-3">
              <div>
                <label className="label">My Telegram chat id</label>
                <input name="telegramChatId" className="input" defaultValue={user.telegramChatId ?? ""} placeholder="123456789" />
                <p className="mt-1 text-xs text-ink-500">Send /start to the ImmoRadar bot and paste the chat id here to receive personal alerts and your morning brief.</p>
              </div>
              <button className="btn" type="submit">Save</button>
            </form>
          </Section>
          <Section title="Team">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Telegram</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}><td className="font-medium">{u.name}{!u.isActive ? <span className="ml-1 text-xs text-ink-400">(inactive)</span> : null}</td><td className="text-ink-600">{u.email}</td><td>{u.role.replace("_", " ").toLowerCase()}</td><td>{u.telegramChatId ? "configured" : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </Section>
        </div>
      </div>
    </>
  );
}
