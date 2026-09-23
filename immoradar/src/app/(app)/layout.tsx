import { db } from "@/lib/db";
import { requireTenant } from "@/lib/auth/tenant";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, agencyName } = await requireTenant();
  const agencies = user.role === "PLATFORM_ADMIN" ? await db.agency.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [];
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} agencyName={agencyName} agencies={agencies} />
      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
