"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

interface SellerData { displayName: string; totalSales: number; totalEarnings: number; payoutsPending: number; stripeAccountId: string | null; isVerified: boolean; }
interface ProductItem { id: string; title: string; price: number; downloads: number; isApproved: boolean; isPublished: boolean; purchaseCount: number; createdAt: string; }

export default function SellerDashboard() {
  const { data: session } = useSession();
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ displayName: "", bio: "", country: "" });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Check if seller
      const pRes = await fetch("/api/seller/products");
      if (pRes.ok) {
        const pData = await pRes.json();
        setProducts(pData.products || []);
        setSeller({ displayName: "", totalSales: 0, totalEarnings: 0, payoutsPending: 0, stripeAccountId: null, isVerified: false });
      } else {
        setShowRegister(true);
      }
    } catch { setShowRegister(true); }
    setLoading(false);
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session, fetchData]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/seller/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regForm),
    });
    if (res.ok) { setShowRegister(false); fetchData(); }
  }

  async function connectStripe() {
    const res = await fetch("/api/seller/stripe-connect");
    const data = await res.json();
    if (data.onboardingUrl) window.location.href = data.onboardingUrl;
  }

  if (!session) return <div className="min-h-screen flex items-center justify-center"><Link href="/login" className="btn-primary">Log in</Link></div>;
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  // Registration form
  if (showRegister) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#faf9f5" }}>
        <form onSubmit={handleRegister} className="card w-full max-w-md">
          <h1 className="text-xl font-bold mb-4" style={{ color: "#1a6b4a" }}>Become a Seller</h1>
          <input type="text" placeholder="Display name" required className="input-field mb-3" value={regForm.displayName} onChange={e => setRegForm(f => ({ ...f, displayName: e.target.value }))} />
          <textarea placeholder="Bio — tell families about yourself" className="input-field mb-3" style={{ minHeight: 80 }} value={regForm.bio} onChange={e => setRegForm(f => ({ ...f, bio: e.target.value }))} />
          <input type="text" placeholder="Country" required className="input-field mb-4" value={regForm.country} onChange={e => setRegForm(f => ({ ...f, country: e.target.value }))} />
          <button type="submit" className="btn-primary w-full" style={{ backgroundColor: "#1a6b4a" }}>Create Seller Account</button>
        </form>
      </div>
    );
  }

  const totalEarnings = products.reduce((s, p) => s + p.purchaseCount * p.price * 0.7, 0);
  const totalDownloads = products.reduce((s, p) => s + p.downloads, 0);

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <nav className="bg-white/95 backdrop-blur border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <span className="font-bold" style={{ color: "#1a6b4a" }}>Seller Dashboard</span>
          <div className="flex gap-2">
            <Link href="/marketplace" className="text-sm text-gray-500">Marketplace</Link>
            <Link href="/sell/upload" className="btn-primary text-sm" style={{ backgroundColor: "#1a6b4a" }}>+ Upload</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Earnings", value: `$${totalEarnings.toFixed(2)}`, color: "#1a6b4a" },
            { label: "Pending Payout", value: `$${(totalEarnings * 0.3).toFixed(2)}`, color: "#c9920a" },
            { label: "Downloads", value: totalDownloads, color: "#333" },
            { label: "Products", value: products.length, color: "#333" },
          ].map((s, i) => (
            <div key={i} className="card text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Stripe Connect */}
        {!seller?.stripeAccountId && (
          <div className="card mb-6 flex items-center justify-between p-4" style={{ borderColor: "#c9920a", backgroundColor: "#fdf8ef" }}>
            <div>
              <p className="font-bold text-gray-900">Connect your bank account</p>
              <p className="text-xs text-gray-500">Required to receive payouts. Min $25.</p>
            </div>
            <button onClick={connectStripe} className="btn-primary text-sm" style={{ backgroundColor: "#c9920a" }}>Connect Bank</button>
          </div>
        )}

        {/* Products table */}
        <div className="card overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-900">Your Products</h2>
            <Link href="/sell/upload" className="text-sm font-medium hover:underline" style={{ color: "#1a6b4a" }}>+ Upload New</Link>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No products yet. Upload your first worksheet!</p>
              <Link href="/sell/upload" className="btn-primary" style={{ backgroundColor: "#1a6b4a" }}>Upload Worksheet</Link>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e8e4dc" }}>
                  <th style={{ textAlign: "left", padding: "8px 4px" }}>Title</th>
                  <th style={{ textAlign: "right", padding: "8px 4px" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "8px 4px" }}>Sales</th>
                  <th style={{ textAlign: "right", padding: "8px 4px" }}>Earnings</th>
                  <th style={{ textAlign: "center", padding: "8px 4px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "8px 4px" }}>{p.title}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>${p.price.toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>{p.purchaseCount}</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600, color: "#1a6b4a" }}>${(p.purchaseCount * p.price * 0.7).toFixed(2)}</td>
                    <td style={{ padding: "8px 4px", textAlign: "center" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        backgroundColor: p.isPublished ? "#e8f5ec" : p.isApproved ? "#fdf3d7" : "#f3f4f6",
                        color: p.isPublished ? "#1a6b4a" : p.isApproved ? "#c9920a" : "#666",
                      }}>
                        {p.isPublished ? "LIVE" : p.isApproved ? "APPROVED" : "PENDING"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
