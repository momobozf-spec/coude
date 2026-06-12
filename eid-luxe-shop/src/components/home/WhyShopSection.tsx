import { Heart, Home, Leaf, Hand } from "lucide-react";

const ITEMS = [
  {
    icon: Home,
    title: "Een familiezaak",
    body: "Wij zijn twee partners en gezinshoofden. Wat wij voor jou kiezen, kiezen wij ook voor onze eigen families.",
  },
  {
    icon: Heart,
    title: "Met intentie samengesteld",
    body: "Geen massaproductie. Elk pakket is rustig samengebracht, met respect voor wie het zal openen.",
  },
  {
    icon: Leaf,
    title: "Eerlijk en halal",
    body: "Onze producten zijn halal en bewust gekozen — dadels uit Madinah, oud zonder alcohol, eerlijke ingrediënten.",
  },
  {
    icon: Hand,
    title: "Met liefde verpakt",
    body: "Ieder pakje wordt door ons of door familie ingepakt. Een kaartje erbij, een dua erin.",
  },
];

export function WhyShopSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
      <div className="mb-12 max-w-2xl">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
          Onze waarden
        </span>
        <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
          Een collectie geïnspireerd door eenvoud,
          <span className="italic text-warmbrown-600"> familie</span> en samenzijn.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-warmbrown-600">
          Wij geloven dat Eid niet groots hoeft te zijn om mooi te zijn — een
          dadel, een dua, een goed gesprek. Bayt Noor wil families helpen om die
          kleine, gezegende momenten samen te beleven.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((it) => (
          <div
            key={it.title}
            className="rounded-2xl border border-cream-200 bg-cream-50 p-6 transition-colors hover:border-cream-300"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream-200 text-olive-600">
              <it.icon size={18} strokeWidth={1.6} />
            </span>
            <h3 className="mt-5 font-display text-lg leading-tight text-forest-800">
              {it.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-warmbrown-600">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
