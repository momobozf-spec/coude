"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, ScanLine, Search, User, Users } from "lucide-react";
import { clsx } from "clsx";

/**
 * Onderbalk voor mobiel.
 *
 * Scan staat in het midden en is visueel het zwaarst: dat is de reden dat
 * iemand de app opent. De overige items zijn er zodat de navigatiestructuur al
 * klopt wanneer fase 6 en 7 hun schermen invullen; ze wijzen nu naar bestaande
 * routes of naar een nette placeholder, nooit naar een dood einde.
 *
 * `aria-current="page"` markeert de actieve pagina — niet alleen de kleur, want
 * die is voor een screenreader onzichtbaar.
 */
interface NavItem {
  href: string;
  label: string;
  icon: typeof Search;
  /** Scan krijgt visueel meer gewicht: dat is de reden dat de app open gaat. */
  primary?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { href: "/search", label: "Zoeken", icon: Search },
  { href: "/community", label: "Community", icon: Users },
  { href: "/scan", label: "Scan", icon: ScanLine, primary: true },
  { href: "/favorites", label: "Favorieten", icon: Heart },
  { href: "/profile", label: "Profiel", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--surface)]"
      style={{ borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors",
                  active ? "text-[var(--foreground)]" : "text-[var(--muted)]",
                )}
              >
                <span
                  className={clsx(
                    "flex items-center justify-center rounded-full",
                    item.primary && "h-10 w-10 bg-[var(--foreground)] text-[var(--background)]",
                  )}
                >
                  <Icon aria-hidden="true" className={item.primary ? "h-5 w-5" : "h-5 w-5"} />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
