import { LinkButton } from "@/components/ui/Button";
import { Heart, Home, Hand, Sprout } from "lucide-react";

const VALUES = [
  {
    icon: Home,
    title: "Familie eerst",
    body: "Voor wij iets aanbieden, vragen we ons af: zou ik dit aan mijn moeder, mijn vrouw, of aan mijn kinderen geven?",
  },
  {
    icon: Hand,
    title: "Met onze eigen handen",
    body: "Wij pakken zelf in, schrijven zelf de kaartjes, en antwoorden zelf op je berichten. Geen onpersoonlijk callcenter.",
  },
  {
    icon: Sprout,
    title: "Klein en eerlijk",
    body: "We zijn geen luxemerk. We zijn een kleine zaak. Onze prijzen zijn eerlijk, en onze marges nederig.",
  },
  {
    icon: Heart,
    title: "Met intentie",
    body: "Bij elk pakket dat het huis verlaat, maken we een dua: dat het de ontvanger blij maakt, en baraka brengt.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Soft hero */}
      <section className="relative overflow-hidden bg-cream-100">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="about-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M24 4 L44 24 L24 44 L4 24 Z" fill="none" stroke="#3a4527" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="200" height="200" fill="url(#about-pat)" />
        </svg>
        <div className="relative mx-auto max-w-4xl px-4 py-20 lg:px-6 lg:py-28">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            Ons verhaal
          </span>
          <h1 className="mt-3 font-display text-5xl leading-[1.1] text-forest-800 sm:text-6xl">
            Wij zijn twee gezinnen,
            <br />
            <span className="italic text-warmbrown-600">
              en deze zaak is van ons.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-warmbrown-600 sm:text-lg">
            Wij zijn twee partners. Twee mannen, twee vaders, twee
            gezinshoofden. We hebben Bayt Noor opgezet rond een tafel — niet
            in een vergaderzaal — met de wens om iets op te bouwen waar wij,
            in shaa Allah, trots op kunnen zijn.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-4xl px-4 py-20 lg:px-6">
        <div className="grid gap-12 lg:grid-cols-[5fr_6fr] lg:items-start">
          {/* Visual placeholder */}
          <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-olive-700 p-10 shadow-soft">
            <div className="flex h-full flex-col justify-between text-cream-50/95">
              <span className="text-[11px] uppercase tracking-[0.25em] text-cream-200/75">
                Bismillah
              </span>
              <div>
                <svg viewBox="0 0 100 100" className="mb-5 h-20 w-20 opacity-90">
                  {/* Two stylised figures, side by side, suggesting partnership */}
                  <g fill="none" stroke="#f1e3b8" strokeWidth="1.4" strokeLinecap="round">
                    <circle cx="35" cy="40" r="9" />
                    <path d="M22 80 Q22 55 35 55 Q48 55 48 80" />
                    <circle cx="65" cy="40" r="9" />
                    <path d="M52 80 Q52 55 65 55 Q78 55 78 80" />
                  </g>
                </svg>
                <p className="font-display text-2xl leading-snug">
                  &ldquo;Wij wilden geen merk bouwen.
                  <br />
                  Wij wilden iets bouwen waar onze kinderen later, in shaa
                  Allah, met trots op kunnen kijken.&rdquo;
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-cream-200/70">
                  — De oprichters
                </p>
              </div>
            </div>
          </div>
          <div>
            <h2 id="values" className="font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
              Van een keukentafel
              <span className="italic text-warmbrown-600"> in Antwerpen.</span>
            </h2>
            <div className="mt-6 grid gap-4 text-base leading-relaxed text-warmbrown-700">
              <p>
                Bayt Noor begon als een gesprek tussen twee vrienden. Twee
                gezinshoofden die allebei merkten dat het &mdash; ondanks alles
                wat we online kunnen kopen &mdash; moeilijk was om voor Eid
                geschenken te vinden die echt iets betekenen. Iets wat past bij
                onze tradities, onze waarden, onze manier van vieren.
              </p>
              <p>
                We wilden geen luxemerk worden, en we wilden zeker niet de
                snelste, goedkoopste of grootste zijn. Wij wilden een plek
                bouwen waar families &mdash; in België, Nederland, Frankrijk,
                en daarbuiten &mdash; rustig kunnen kiezen voor mensen waar ze
                van houden, met de zekerheid dat alles met liefde en respect
                is samengesteld.
              </p>
              <p>
                Vandaag werken we direct met telers in Madinah, ambachtslieden
                in Marrakech, en met onze familie hier in Antwerpen die mee
                helpt inpakken wanneer het druk wordt. Dat is wie we zijn.
              </p>
              <p className="pt-2 italic text-warmbrown-600">
                Van ons gezin, naar het jouwe.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/shop" variant="primary">Bekijk de collectie</LinkButton>
              <LinkButton href="/contact" variant="ghost">Schrijf ons gerust</LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="border-y border-cream-200 bg-cream-100/60 py-20">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <div className="mb-12 max-w-2xl">
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
              Wat ons leidt
            </span>
            <h2 className="mt-3 font-display text-4xl leading-tight text-forest-800 sm:text-5xl">
              Vier waarden,
              <span className="italic text-warmbrown-600"> elke dag.</span>
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-cream-200 bg-cream-50 p-6"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream-200 text-olive-600">
                  <v.icon size={18} strokeWidth={1.6} />
                </span>
                <h3 className="mt-5 font-display text-lg leading-tight text-forest-800">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-warmbrown-600">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center lg:px-6">
        <p className="font-display text-3xl leading-snug text-forest-800 sm:text-4xl">
          &ldquo;Het beste van de mensen is degene die het meest van nut is voor
          de mensen.&rdquo;
        </p>
        <p className="mt-3 text-sm tracking-wide text-warmbrown-500">
          — Hadith, overgeleverd door Tabarani
        </p>
        <p className="mt-8 text-base leading-relaxed text-warmbrown-600">
          Wij hopen dat Bayt Noor &mdash; op zijn kleine, bescheiden manier
          &mdash; van nut mag zijn voor jouw familie. Dat onze pakketten een
          glimlach mogen brengen, of een goed gesprek, of gewoon een rustige
          avond samen.
        </p>
        <p className="mt-6 text-base font-medium text-forest-800">
          Eid Mubarak, en barakallahu fikum.
        </p>
      </section>
    </>
  );
}
