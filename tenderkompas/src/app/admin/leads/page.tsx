import { desc } from "drizzle-orm";
import { db } from "@/db";
import { leadRequest } from "@/db/schema";
import { Badge, Card, Empty, Flash, PageTitle, btn } from "@/components/ui";
import { formatBrussels } from "@/lib/time";
import { createOrgAction } from "../klanten/actions";
import { setLeadStatusAction } from "./actions";

export const metadata = { title: "Aanvragen" };

export default async function Leads({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rows = await db.select().from(leadRequest).orderBy(desc(leadRequest.createdAt)).limit(200);
  return (
    <div>
      <PageTitle title="Aanvragen" subtitle="Via het aanvraagformulier op de landingpage. Bewaartermijn volgens RETENTION_LEADS_DAYS." />
      <Flash searchParams={sp} />
      <Card>
        {rows.length === 0 ? <Empty>Nog geen aanvragen.</Empty> : (
          <table className="tk">
            <thead><tr><th>Ontvangen</th><th>Bedrijf</th><th>Contact</th><th>Focus</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.map((l) => (
              <tr key={l.id}>
                <td className="text-xs">{formatBrussels(l.createdAt)}</td>
                <td>{l.companyName}<div className="text-xs text-muted">{l.website}</div><div className="text-xs text-muted">{l.teamSize}</div></td>
                <td>{l.contactName}<div className="text-xs text-muted">{l.email}</div></td>
                <td className="max-w-xs text-xs">{l.focus}<div className="text-muted">{l.message}</div></td>
                <td><Badge tone={l.status === "new" ? "info" : l.status === "converted" ? "ok" : "neutral"}>{l.status}</Badge></td>
                <td className="space-y-1">
                  {l.status !== "converted" && (
                    <form action={createOrgAction}>
                      <input type="hidden" name="name" value={l.companyName} />
                      <input type="hidden" name="subscriptionStatus" value="pilot" />
                      <input type="hidden" name="leadId" value={l.id} />
                      <button className={btn("secondary", "sm")}>Pilotklant aanmaken</button>
                    </form>
                  )}
                  {l.status === "new" && (
                    <form action={setLeadStatusAction}><input type="hidden" name="leadId" value={l.id} /><input type="hidden" name="status" value="contacted" /><button className={btn("ghost", "sm")}>Gecontacteerd</button></form>
                  )}
                  <form action={setLeadStatusAction}><input type="hidden" name="leadId" value={l.id} /><input type="hidden" name="status" value="delete" /><button className={btn("danger", "sm")}>Verwijderen</button></form>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
