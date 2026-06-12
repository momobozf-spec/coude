import Link from "next/link";
import { Instagram, Facebook, Mail } from "lucide-react";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "Hele shop" },
      { href: "/gift-boxes", label: "Eid pakketten" },
      { href: "/collections", label: "Collecties" },
      { href: "/shop?audience=him", label: "Voor hem" },
      { href: "/shop?audience=her", label: "Voor haar" },
      { href: "/shop?audience=kids", label: "Voor de kinderen" },
    ],
  },
  {
    title: "Hulp",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/faq", label: "Veelgestelde vragen" },
      { href: "/faq#shipping", label: "Verzending" },
      { href: "/faq#returns", label: "Retourneren" },
      { href: "/faq#tracking", label: "Bestelling volgen" },
    ],
  },
  {
    title: "Bayt Noor",
    links: [
      { href: "/about", label: "Ons verhaal" },
      { href: "/about#values", label: "Onze waarden" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Voorwaarden" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-cream-200 bg-cream-100/60">
      {/* Subtle Arabic geometric pattern */}
      <svg
        className="pointer-events-none absolute h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="footer-pat" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M20 4 L36 20 L20 36 L4 20 Z" fill="none" stroke="#3a4527" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#footer-pat)" />
      </svg>

      <div className="relative mx-auto max-w-7xl px-4 py-16 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="font-display text-3xl text-forest-800">
              Bayt <span className="text-warmbrown-500">Noor</span>
            </Link>
            <p className="mt-2 text-[11px] uppercase tracking-[0.25em] text-warmbrown-500">
              Van ons gezin, naar het jouwe.
            </p>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-warmbrown-600">
              Bayt Noor is een kleine familiezaak, opgericht door twee
              gezinshoofden. Wij maken het makkelijk om Eid en andere gezegende
              momenten warm en betekenisvol te vieren — met respect voor onze
              tradities, en met liefde voor de mensen om ons heen.
            </p>
            <div className="mt-6 flex gap-2.5">
              <a
                href="#"
                aria-label="Instagram"
                className="grid h-10 w-10 place-items-center rounded-full border border-cream-300 text-warmbrown-500 transition-colors hover:border-olive-400 hover:text-olive-600"
              >
                <Instagram size={15} />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="grid h-10 w-10 place-items-center rounded-full border border-cream-300 text-warmbrown-500 transition-colors hover:border-olive-400 hover:text-olive-600"
              >
                <Facebook size={15} />
              </a>
              <a
                href="mailto:hallo@baytnoor.com"
                aria-label="Email"
                className="grid h-10 w-10 place-items-center rounded-full border border-cream-300 text-warmbrown-500 transition-colors hover:border-olive-400 hover:text-olive-600"
              >
                <Mail size={15} />
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 text-[10px] uppercase tracking-[0.16em] text-warmbrown-500">
              <div className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-3 text-center">
                Wereldwijde<br />verzending
              </div>
              <div className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-3 text-center">
                Veilig<br />betalen
              </div>
              <div className="rounded-xl border border-cream-300 bg-cream-50 px-3 py-3 text-center">
                Met liefde<br />verpakt
              </div>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-warmbrown-500">
                {col.title}
              </h4>
              <ul className="space-y-2.5 text-sm text-warmbrown-700">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-olive-600 transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cream-300 pt-6 text-xs text-warmbrown-500 md:flex-row">
          <p>
            © {new Date().getFullYear()} Bayt Noor — Met de wil van Allah
            opgebouwd, alhamdulillah.
          </p>
          <p className="flex items-center gap-3 opacity-80">
            <span>Visa</span>
            <span>·</span>
            <span>Mastercard</span>
            <span>·</span>
            <span>Bancontact</span>
            <span>·</span>
            <span>iDEAL</span>
            <span>·</span>
            <span>PayPal</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
