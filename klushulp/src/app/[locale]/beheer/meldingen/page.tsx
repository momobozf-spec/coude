import { desc } from "drizzle-orm";
import { localeFromParams, formatDateTime } from "@/lib/locale";
import { db } from "@/db";
import { report } from "@/db/schema";
import type { MessageKey } from "@/i18n";
import { Badge, Button, Input, PageTitle, Select } from "@/components/ui";
import { Table } from "@/components/admin-table";
import { adminReportAction } from "../actions";

export default async function AdminReports({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const rows = await db.select().from(report).orderBy(desc(report.createdAt)).limit(200);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.nav_reports")}</PageTitle>
      <Table
        head={[t("common.date"), t("report.reason"), t("report.details"), t("common.status"), ""]}
        rows={rows.map((r) => [
          <span key="d">
            {formatDateTime(r.createdAt, locale)}
            <br />
            <span className="text-xs text-muted">{r.reporterRole} · {r.reporterContact ?? ""}</span>
          </span>,
          t(`report.reason_${r.reason}` as MessageKey),
          <span key="x" className="whitespace-pre-wrap">
            {r.details || "—"}
            {r.adminNote && <span className="block text-xs text-muted">{t("admin.note")}: {r.adminNote}</span>}
          </span>,
          <Badge key="s" tone={r.status === "open" ? "danger" : r.status === "in_review" ? "warn" : "neutral"}>
            {r.status}
          </Badge>,
          <form key="f" action={adminReportAction} className="flex flex-wrap gap-1">
            <input type="hidden" name="id" value={r.id} />
            <Select name="status" defaultValue={r.status} className="min-h-9 w-36 py-0 text-xs">
              {["open", "in_review", "resolved", "dismissed"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Input name="note" placeholder={t("admin.note")} defaultValue={r.adminNote ?? ""} className="min-h-9 w-40 text-xs" />
            <Button variant="secondary" className="min-h-9 px-3 text-xs">
              {t("common.save")}
            </Button>
          </form>,
        ])}
      />
    </div>
  );
}
