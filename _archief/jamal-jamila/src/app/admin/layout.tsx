import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Admin | Layali",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/nl/login");
  }

  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full bg-cream">
        <Providers>
          <div className="flex min-h-screen">
            <AdminSidebar />
            <main className="flex-1 overflow-auto">
              <div className="p-8">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
