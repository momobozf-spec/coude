import { desc, eq } from "drizzle-orm";
import { localeFromParams, formatDateTime } from "@/lib/locale";
import { db } from "@/db";
import { provider, review } from "@/db/schema";
import { Badge, Button, Input, PageTitle } from "@/components/ui";
import { Table } from "@/components/admin-table";
import { adminReviewAction } from "../actions";

export default async function AdminReviews({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const rows = await db.select({ r: review, p: provider }).from(review).innerJoin(provider, eq(provider.id, review.providerId)).orderBy(desc(review.createdAt)).limit(200);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.nav_reviews")}</PageTitle>
      <Table
        head={[t("common.date"), t("admin.nav_providers"), t("mine.review_rating"), t("mine.review_body"), t("common.status"), ""]}
        rows={rows.map(({ r, p }) => [
          formatDateTime(r.createdAt, locale),
          p.displayName,
          `${r.rating}/5`,
          <span key="b" className="whitespace-pre-wrap">
            {r.body || "—"} <span className="text-xs text-muted">— {r.authorName}</span>
          </span>,
          <Badge key="s" tone={r.visible ? "ok" : "neutral"}>
            {r.visible ? t("admin.show") : t("admin.hide")}
          </Badge>,
          <form key="f" action={adminReviewAction} className="flex gap-1">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="visible" value={r.visible ? "0" : "1"} />
            <Input name="note" placeholder={t("admin.note")} defaultValue={r.moderationNote ?? ""} className="min-h-9 w-40 text-xs" />
            <Button variant="secondary" className="min-h-9 px-3 text-xs">
              {r.visible ? t("admin.hide") : t("admin.show")}
            </Button>
          </form>,
        ])}
      />
    </div>
  );
}
