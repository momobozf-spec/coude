import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;

  if (!session || user?.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 sm:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
