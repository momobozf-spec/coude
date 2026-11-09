import { eq } from "drizzle-orm";
import { localeFromParams } from "@/lib/locale";
import { getCurrentProvider } from "@/lib/session";
import { db } from "@/db";
import { availabilitySlot, timeOff } from "@/db/schema";
import type { MessageKey } from "@/i18n";
import { Card, PageTitle } from "@/components/ui";
import { AvailabilityForm } from "@/components/availability-form";

const KEYS: MessageKey[] = ["avail.help", "avail.weekday_0", "avail.weekday_1", "avail.weekday_2", "avail.weekday_3", "avail.weekday_4", "avail.weekday_5", "avail.weekday_6", "avail.from", "avail.to", "avail.add_slot", "avail.remove", "avail.time_off", "avail.time_off_help", "avail.add_time_off", "avail.none", "common.save", "common.saved", "common.loading", "common.error_generic", "common.optional"];

export default async function AvailabilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const { provider } = (await getCurrentProvider())!;
  const [slots, offs] = await Promise.all([db.select().from(availabilitySlot).where(eq(availabilitySlot.providerId, provider.id)), db.select().from(timeOff).where(eq(timeOff.providerId, provider.id))]);
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(k)]));
  return (
    <div className="space-y-6">
      <PageTitle sub={t("avail.help")}>{t("avail.title")}</PageTitle>
      <Card>
        <AvailabilityForm locale={locale} labels={labels} initial={{ slots: slots.map((s) => ({ weekday: s.weekday, startMin: s.startMin, endMin: s.endMin })), timeOff: offs.map((o) => ({ dateFrom: o.dateFrom, dateTo: o.dateTo, note: o.note ?? "" })) }} />
      </Card>
    </div>
  );
}
