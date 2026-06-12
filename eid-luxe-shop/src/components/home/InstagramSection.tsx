import { Instagram } from "lucide-react";

const TILES = [
  { color1: "#5e6b3f", color2: "#3a4527", caption: "Eid bij ons thuis" },
  { color1: "#cdb888", color2: "#856a48", caption: "Dadels uit Madinah" },
  { color1: "#a87651", color2: "#523e25", caption: "Met de kinderen" },
  { color1: "#7a8458", color2: "#4a5631", caption: "Inpakken samen" },
  { color1: "#e2d2ad", color2: "#cdb888", caption: "Het kaartje schrijven" },
  { color1: "#3a4527", color2: "#2b341c", caption: "Stille avonden" },
];

export function InstagramSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
      <div className="mb-10 max-w-xl">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
          Onze familiemomenten
        </span>
        <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
          Kleine momenten,
          <span className="italic text-warmbrown-600"> grote betekenis.</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-warmbrown-600">
          We delen geen reclame. Wel onze keuken, ons inpaktafeltje, en de
          rust voor en na de Eid-prayer.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map((t, i) => (
          <a
            key={i}
            href="#"
            className="group relative aspect-square overflow-hidden rounded-2xl shadow-soft transition-shadow hover:shadow-warm"
            style={{
              background: `linear-gradient(135deg, ${t.color1} 0%, ${t.color2} 100%)`,
            }}
          >
            <svg
              className="absolute inset-0 h-full w-full opacity-15"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <pattern id={`igpat-${i}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                  <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="#fbf8f1" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill={`url(#igpat-${i})`} />
            </svg>
            <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/40 to-transparent p-3 text-cream-50 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="text-xs font-medium">{t.caption}</span>
              <Instagram size={15} />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
