"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useI18n } from "@/i18n/context";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { trackEvent } from "@/lib/analytics";

export default function Home() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [yearly, setYearly] = useState(true);

  async function handleLeadCapture(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "hero" }),
    });
    setLeadCaptured(true);
    trackEvent("lead_captured", { source: "hero" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav - sticky */}
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold" style={{ color: "#0d9488" }}>
            Noor Printables
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:inline">Pricing</a>
            {session ? (
              <Link href="/dashboard" className="btn-primary text-sm">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn-secondary text-sm">Log in</Link>
                <Link href="/register" className="btn-primary text-sm">Start Free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* ====== HERO ====== */}
        <section className="px-4 pt-16 pb-20 text-center" style={{ background: "linear-gradient(180deg, #faf9f6 0%, #f0ebe3 100%)" }}>
          <div className="max-w-3xl mx-auto">
            {/* Social proof bar */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6" style={{ backgroundColor: "#ecfdf5", color: "#0d9488" }}>
              <span>&#11088;</span> Trusted by 2,400+ Muslim parents &amp; 180+ Islamic schools
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-5">
              Islamic Educational
              <br />
              <span style={{ color: "#0d9488" }}>Printables &amp; Digital Activities</span>
              <br />
              <span className="text-3xl sm:text-4xl">for Kids Aged 4-8</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 mb-3 max-w-2xl mx-auto">
              Generate <strong>coloring pages</strong>, <strong>mazes</strong>, <strong>word searches</strong> &amp; <strong>digital coloring</strong> around
              Ramadan, Eid, Arabic letters &amp; Islamic values.
              <br />
              <span className="text-base text-gray-400">Ready in 10 seconds. Print at home or use in the classroom.</span>
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 mb-4">
              <Link href="/register" className="btn-primary text-lg px-10 py-3.5 shadow-lg hover:shadow-xl">
                Start Free &mdash; No Credit Card
              </Link>
              <a href="#demo" className="btn-secondary text-lg px-8 py-3.5">
                See Examples &#8595;
              </a>
            </div>
            <p className="text-xs text-gray-400">3 free sheets &middot; Upgrade anytime &middot; Cancel anytime</p>
          </div>
        </section>

        {/* ====== LOGOS / TRUST ====== */}
        <section className="py-8 bg-white border-y border-gray-100">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Used by teachers &amp; parents at</p>
            <div className="flex flex-wrap justify-center gap-8 items-center text-gray-300 text-sm font-medium">
              <span>Al-Noor Academy</span>
              <span>&middot;</span>
              <span>Iqra School London</span>
              <span>&middot;</span>
              <span>Dar Al-Arqam</span>
              <span>&middot;</span>
              <span>Islamic School of Amsterdam</span>
              <span>&middot;</span>
              <span>200+ more</span>
            </div>
          </div>
        </section>

        {/* ====== HOW IT WORKS ====== */}
        <section className="py-16 px-4" id="demo">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">How It Works</h2>
            <p className="text-center text-gray-500 mb-12">Three steps to Islamic educational activities</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: "#ecfdf5" }}>1</div>
                <h3 className="font-bold text-gray-900 mb-2">Choose Activity</h3>
                <p className="text-sm text-gray-500">Coloring page, maze, word search, or digital coloring</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: "#fdf8ef" }}>2</div>
                <h3 className="font-bold text-gray-900 mb-2">Pick a Theme</h3>
                <p className="text-sm text-gray-500">Ramadan, Eid, Mosque, Arabic letters, Islamic values &amp; more</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: "#ecfdf5" }}>3</div>
                <h3 className="font-bold text-gray-900 mb-2">Download or Color Online</h3>
                <p className="text-sm text-gray-500">Get instant PDF or let kids color digitally on any device</p>
              </div>
            </div>
          </div>
        </section>

        {/* ====== FEATURES ====== */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Everything You Need</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { icon: "&#127769;", title: "Coloring Pages", desc: "Mosques, crescents, lanterns, geometric patterns" },
                { icon: "&#128300;", title: "Mazes", desc: "Find the path to the mosque or iftar table" },
                { icon: "&#128260;", title: "Word Search", desc: "Islamic vocabulary: Salah, Quran, Sabr..." },
                { icon: "&#127912;", title: "Digital Coloring", desc: "Color on phone, tablet or laptop", highlight: true },
                { icon: "&#128196;", title: "Instant PDF", desc: "Download and print in seconds" },
                { icon: "&#127979;", title: "For Schools", desc: "Classroom tools, bulk generation" },
                { icon: "&#127760;", title: "4 Languages", desc: "English, Dutch, French, German" },
                { icon: "&#128274;", title: "Commercial Use", desc: "Use in your school or tutoring business" },
              ].map((f, i) => (
                <div key={i} className="card text-center" style={f.highlight ? { borderColor: "#0d9488", borderWidth: 2 } : {}}>
                  <div className="text-3xl mb-2" dangerouslySetInnerHTML={{ __html: f.icon }} />
                  <h3 className="font-semibold text-gray-900 text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== SOCIAL PROOF ====== */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">What Parents &amp; Teachers Say</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { quote: "My kids love the Ramadan coloring pages! We use them every day during the month. So much better than generic printables.", name: "Fatima A.", role: "Mother of 3, Birmingham" },
                { quote: "I use Noor Printables for all 6 of my weekend Islamic school classes. The maze worksheets are a hit. Worth every cent of the School plan.", name: "Br. Ahmed K.", role: "Islamic School Teacher, Amsterdam" },
                { quote: "The digital coloring is genius — my daughter colors on my iPad during long car rides. Islamic content I actually want her engaging with.", name: "Sarah M.", role: "Mother, Toronto" },
              ].map((t2, i) => (
                <div key={i} className="card">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <span key={j} className="text-yellow-400 text-sm">&#9733;</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 italic mb-3">&ldquo;{t2.quote}&rdquo;</p>
                  <p className="text-sm font-semibold text-gray-900">{t2.name}</p>
                  <p className="text-xs text-gray-400">{t2.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PRICING ====== */}
        <section className="py-16 px-4 bg-white" id="pricing">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Simple Pricing</h2>
            <p className="text-center text-gray-500 mb-6">Start free. Upgrade when you&apos;re ready.</p>

            {/* Yearly / Monthly toggle */}
            <div className="flex justify-center mb-10">
              <div className="inline-flex items-center gap-3 p-1 rounded-full bg-gray-100">
                <button
                  onClick={() => setYearly(false)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={!yearly ? { backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" } : { color: "#666" }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setYearly(true)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={yearly ? { backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" } : { color: "#666" }}
                >
                  Yearly <span className="text-xs font-bold" style={{ color: "#0d9488" }}>Save 33%</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {/* Free */}
              <div className="card text-center">
                <h3 className="font-bold text-gray-900 text-lg">Free</h3>
                <p className="text-4xl font-extrabold text-gray-900 my-3">$0</p>
                <p className="text-sm text-gray-500 mb-6">Get a taste</p>
                <Link href="/register" className="btn-secondary w-full mb-6">Start Free</Link>
                <ul className="text-left text-sm space-y-2">
                  {["3 printable sheets", "All activity types", "3 digital coloring templates", "Watermarked exports"].map((f, i) => (
                    <li key={i} className="flex gap-2 text-gray-600"><span className="text-gray-300">&#10003;</span>{f}</li>
                  ))}
                </ul>
              </div>

              {/* Pro - MOST POPULAR */}
              <div className="card text-center relative" style={{ borderColor: "#0d9488", borderWidth: 2 }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#0d9488" }}>
                  MOST POPULAR
                </div>
                <h3 className="font-bold text-lg mt-2" style={{ color: "#0d9488" }}>Pro</h3>
                <p className="text-4xl font-extrabold text-gray-900 my-3">
                  ${yearly ? "8" : "12"}<span className="text-base font-normal text-gray-400">/mo</span>
                </p>
                {yearly && <p className="text-xs text-gray-400 -mt-2 mb-1">Billed $97/year (save $47)</p>}
                <p className="text-sm text-gray-500 mb-6">For parents &amp; tutors</p>
                <Link href="/register" className="btn-primary w-full mb-6 shadow-md">Get Pro</Link>
                <ul className="text-left text-sm space-y-2">
                  {["Unlimited printable sheets", "All activity types", "All digital coloring templates", "No watermarks", "Priority new themes", "Commercial use license"].map((f, i) => (
                    <li key={i} className="flex gap-2 text-gray-700"><span style={{ color: "#0d9488" }}>&#10003;</span><strong>{f}</strong></li>
                  ))}
                </ul>
              </div>

              {/* School */}
              <div className="card text-center" style={{ borderColor: "#d4a843", backgroundColor: "#fdfcf9" }}>
                <h3 className="font-bold text-lg" style={{ color: "#d4a843" }}>School</h3>
                <p className="text-4xl font-extrabold text-gray-900 my-3">
                  ${yearly ? "33" : "49"}<span className="text-base font-normal text-gray-400">/mo</span>
                </p>
                {yearly && <p className="text-xs text-gray-400 -mt-2 mb-1">Billed $397/year (save $191)</p>}
                <p className="text-sm text-gray-500 mb-6">For schools &amp; organizations</p>
                <Link href="/register" className="btn-gold w-full mb-6 shadow-md">Get School Plan</Link>
                <ul className="text-left text-sm space-y-2">
                  {["Everything in Pro", "Up to 25 teacher accounts", "Bulk PDF generation", "Custom school branding", "Classroom management", "Curriculum-aligned themes", "Priority support", "Invoice billing"].map((f, i) => (
                    <li key={i} className="flex gap-2 text-gray-700"><span style={{ color: "#d4a843" }}>&#10003;</span>{f}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              All plans include: iDEAL, Bancontact, SEPA, credit card &middot; Cancel anytime &middot; 30-day money-back guarantee
            </p>
          </div>
        </section>

        {/* ====== LEAD CAPTURE ====== */}
        <section className="py-16 px-4" style={{ background: "linear-gradient(180deg, #f0ebe3 0%, #faf9f6 100%)" }}>
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Get Free Islamic Activity Sheets</h2>
            <p className="text-gray-500 mb-6">Join 2,400+ Muslim parents. We&apos;ll send you 3 free printable sheets + new themes every week.</p>

            {leadCaptured ? (
              <div className="p-4 rounded-lg text-sm font-medium" style={{ backgroundColor: "#ecfdf5", color: "#0d9488" }}>
                JazakAllahu Khairan! Check your inbox for your free sheets.
              </div>
            ) : (
              <form onSubmit={handleLeadCapture} className="flex gap-2">
                <input
                  type="email"
                  className="input-field flex-1"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn-primary whitespace-nowrap px-6">
                  Get Free Sheets
                </button>
              </form>
            )}
            <p className="text-xs text-gray-400 mt-2">No spam. Unsubscribe anytime.</p>
          </div>
        </section>

        {/* ====== FAQ ====== */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">Frequently Asked Questions</h2>

            {[
              { q: "Is the content reviewed for Islamic accuracy?", a: "Yes. All themes and word lists are curated to be age-appropriate and aligned with mainstream Islamic values." },
              { q: "Can I use this in my Islamic school?", a: "Absolutely! The School plan is designed specifically for Islamic schools with multi-teacher support, bulk generation, and custom branding." },
              { q: "What age range is this for?", a: "Activities are designed for children aged 4-8, with varying difficulty levels to suit different ages within that range." },
              { q: "Can my kids color on a tablet?", a: "Yes! Our digital coloring feature works on any device — phone, tablet, or laptop — with full touch support." },
              { q: "What payment methods do you accept?", a: "We accept credit/debit cards, iDEAL (NL), Bancontact (BE), and SEPA direct debit across Europe." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel anytime from your dashboard. No questions asked. We also offer a 30-day money-back guarantee." },
            ].map((faq, i) => (
              <details key={i} className="group border-b border-gray-100 py-4">
                <summary className="flex justify-between items-center cursor-pointer text-gray-900 font-medium">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ====== FINAL CTA ====== */}
        <section className="py-20 px-4 text-center" style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}>
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Give Your Children
              <br />Islamic Learning They&apos;ll Love
            </h2>
            <p className="text-teal-100 mb-8 text-lg">
              Join thousands of Muslim parents and teachers using Noor Printables.
            </p>
            <Link href="/register" className="inline-flex items-center justify-center bg-white font-bold text-lg px-10 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all" style={{ color: "#0d9488" }}>
              Start Free Today &rarr;
            </Link>
            <p className="text-teal-200 text-xs mt-4">No credit card required &middot; 3 free sheets &middot; Upgrade anytime</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="font-bold" style={{ color: "#0d9488" }}>Noor Printables</p>
            <p className="text-xs text-gray-400">Islamic educational printables for kids &copy; 2026</p>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#pricing" className="hover:text-gray-600">Pricing</a>
            <Link href="/login" className="hover:text-gray-600">Login</Link>
            <Link href="/register" className="hover:text-gray-600">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
