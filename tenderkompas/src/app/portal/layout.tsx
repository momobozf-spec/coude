import { requireClient } from "@/lib/dal";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const c = await requireClient();
  return (
    <AppShell
      area="Klantportaal"
      userLabel={c.user.email}
      orgLabel={c.orgName}
      nav={[
        { href: "/portal", label: "Kansen" },
        { href: "/portal/profiel", label: "Bedrijfsprofiel" },
        { href: "/portal/instellingen", label: "Meldingen" },
        { href: "/portal/bronnen", label: "Bronnen & dekking" },
      ]}
    >
      {c.isDemo && <div className="mb-4 rounded-md border border-warn-700/30 bg-warn-50 px-3 py-2 text-sm text-warn-700">Demo-omgeving: alle gegevens hier zijn herkenbaar fictief.</div>}
      {children}
    </AppShell>
  );
}
