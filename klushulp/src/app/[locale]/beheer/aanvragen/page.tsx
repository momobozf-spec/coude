import { desc, eq } from "drizzle-orm";
import { localeFromParams, formatDateTime } from "@/lib/locale";
import { db } from "@/db";
import { category, jobRequest } from "@/db/schema";
import { pick, type MessageKey } from "@/i18n";
import { Badge, Button, PageTitle } from "@/components/ui";
import { Table } from "@/components/admin-table";
import { adminCancelRequestAction } from "../actions";

export default async function AdminRequests({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const rows = await db.select({ r: jobRequest, c: category }).from(jobRequest).innerJoin(category, eq(category.id, jobRequest.categoryId)).orderBy(desc(jobRequest.createdAt)).limit(200);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.nav_requests")}</PageTitle>
      <Table
        head={[t("common.date"), t("req.category_label"), t("req.municipality_label"), t("req.contact_name"), "Matches", t("common.status"), ""]}
        rows={rows.map(({ r, c }) => [
          formatDateTime(r.createdAt, locale),
          pick(c, "name", locale),
          `${r.postcode} ${r.municipality}`,
          <span key="c">
            {r.contactName}
            <br />
            <span className="text-xs text-muted">{r.contactEmail}</span>
          </span>,
          r.matchCount,
          <Badge key="s" tone={r.status === "open" ? "brand" : r.status === "booked" ? "ok" : "neutral"}>
            {t(`mine.status_${r.status}` as MessageKey)}
          </Badge>,
          r.status === "open" ? (
            <form key="f" action={adminCancelRequestAction}>
              <input type="hidden" name="id" value={r.id} />
              <Button variant="danger" className="min-h-9 px-3 text-xs">
                {t("common.cancel")}
              </Button>
            </form>
          ) : null,
        ])}
      />
    </div>
  );
}
