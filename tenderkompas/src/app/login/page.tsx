import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/dal";
import { btn, Notice } from "@/components/ui";
import { signInAction } from "./actions";

export const metadata = { title: "Aanmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const u = await getSessionUser();
  if (u) redirect(u.platformRole === "admin" ? "/admin" : "/portal");
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-semibold text-navy-900">
          TenderKompas IT
        </Link>
        <div className="rounded-lg border border-line bg-white p-6">
          <h1 className="mb-4 text-xl font-semibold text-navy-900">Aanmelden</h1>
          {sp.fout && (
            <div className="mb-4">
              <Notice tone="bad">{sp.fout}</Notice>
            </div>
          )}
          {sp.error === "geen-organisatie" && (
            <div className="mb-4">
              <Notice tone="warn">Uw account is nog niet aan een organisatie gekoppeld. Neem contact op met de beheerder.</Notice>
            </div>
          )}
          <form action={signInAction} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="email">E-mailadres</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1">
              <label htmlFor="password">Wachtwoord</label>
              <input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <button className={btn("primary") + " w-full"} type="submit">
              Aanmelden
            </button>
          </form>
          <p className="mt-4 text-xs text-muted">Accounts worden tijdens de pilot door de beheerder aangemaakt.</p>
        </div>
      </div>
    </main>
  );
}
