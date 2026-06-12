import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SettingsLayout({
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
      <header className="bg-white border-b border-emerald-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-16 gap-4">
            <Link
              href="/dashboard"
              className="text-emerald-700 hover:text-emerald-800 p-2 -ml-2 rounded-xl hover:bg-emerald-50 transition-colors"
            >
              {"\u2190"}
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{"\u2B50"}</span>
              <span className="text-xl font-bold text-emerald-700">
                Instellingen
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 page-enter">
        {children}
      </main>
    </div>
  );
}
