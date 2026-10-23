"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { ShoppingBag, Lock, ShieldCheck } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatPrice, getShippingCost } from "@/lib/utils";
import { trackBeginCheckout } from "@/lib/analytics";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import FreeShippingBar from "@/components/layout/FreeShippingBar";

const PAYMENTS = ["Bancontact", "iDEAL", "Visa", "Mastercard", "PayPal", "Klarna"];

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const { data: session } = useSession();
  const locale = useLocale();
  const { items, totalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", street: "", houseNumber: "", postalCode: "", city: "", country: "BE" });

  useEffect(() => {
    setMounted(true);
    if (session?.user) setForm((p) => ({ ...p, email: session.user?.email || "" }));
  }, [session]);

  if (!mounted) return null;
  if (items.length === 0) return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center">
      <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
      <h1 className="text-2xl font-bold mb-3 font-[family-name:var(--font-heading)]">{tc("empty")}</h1>
      <Link href="/products"><Button>{tc("continueShopping")}</Button></Link>
    </div>
  );

  const subtotal = totalPrice();
  const shippingCost = shippingMethod === "express" ? 9.95 : getShippingCost(subtotal);
  const discount = couponApplied?.discount ?? 0;
  const total = Math.max(0, subtotal + shippingCost - discount);

  const applyCoupon = async () => {
    setCouponError(null);
    if (!coupon.trim()) return;
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponApplied(null);
        setCouponError(data.error || "Ongeldige kortingscode");
        return;
      }
      if (data.minOrder && subtotal < data.minOrder) {
        setCouponApplied(null);
        setCouponError(`Geldig vanaf een bestelling van ${formatPrice(data.minOrder)}`);
        return;
      }
      const value =
        data.discountType === "PERCENTAGE"
          ? (subtotal * data.discountValue) / 100
          : Math.min(data.discountValue, subtotal);
      setCouponApplied({ code: data.code, discount: value });
    } catch {
      setCouponError("Er ging iets mis. Probeer opnieuw.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    trackBeginCheckout(total);
    try {
      const res = await fetch("/api/checkout/mollie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, size: i.size, color: i.color })),
          shippingAddress: form,
          shippingMethod,
          couponCode: couponApplied?.code,
          locale,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Er is een fout opgetreden bij het afrekenen.");
    } catch {
      setError("Er is een fout opgetreden. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight font-[family-name:var(--font-heading)]">{t("title")}</h1>
      <p className="mb-8 mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald" />{t("securePayment")}</p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-2xl border border-border p-6 bg-white">
            <h2 className="font-semibold text-lg mb-6 font-[family-name:var(--font-heading)]">{t("shipping")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label={t("firstName")} required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <Input label={t("lastName")} required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              <div className="sm:col-span-2"><Input label={t("email")} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="sm:col-span-2"><Input label={t("phone")} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <Input label={t("street")} required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              <Input label={t("houseNumber")} required value={form.houseNumber} onChange={(e) => setForm({ ...form, houseNumber: e.target.value })} />
              <Input label={t("postalCode")} required value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
              <Input label={t("city")} required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("country")}</label>
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm cursor-pointer">
                  <option value="BE">{t("belgium")}</option>
                  <option value="NL">{t("netherlands")}</option>
                </select>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border p-6 bg-white">
            <h2 className="font-semibold text-lg mb-4 font-[family-name:var(--font-heading)]">{t("shippingMethod")}</h2>
            <div className="space-y-3">
              {[
                { id: "standard", label: t("standard"), price: getShippingCost(subtotal) },
                { id: "express", label: t("express"), price: 9.95 },
              ].map((method) => (
                <label key={method.id} className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${shippingMethod === method.id ? "border-emerald bg-emerald/5" : "border-border hover:border-emerald/50"}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="shipping" value={method.id} checked={shippingMethod === method.id} onChange={() => setShippingMethod(method.id)} className="h-4 w-4 accent-emerald cursor-pointer" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{method.price === 0 ? <span className="text-emerald">{tc("shippingFree")}</span> : formatPrice(method.price)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-28 rounded-2xl border border-border p-6 bg-white space-y-4">
            <h2 className="font-semibold text-lg font-[family-name:var(--font-heading)]">{t("orderSummary")}</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg">
                    <AtmosphereTile seed={item.name} label={item.name} showLabel={false} glyphClassName="h-1/2 w-1/2" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white">{item.quantity}</span>
                  </div>
                  <span className="flex-1 text-sm text-muted-foreground leading-tight line-clamp-2">{item.name}</span>
                  <span className="text-sm font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <hr className="border-border" />
            <FreeShippingBar subtotal={subtotal} />
            {/* Coupon */}
            <div>
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder={tc("couponPlaceholder")}
                  className="flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm uppercase placeholder:normal-case"
                />
                <button type="button" onClick={applyCoupon} className="h-11 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap cursor-pointer">
                  {tc("applyCoupon")}
                </button>
              </div>
              {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
              {couponApplied && <p className="mt-2 text-xs text-emerald">{couponApplied.code} — {formatPrice(couponApplied.discount)} korting</p>}
            </div>
            <hr className="border-border" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{tc("subtotal")}</span><span>{formatPrice(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{tc("discount")}</span><span className="text-emerald">-{formatPrice(discount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">{tc("shipping")}</span><span>{shippingCost === 0 ? <span className="text-emerald">{tc("shippingFree")}</span> : formatPrice(shippingCost)}</span></div>
            </div>
            <hr className="border-border" />
            <div className="flex justify-between font-semibold text-lg"><span>{tc("total")}</span><span>{formatPrice(total)}</span></div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              <Lock className="h-4 w-4 mr-2" />{t("payButton")}
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {PAYMENTS.map((p) => (
                <span key={p} className="rounded border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{p}</span>
              ))}
            </div>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{t("securePayment")}</p>
          </div>
        </div>
      </form>
    </div>
  );
}
