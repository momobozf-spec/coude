import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Games", href: "/games" },
  { label: "Academy", href: "/academy" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Books", href: "/books" },
  { label: "Blog", href: "/blog" },
  { label: "Prayer", href: "/prayer" },
  { label: "Pricing", href: "/#pricing" },
];

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🌙</span>
              <span className="font-bold" style={{ color: "#0d9488" }}>Noor Printables</span>
            </div>
            <p className="text-xs text-gray-400 max-w-xs">
              Islamic educational activities for kids aged 4-8. Coloring pages, mazes, word searches, games, and more.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map(link => (
              <Link key={link.href} href={link.href} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-gray-300">&copy; {new Date().getFullYear()} Noor Printables. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-gray-300">
            <span>Made with ❤️ for the Ummah</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
