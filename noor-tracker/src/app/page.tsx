import Link from "next/link";

const features = [
  {
    emoji: "\u2705",
    title: "Dagelijkse gewoontes",
    description: "10+ islamitische gewoontes om elke dag bij te houden",
  },
  {
    emoji: "\u2B50",
    title: "Sterren verdienen",
    description: "Elk afgeronde gewoonte levert een ster op als beloning",
  },
  {
    emoji: "\uD83D\uDD25",
    title: "Streak bijhouden",
    description: "Bouw een reeks op van opeenvolgende dagen",
  },
  {
    emoji: "\uD83D\uDCCA",
    title: "Wekelijks rapport",
    description: "Ontvang elke zondag een overzicht per e-mail",
  },
];

const testimonials = [
  {
    name: "Fatima M.",
    text: "Mijn dochter is zo gemotiveerd! Ze wil elke dag haar sterren verdienen.",
    avatar: "\uD83E\uDDD5",
  },
  {
    name: "Ahmed B.",
    text: "Eindelijk een app die ons helpt om onze kinderen islamitische gewoontes aan te leren.",
    avatar: "\uD83E\uDDD4",
  },
  {
    name: "Khadija A.",
    text: "De wekelijkse rapporten zijn geweldig. Ik kan precies zien hoe het gaat.",
    avatar: "\uD83E\uDDD5",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{"\u2B50"}</span>
              <span className="text-xl font-bold text-emerald-700">
                Noor Tracker
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-emerald-700 hover:text-emerald-800 font-medium transition-colors"
              >
                Inloggen
              </Link>
              <Link
                href="/register"
                className="bg-emerald-700 text-white px-5 py-2 rounded-full font-medium hover:bg-emerald-800 transition-colors"
              >
                Gratis starten
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 islamic-pattern">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-gold-50 text-gold-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span>{"\uD83C\uDF1F"}</span>
            <span>Gratis starten — geen creditcard nodig</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Help je kind{" "}
            <span className="text-emerald-700">islamitische gewoontes</span>{" "}
            opbouwen{" "}
            <span className="text-gold-500">— ster voor ster</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Dagelijkse gebeden, Quran lezen, dua&apos;s en meer. Jouw kind verdient
            sterren voor elke goede gewoonte en bouwt zo een prachtige reeks op.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-emerald-700 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-emerald-800 transition-all hover:shadow-lg hover:shadow-emerald-200 inline-flex items-center justify-center gap-2"
            >
              Start gratis
              <span>{"\u2192"}</span>
            </Link>
            <a
              href="#pricing"
              className="border-2 border-emerald-200 text-emerald-700 px-8 py-4 rounded-full text-lg font-bold hover:bg-emerald-50 transition-all inline-flex items-center justify-center gap-2"
            >
              Bekijk prijzen
            </a>
          </div>

          {/* Mock app preview */}
          <div className="mt-16 max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl shadow-emerald-100 p-6 border border-emerald-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-2xl">
                  {"\u2B50"}
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900">Youssef</p>
                  <p className="text-sm text-gray-500">Vandaag: 7/10 gewoontes</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-gold-500">7{"\u2B50"}</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { emoji: "\uD83C\uDF05", name: "Fajr gebed", done: true },
                  { emoji: "\u2600\uFE0F", name: "Dhuhr gebed", done: true },
                  { emoji: "\uD83D\uDCD6", name: "Quran lezen", done: true },
                  { emoji: "\u2728", name: "Bismillah", done: false },
                ].map((habit) => (
                  <div
                    key={habit.name}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      habit.done
                        ? "bg-emerald-50 border border-emerald-200"
                        : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <span className="text-xl">{habit.emoji}</span>
                    <span className="font-medium text-gray-700">{habit.name}</span>
                    <span className="ml-auto">
                      {habit.done ? (
                        <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm">
                          {"\u2713"}
                        </span>
                      ) : (
                        <span className="w-6 h-6 border-2 border-gray-300 rounded-full block" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900 mb-4">
            Alles wat je nodig hebt
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-xl mx-auto">
            Noor Tracker maakt het leuk en eenvoudig voor kinderen om dagelijks
            hun islamitische gewoontes bij te houden.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-100 hover:shadow-lg hover:shadow-emerald-50 transition-all"
              >
                <div className="text-4xl mb-4">{feature.emoji}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 islamic-pattern">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900 mb-12">
            Hoe werkt het?
          </h2>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                emoji: "\uD83D\uDCDD",
                title: "Maak een account",
                desc: "Registreer gratis en voeg je kind toe met naam en leeftijd.",
              },
              {
                step: "2",
                emoji: "\u2705",
                title: "Vink gewoontes af",
                desc: "Elke dag vink je de gewoontes af die je kind heeft gedaan.",
              },
              {
                step: "3",
                emoji: "\uD83C\uDF1F",
                title: "Verdien sterren",
                desc: "Je kind verdient sterren en bouwt een prachtige reeks op!",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-emerald-700 text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
                  {item.emoji}
                </div>
                <div className="text-sm font-bold text-emerald-600 mb-1">
                  Stap {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900 mb-4">
            Eenvoudige prijzen
          </h2>
          <p className="text-center text-gray-600 mb-12">
            Start gratis en upgrade wanneer je klaar bent voor meer.
          </p>

          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free plan */}
            <div className="bg-white border-2 border-gray-200 rounded-3xl p-8">
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                Gratis
              </div>
              <div className="text-4xl font-extrabold text-gray-900 mb-1">
                {"\u20AC"}0
                <span className="text-lg font-normal text-gray-500">/maand</span>
              </div>
              <p className="text-gray-600 text-sm mb-6">
                Perfect om te beginnen
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  "1 kind",
                  "10 gewoontes",
                  "7 dagen geschiedenis",
                  "Streak bijhouden",
                  "Sterren verdienen",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-500">{"\u2713"}</span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="block w-full text-center bg-gray-100 text-gray-700 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors"
              >
                Gratis starten
              </Link>
            </div>

            {/* Pro plan */}
            <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 text-white rounded-3xl p-8 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-gold-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Populair
              </div>
              <div className="text-sm font-bold text-emerald-200 uppercase tracking-wide mb-2">
                Pro
              </div>
              <div className="text-4xl font-extrabold mb-1">
                {"\u20AC"}4,99
                <span className="text-lg font-normal text-emerald-200">
                  /maand
                </span>
              </div>
              <p className="text-emerald-200 text-sm mb-6">
                Voor het hele gezin
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  "3 kinderen",
                  "14+ gewoontes",
                  "Volledige geschiedenis",
                  "Wekelijks e-mail rapport",
                  "Badge systeem",
                  "Prioriteits support",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <span className="text-gold-400">{"\u2713"}</span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="block w-full text-center bg-white text-emerald-700 py-3 rounded-full font-bold hover:bg-emerald-50 transition-colors"
              >
                Start met Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 islamic-pattern">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center text-gray-900 mb-12">
            Wat ouders zeggen
          </h2>

          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{t.avatar}</span>
                  <div>
                    <p className="font-bold text-gray-900">{t.name}</p>
                    <div className="flex text-gold-400 text-sm">
                      {"\u2605\u2605\u2605\u2605\u2605"}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">&ldquo;{t.text}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-emerald-700 text-white islamic-pattern islamic-pattern-gold">
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Begin vandaag nog
          </h2>
          <p className="text-emerald-100 text-lg mb-8">
            Gratis starten — geen creditcard nodig. Help je kind om dagelijks
            dichter bij Allah te komen.
          </p>
          <Link
            href="/register"
            className="bg-white text-emerald-700 px-8 py-4 rounded-full text-lg font-bold hover:bg-emerald-50 transition-all inline-flex items-center gap-2 hover:shadow-lg"
          >
            Start gratis {"\u2192"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{"\u2B50"}</span>
                <span className="text-xl font-bold text-white">
                  Noor Tracker
                </span>
              </div>
              <p className="text-sm">
                Islamitische gewoontes voor kinderen. Gebouwd met liefde voor de
                moslimgemeenschap.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    Prijzen
                  </a>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white transition-colors">
                    Registreren
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    Inloggen
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-3">Juridisch</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="cursor-pointer hover:text-white transition-colors">
                    Privacy
                  </span>
                </li>
                <li>
                  <span className="cursor-pointer hover:text-white transition-colors">
                    Voorwaarden
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; 2026 Noor Tracker. Alle rechten voorbehouden.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
