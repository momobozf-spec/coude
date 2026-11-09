import { desc } from "drizzle-orm";
import { localeFromParams, formatDate } from "@/lib/locale";
import { db } from "@/db";
import { user } from "@/db/schema";
import { Badge, PageTitle } from "@/components/ui";
import { Table } from "@/components/admin-table";

export default async function AdminUsers({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const rows = await db.select().from(user).orderBy(desc(user.createdAt)).limit(200);
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.nav_users")}</PageTitle>
      <Table head={[t("req.contact_name"), t("auth.email"), "Rol", t("common.date")]} rows={rows.map((u) => [u.name, u.email, <Badge key="r" tone={u.platformRole === "admin" ? "danger" : u.platformRole === "provider" ? "brand" : "neutral"}>{u.platformRole}</Badge>, formatDate(u.createdAt, locale, { day: "numeric", month: "short", year: "numeric" })])} />
    </div>
  );
}
