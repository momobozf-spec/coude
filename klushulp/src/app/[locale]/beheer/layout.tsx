import { redirect } from "next/navigation";
import { localeFromParams, href } from "@/lib/locale";
import { getCurrentUser } from "@/lib/session";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const user = await getCurrentUser();
  if (!user) redirect(href(locale, "/login"));
  if (user.role !== "admin") redirect(href(locale, user.role === "provider" ? "/dashboard" : "/"));
  const items = [
    ["/beheer", "admin.nav_overview", true],
    ["/beheer/dienstverleners", "admin.nav_providers"],
    ["/beheer/gebruikers", "admin.nav_users"],
    ["/beheer/aanvragen", "admin.nav_requests"],
    ["/beheer/boekingen", "admin.nav_bookings"],
    ["/beheer/meldingen", "admin.nav_reports"],
    ["/beheer/beoordelingen", "admin.nav_reviews"],
    ["/beheer/catalogus", "admin.nav_catalog"],
    ["/beheer/instellingen", "admin.nav_settings"],
  ] as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("admin.title")}</p>
      <DashboardNav items={items.map(([p, k, exact]) => ({ href: href(locale, p), label: t(k), exact: Boolean(exact) }))} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
