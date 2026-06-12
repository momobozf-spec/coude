import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Noor Printables — Islamitisch Educatief Platform voor Kinderen",
};

const features = [
  { icon: "📄", title: "Werkbladen", desc: "500+ islamitische werkbladen voor elke leeftijd", href: "/dashboard", color: "#1a6b4a" },
  { icon: "🎮", title: "12 Educatieve Games", desc: "Interactieve spelletjes die leren leuk maken", href: "/games", color: "#c9920a" },
  { icon: "🎓", title: "Noor Academy", desc: "Video cursussen van gecertificeerde leraren", href: "/academy", color: "#1a6b4a" },
  { icon: "🎨", title: "Kleurboek Maken", desc: "Gepersonaliseerde islamitische kleurboeken", href: "/books", color: "#c9920a" },
  { icon: "👨\u200d👩\u200d👧", title: "Community", desc: "Connect met ouders en leraren wereldwijd", href: "/marketplace", color: "#1a6b4a" },
  { icon: "🌙", title: "Ramadan Challenge", desc: "Speciale Ramadan activiteiten voor gezinnen", href: "/ramadan-challenge", color: "#c9920a" },
];

const stats = [
  { value: "10,000+", label: "Families" },
  { value: "500+", label: "Werkbladen" },
  { value: "12", label: "Spelletjes" },
  { value: "4", label: "Talen" },
];

export default function HomePage() {
  return (
    <div className="overflow-hidden">
      {/* ── Hero Section ── */}
      <section className="relative min-h-[85vh] flex items-center pattern-islamic">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-amber-50 opacity-80" />

        {/* Decorative circles */}
        <div
          className="absolute top-20 right-10 w-64 h-64 rounded-full opacity-10 animate-spin-slow"
          style={{ background: "radial-gradient(circle, #1a6b4a, transparent)", border: "2px solid #1a6b4a" }}
        />
        <div
          className="absolute bottom-20 left-10 w-48 h-48 rounded-full opacity-10 animate-float"
          style={{ background: "radial-gradient(circle, #c9920a, transparent)" }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            {/* Arabic bismillah */}
            <p className="font-arabic text-2xl mb-4 animate-fade-in" style={{ color: "#c9920a" }}>
              بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
            </p>

            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold mb-6 animate-fade-in"
              style={{ background: "#dcf5e7", color: "#1a6b4a", animationDelay: "100ms" }}
            >
              <span>🌟</span>
              Islamitisch Educatief Platform
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight animate-fade-in" style={{ animationDelay: "200ms" }}>
              Leren met{" "}
              <span style={{ color: "#1a6b4a" }}>Noor</span>
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #c9920a, #f9d24d)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Vreugde &amp; Geloof
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-10 max-w-2xl leading-relaxed animate-fade-in" style={{ animationDelay: "300ms" }}>
              Ontdek honderden islamitische werkbladen, interactieve spelletjes en videolessen
              speciaal gemaakt voor kinderen van 4 tot 8 jaar oud.
            </p>

            <div className="flex flex-wrap gap-4 animate-fade-in" style={{ animationDelay: "400ms" }}>
              <Link href="/register" className="btn-primary text-lg px-8 py-4 rounded-2xl">
                &#128640; Gratis Beginnen
              </Link>
              <Link href="/games" className="btn-outline text-lg px-8 py-4 rounded-2xl">
                &#127918; Bekijk Games
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 mt-12 animate-fade-in" style={{ animationDelay: "500ms" }}>
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold" style={{ color: "#1a6b4a" }}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="divider-islamic">
            <span className="text-2xl">&#10022;</span>
          </div>
          <h2 className="section-title text-4xl">Alles voor islamitisch leren</h2>
          <p className="section-subtitle text-lg">Eén platform voor ouders, leraren en scholen</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {features.map((feature, i) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="card-islamic card-hover p-6 group animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4 transition-transform group-hover:scale-110"
                style={{ background: feature.color + "15" }}
              >
                {feature.icon}
              </div>
              <h3 className="font-bold text-xl mb-2" style={{ color: feature.color }}>
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              <div className="mt-4 text-sm font-semibold flex items-center gap-1" style={{ color: feature.color }}>
                Ontdekken &rarr;
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Pricing CTA ── */}
      <section className="py-24 px-4" style={{ background: "linear-gradient(135deg, #0f3d2a 0%, #1a6b4a 100%)" }}>
        <div className="max-w-4xl mx-auto text-center text-white">
          <p className="text-amber-300 font-arabic text-xl mb-4">اَللّٰهُ نُوْرُ السَّمٰوٰتِ وَالْاَرْضِ</p>
          <h2 className="text-4xl font-bold mb-4">Begin vandaag nog &mdash; gratis</h2>
          <p className="text-emerald-200 text-lg mb-10 max-w-2xl mx-auto">
            Krijg toegang tot 50+ gratis werkbladen en 3 spelletjes. Upgrade naar Pro voor onbeperkte toegang.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-gold text-lg px-10 py-4 rounded-2xl">
              &#10024; Gratis Account Aanmaken
            </Link>
            <Link
              href="/#pricing"
              className="px-10 py-4 rounded-2xl text-lg font-semibold border-2 border-white/30 text-white hover:bg-white/10 transition-all inline-flex items-center justify-center"
            >
              Bekijk Prijzen
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
