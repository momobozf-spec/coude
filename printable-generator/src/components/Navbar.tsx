"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { href: "/dashboard", label: "Werkbladen", emoji: "📄" },
  { href: "/games", label: "Spelletjes", emoji: "🎮" },
  { href: "/academy", label: "Academy", emoji: "🎓" },
  { href: "/books", label: "Kleurboek", emoji: "🎨" },
  { href: "/marketplace", label: "Marktplaats", emoji: "🛒" },
  { href: "/prayer", label: "Gebed", emoji: "🕌" },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-md border-b border-emerald-100"
          : "bg-white border-b border-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold transition-transform group-hover:scale-110"
              style={{ background: "linear-gradient(135deg, #1a6b4a, #27a562)" }}
            >
              ن
            </div>
            <div>
              <span className="font-bold text-[#1a6b4a] text-lg leading-none block">Noor</span>
              <span className="text-xs text-[#4a6b55] leading-none">Printables</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? "text-[#1a6b4a] bg-emerald-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span>{link.emoji}</span>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="btn-outline hidden sm:flex text-sm"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors"
                >
                  Uitloggen
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 hidden sm:flex px-3 py-1.5 rounded-lg transition-colors"
                >
                  Inloggen
                </Link>
                <Link href="/register" className="btn-primary text-sm">
                  Gratis Starten
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-emerald-50 transition-colors"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              aria-label="Menu"
            >
              <div className="w-5 flex flex-col gap-1.5">
                <div
                  className={`h-0.5 bg-[#1a6b4a] transition-all duration-300 ${
                    isMobileOpen ? "rotate-45 translate-y-2" : ""
                  }`}
                />
                <div
                  className={`h-0.5 bg-[#1a6b4a] transition-all duration-300 ${
                    isMobileOpen ? "opacity-0" : ""
                  }`}
                />
                <div
                  className={`h-0.5 bg-[#1a6b4a] transition-all duration-300 ${
                    isMobileOpen ? "-rotate-45 -translate-y-2" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-300 overflow-hidden ${
            isMobileOpen ? "max-h-96 pb-4" : "max-h-0"
          }`}
        >
          <div className="flex flex-col gap-1 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? "text-[#1a6b4a] bg-emerald-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-xl">{link.emoji}</span>
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2 mt-2 border-t border-emerald-100">
              {session ? (
                <Link
                  href="/dashboard"
                  className="btn-primary flex-1 text-center"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="btn-outline flex-1 text-center"
                  >
                    Inloggen
                  </Link>
                  <Link
                    href="/register"
                    className="btn-primary flex-1 text-center"
                  >
                    Gratis Starten
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
