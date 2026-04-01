"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";

interface ProductData { id: string; title: string; description: string; price: number; currency: string; category: string; ageRange: string; languages: string[]; pageCount: number; downloads: number; rating: number; reviewCount: number; previewUrl: string; thumbnail: string; }
interface SellerData { displayName: string; bio: string; country: string; isVerified: boolean; totalSales: number; }
interface Review { rating: number; comment: string | null; createdAt: string; }

export default function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const { data: session } = useSession();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [purchased, setPurchased] = useState(false);
  const [buying, setBuying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/marketplace/products/${productId}`).then(r => r.json()).then(d => {
      setProduct(d.product); setSeller(d.sellerProfile); setReviews(d.reviews || []);
      setPurchased(d.purchased); setLoading(false);
    }).catch(() => setLoading(false));
  }, [productId]);

  async function handleBuy() {
    if (!session) { window.location.href = "/login"; return; }
    setBuying(true);
    const res = await fetch("/api/marketplace/purchase", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else if (data.free || data.purchased) setPurchased(true);
    setBuying(false);
  }

  if (loading || !product) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/marketplace" className="text-sm text-gray-500">&larr; Marketplace</Link>
          <Link href="/" className="font-bold" style={{ color: "#1a6b4a" }}>Noor</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Main */}
        <div className="flex-1">
          <div className="aspect-[3/4] max-w-md bg-gray-100 rounded-xl mb-6 flex items-center justify-center text-6xl">&#128196;</div>

          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#f0ebe3", color: "#1a6b4a" }}>{product.category}</span>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-2 mb-2">{product.title}</h1>

          {product.rating > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-yellow-500">{"★".repeat(Math.round(product.rating))}</span>
              <span className="text-sm text-gray-400">({product.reviewCount} reviews)</span>
              <span className="text-sm text-gray-400">&middot; {product.downloads} downloads</span>
            </div>
          )}

          <div className="prose-article mb-8">
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          </div>

          {/* Seller card */}
          {seller && (
            <div className="card flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg">&#128100;</div>
              <div>
                <p className="font-bold text-gray-900">{seller.displayName} {seller.isVerified && "✓"}</p>
                <p className="text-xs text-gray-400">{seller.country} &middot; {seller.totalSales} sales</p>
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">Reviews</h2>
              {reviews.map((r, i) => (
                <div key={i} className="card mb-2 py-3 px-4">
                  <span className="text-yellow-500 text-sm">{"★".repeat(r.rating)}</span>
                  {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:w-72">
          <div className="card sticky top-20">
            <div className="text-center mb-4">
              <div className="text-3xl font-extrabold" style={{ color: product.price === 0 ? "#1a6b4a" : "#c9920a" }}>
                {product.price === 0 ? "Free" : `$${product.price.toFixed(2)}`}
              </div>
            </div>

            {purchased ? (
              <div className="text-center py-3 rounded-lg mb-3 font-bold" style={{ backgroundColor: "#e8f5ec", color: "#1a6b4a" }}>
                &#10003; Purchased — Check your downloads
              </div>
            ) : (
              <button onClick={handleBuy} disabled={buying} className="btn-primary w-full py-3 mb-3" style={{ backgroundColor: "#1a6b4a" }}>
                {buying ? "..." : product.price === 0 ? "Get Free" : `Buy Now — $${product.price.toFixed(2)}`}
              </button>
            )}

            <div className="text-xs text-gray-500 space-y-1.5 pt-3 border-t border-gray-100">
              <p>&#128196; {product.pageCount} pages</p>
              <p>&#128190; PDF — instant download</p>
              <p>&#127760; {product.languages.join(", ")}</p>
              <p>&#128118; Ages {product.ageRange}</p>
              <p>&#128274; 5 downloads per purchase</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
