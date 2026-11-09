import { desc, eq } from "drizzle-orm";
import { localeFromParams, formatDateTime } from "@/lib/locale";
import { db } from "@/db";
import { booking, jobRequest, provider } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { Badge, Button, PageTitle } from "@/components/ui";
import { Table } from "@/components/admin-table";
import { adminBookingAction } from "../actions";

export default async function AdminBookings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const rows = await db.select({ b: booking, r: jobRequest, p: provider }).from(booking).innerJoin(jobRequest, eq(jobRequest.id, booking.requestId)).innerJoin(provider, eq(provider.id, booking.providerId)).orderBy(desc(booking.createdAt)).limit(200);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.nav_bookings")}</PageTitle>
      <Table
        head={[t("common.date"), t("admin.nav_providers"), t("dash.customer"), t("prop.platform_fee"), t("common.status"), ""]}
        rows={rows.map(({ b, r, p }) => [
          formatDateTime(b.scheduledStart, locale),
          p.displayName,
          `${r.contactName} · ${r.postcode}`,
          `${formatCents(b.platformFeeCents, locale)} (${b.paymentProvider}/${b.paymentStatus})`,
          <Badge key="s" tone={b.status === "completed" ? "ok" : b.status === "cancelled" ? "neutral" : b.status === "disputed" ? "warn" : "brand"}>
            {b.status}
          </Badge>,
          ["confirmed", "in_progress", "disputed"].includes(b.status) ? (
            <form key="f" action={adminBookingAction} className="flex gap-1">
              <input type="hidden" name="id" value={b.id} />
              <Button name="to" value="completed" variant="secondary" className="min-h-9 px-3 text-xs">
                {t("dash.job_complete")}
              </Button>
              <Button name="to" value="cancelled" variant="danger" className="min-h-9 px-3 text-xs">
                {t("common.cancel")}
              </Button>
            </form>
          ) : null,
        ])}
      />
    </div>
  );
}
