"use client";

import Link from "next/link";
import { BOOK_VARIANTS } from "@/lib/printful";

export default function BooksPage() {
  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#1a6b4a" }}>Noor Printables</Link>
          <div className="flex gap-2">
            <Link href="/dashboard" className="btn-outline text-sm">Dashboard</Link>
            <Link href="/books/create" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>Create Book</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-16 pb-12 text-center" style={{ background: "linear-gradient(180deg, #faf9f5, #e8f5ec)" }}>
        <span className="text-xs font-bold px-3 py-1 rounded-full mb-4 inline-block" style={{ backgroundColor: "#e8f5ec", color: "#1a6b4a" }}>PRINT ON DEMAND</span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
          Turn Worksheets into a
          <br /><span style={{ color: "#1a6b4a" }}>Keepsake Book</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-xl mx-auto mb-3">
          Personalized Islamic coloring books — printed and delivered to your door.
          Perfect for Eid gifts, Ramadan memory books, and classroom sets.
        </p>
        <p className="text-sm text-gray-400 mb-8">Delivered in 5-10 business days &middot; From &euro;19.99</p>
        <Link href="/books/create" className="btn-primary text-lg px-10 py-3.5 shadow-lg" style={{ backgroundColor: "#1a6b4a" }}>
          Create Your Book &rarr;
        </Link>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { step: "1", icon: "&#127912;", title: "Choose Worksheets", desc: "Pick 10-30 pages from your library or templates" },
              { step: "2", icon: "&#9998;", title: "Personalize", desc: "Add your child's name, cover design, dedication" },
              { step: "3", icon: "&#128065;", title: "Preview", desc: "See your complete book before ordering" },
              { step: "4", icon: "&#128230;", title: "Order", desc: "Delivered to your door in 5-10 days" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: "#e8f5ec" }} dangerouslySetInnerHTML={{ __html: s.icon }} />
                <h3 className="font-bold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Book Options</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {(Object.entries(BOOK_VARIANTS) as [string, typeof BOOK_VARIANTS.softcover_20][]).map(([key, v]) => (
              <div key={key} className="card text-center" style={key === "softcover_30" ? { borderColor: "#1a6b4a", borderWidth: 2 } : {}}>
                {key === "softcover_30" && <div className="text-xs font-bold mb-2" style={{ color: "#1a6b4a" }}>POPULAR</div>}
                <h3 className="font-bold">{v.label}</h3>
                <p className="text-3xl font-extrabold my-3">&euro;{v.priceEur}</p>
                <p className="text-xs text-gray-400 mb-3">{v.size} &middot; Full color</p>
                <p className="text-xs text-gray-500">+ shipping from &euro;4.99</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">What Families Say</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { quote: "Ordered for Eid — my daughter cried happy tears!", name: "Fatima", city: "Rotterdam" },
              { quote: "The quality is amazing. Already ordered a second one!", name: "Sara", city: "London" },
              { quote: "Our whole class got one. Best end-of-year gift!", name: "Teacher Aisha", city: "Amsterdam" },
            ].map((t, i) => (
              <div key={i} className="card">
                <div className="text-yellow-400 text-sm mb-2">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <p className="text-sm text-gray-600 italic mb-2">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-xs text-gray-400">{t.name}, {t.city}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 text-center" style={{ background: "linear-gradient(135deg, #1a6b4a, #145239)" }}>
        <h2 className="text-3xl font-extrabold text-white mb-4">Create a Book Your Child Will Treasure</h2>
        <Link href="/books/create" className="inline-block px-10 py-4 rounded-lg font-bold text-lg bg-white" style={{ color: "#1a6b4a" }}>
          Start Creating &rarr;
        </Link>
        <p className="text-green-200 text-xs mt-4">Perfect for Eid gifts &#127873;</p>
      </section>

      <footer className="text-center py-6 text-sm text-gray-400">Noor Printables &copy; 2026</footer>
    </div>
  );
}
