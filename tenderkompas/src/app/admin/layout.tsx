import { requireAdmin } from "@/lib/dal";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAdmin();
  return (
    <AppShell
      area="Beheer"
      userLabel={u.email}
      nav={[
        { href: "/admin", label: "Overzicht" },
        { href: "/admin/procedures", label: "Opdrachten" },
        { href: "/admin/beoordelingen", label: "Reviews" },
        { href: "/admin/klanten", label: "Klanten" },
        { href: "/admin/digests", label: "Digests" },
        { href: "/admin/bronnen", label: "Bronnen & import" },
        { href: "/admin/leads", label: "Aanvragen" },
        { href: "/admin/instellingen", label: "Regels & gewichten" },
      ]}
    >
      {children}
    </AppShell>
  );
}
