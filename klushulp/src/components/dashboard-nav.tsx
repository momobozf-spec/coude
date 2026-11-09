"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNav({ items }: { items: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4" aria-label="Dashboard">
      <ul className="flex gap-1 border-b border-line">
        {items.map((it) => {
          const active = it.exact ? path === it.href : path.startsWith(it.href);
          return (
            <li key={it.href} className="shrink-0">
              <Link href={it.href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${active ? "border-brand text-brand-strong" : "border-transparent text-muted hover:text-ink"}`}>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
