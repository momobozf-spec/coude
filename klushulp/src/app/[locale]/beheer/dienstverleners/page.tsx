import Link from "next/link";
import { localeFromParams, href, formatDate } from "@/lib/locale";
import { listProvidersForAdmin } from "@/lib/services/admin";
import type { MessageKey } from "@/i18n";
import { Badge, PageTitle } from "@/components/ui";
import { Table } from "@/components/admin-table";

export default async function AdminProviders({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const rows = await listProvidersForAdmin();
  const tone = (s: string) => (s === "active" ? "ok" : s === "pending" ? "warn" : s === "suspended" ? "danger" : "neutral");
  return (
    <div className="space-y-4">
      <PageTitle>{t("admin.nav_providers")}</PageTitle>
      <Table
        head={[t("prof.display_name"), t("auth.email"), "KBO", t("common.status"), t("common.date")]}
        rows={rows.map(({ provider: p, user: u }) => [
          <Link key="n" href={href(locale, `/beheer/dienstverleners/${p.id}`)} className="font-semibold text-brand underline-offset-4 hover:underline">
            {p.displayName} {p.isDemo && <Badge tone="warn">{t("common.demo_badge")}</Badge>}
          </Link>,
          u.email,
          p.kboNumber ?? "—",
          <Badge key="s" tone={tone(p.status)}>
            {t(`dash.status_${p.status}` as MessageKey).split(".")[0]}
          </Badge>,
          formatDate(p.createdAt, locale, { day: "numeric", month: "short", year: "numeric" }),
        ])}
      />
    </div>
  );
}
