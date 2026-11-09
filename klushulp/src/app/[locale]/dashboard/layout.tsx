import { redirect } from "next/navigation";
import { localeFromParams, href } from "@/lib/locale";
import { getCurrentProvider, getCurrentUser } from "@/lib/session";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale, t } = await localeFromParams(params);
  const user = await getCurrentUser();
  if (!user) redirect(href(locale, "/login"));
  const cp = await getCurrentProvider();
  if (!cp) redirect(href(locale, user.role === "admin" ? "/beheer" : "/"));
  const items = [
    { href: href(locale, "/dashboard"), label: t("dash.nav_overview"), exact: true },
    { href: href(locale, "/dashboard/aanvragen"), label: t("dash.nav_requests") },
    { href: href(locale, "/dashboard/opdrachten"), label: t("dash.nav_jobs") },
    { href: href(locale, "/dashboard/profiel"), label: t("dash.nav_profile") },
    { href: href(locale, "/dashboard/beschikbaarheid"), label: t("dash.nav_availability") },
    { href: href(locale, "/dashboard/verificaties"), label: t("dash.nav_verifications") },
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <DashboardNav items={items} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
