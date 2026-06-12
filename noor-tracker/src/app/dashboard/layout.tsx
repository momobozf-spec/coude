import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardNav } from "./_components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#fafdf8]">
      {/* Top navigation */}
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">{"\u2B50"}</span>
              <span className="text-xl font-bold text-emerald-700">
                Noor Tracker
              </span>
            </Link>

            <DashboardNav
              userName={session.user.name ?? ""}
              userPlan={session.user.plan}
            />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 page-enter">
        {children}
      </main>
    </div>
  );
}
