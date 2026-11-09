import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { requireClient } from "@/lib/dal";
import { Card, Field, Flash, PageTitle, btn } from "@/components/ui";
import { clientNotificationsAction } from "../actions";

export const metadata = { title: "Meldingen" };

export default async function NotificationSettings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const c = await requireClient();
  const org = await db.query.organization.findFirst({ where: eq(organization.id, c.organizationId) });
  const s = org!.notificationSettings;
  return (
    <div className="max-w-2xl">
      <PageTitle title="Meldingen" subtitle="Tijdens de pilot verstuurt de beheerder elke e-mail na controle." />
      <Flash searchParams={sp} />
      <Card>
        <form action={clientNotificationsAction} className="space-y-3 text-sm">
          <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="weeklyDigest" defaultChecked={s.weeklyDigest} /> Wekelijkse selectie (maximaal vijf uitgewerkte kansen, of een eerlijk bericht als er geen zijn)</label>
          <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="changeAlerts" defaultChecked={s.changeAlerts} /> Meldingen bij belangrijke wijzigingen aan gevolgde kansen</label>
          <Field label="Ontvangers" hint="Kommagescheiden e-mailadressen. Leeg = alle gebruikers van uw organisatie."><input type="text" name="recipients" defaultValue={s.recipients.join(", ")} /></Field>
          <button className={btn()}>Opslaan</button>
        </form>
      </Card>
    </div>
  );
}
