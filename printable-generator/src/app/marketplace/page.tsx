"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface Product { id: string; title: string; thumbnail: string; price: number; category: string; rating: number; reviewCount: number; downloads: number; ageRange: string; languages: string[]; sellerName: string; isFeatured: boolean; }

const CATEGORIES = ["All", "Ramadan", "Arabic Letters", "Islamic Values", "Eid", "Quran", "General"];

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "All") params.set("category", filter);
    if (search) params.set("q", search);
    fetch(`/api/marketplace/products?${params}`).then(r => r.json()).then(d => {
      setProducts(d.products || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filter, search]);

  const featured = products.filter(p => p.isFeatured);

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold" style={{ color: "#1a6b4a" }}>Noor Marketplace</Link>
          <div className="flex gap-2">
            <Link href="/sell" className="btn-outline text-sm">Sell Worksheets</Link>
            <Link href="/dashboard" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>Dashboard</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Islamic Worksheets by Muslim Educators</h1>
        <p className="text-gray-500 mb-6">Browse worksheets created by teachers worldwide</p>
        <div className="max-w-lg mx-auto">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search worksheets..."
            className="input-field" />
        </div>
      </section>

      {/* Filters */}
      <div className="px-4 pb-4">
        <div className="max-w-6xl mx-auto flex gap-2 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap"
              style={filter === cat ? { backgroundColor: "#1a6b4a", color: "#fff" } : { backgroundColor: "#fff", color: "#666", border: "1px solid #e0dbd3" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="px-4 pb-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-3">&#11088; Featured</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {featured.map(p => (
                <Link key={p.id} href={`/marketplace/${p.id}`} className="card hover:shadow-lg transition-all group">
                  <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-3xl">&#128196;</div>
                  <p className="text-xs text-gray-400">{p.sellerName}</p>
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-green-800 truncate">{p.title}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-yellow-500">{"★".repeat(Math.round(p.rating || 0))}</span>
                    <span className="font-bold" style={{ color: p.price === 0 ? "#1a6b4a" : "#c9920a" }}>
                      {p.price === 0 ? "Free" : `$${p.price.toFixed(2)}`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All products */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-lg font-bold text-gray-900 mb-3">All Worksheets</h2>
          {loading ? (
            <div className="text-center text-gray-400 py-12">Loading...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">&#128196;</p>
              <p className="text-gray-500">No worksheets found. Be the first to sell!</p>
              <Link href="/sell" className="mt-4 inline-block btn-primary" style={{ backgroundColor: "#1a6b4a" }}>Start Selling</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map(p => (
                <Link key={p.id} href={`/marketplace/${p.id}`} className="card hover:shadow-md transition-all group">
                  <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-3xl">&#128196;</div>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#f0ebe3", color: "#1a6b4a" }}>{p.category}</span>
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-green-800 mt-1 truncate">{p.title}</h3>
                  <p className="text-xs text-gray-400">{p.sellerName} &middot; {p.ageRange}</p>
                  <div className="flex justify-between items-center mt-2">
                    {p.rating > 0 && <span className="text-xs text-yellow-500">{"★".repeat(Math.round(p.rating))} ({p.reviewCount})</span>}
                    <span className="font-bold text-sm" style={{ color: p.price === 0 ? "#1a6b4a" : "#c9920a" }}>
                      {p.price === 0 ? "Free" : `$${p.price.toFixed(2)}`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Become a seller banner */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto rounded-2xl p-8 text-center text-white" style={{ background: "linear-gradient(135deg, #1a6b4a, #145239)" }}>
          <h2 className="text-2xl font-bold mb-2">Share your Islamic worksheets with 10,000+ families</h2>
          <p className="text-green-100 mb-4">Earn 70% on every sale. Free to list.</p>
          <Link href="/sell" className="inline-block px-8 py-3 rounded-lg font-bold bg-white" style={{ color: "#1a6b4a" }}>
            Start Selling &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
