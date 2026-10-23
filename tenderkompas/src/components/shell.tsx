import Link from "next/link";
import { signOutAction } from "@/app/login/actions";

export function AppShell({
  area,
  nav,
  userLabel,
  orgLabel,
  children,
}: {
  area: "Beheer" | "Klantportaal";
  nav: { href: string; label: string }[];
  userLabel: string;
  orgLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Link href={area === "Beheer" ? "/admin" : "/portal"} className="font-semibold">
              TenderKompas IT
            </Link>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{area}</span>
            {orgLabel && <span className="text-sm text-navy-100">· {orgLabel}</span>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-navy-100 sm:inline">{userLabel}</span>
            <form action={signOutAction}>
              <button className="rounded border border-white/20 px-2 py-0.5 text-xs hover:bg-white/10">Afmelden</button>
            </form>
          </div>
        </div>
        <nav className="border-t border-white/10 bg-navy-950/40">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap px-3 py-2 text-sm text-navy-100 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
