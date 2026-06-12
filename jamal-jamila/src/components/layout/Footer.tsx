"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Camera, Music2, Bookmark, Mail, MapPin, Send, Check, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { brand } from "@/lib/brand";

const PAYMENTS = ["Bancontact", "iDEAL", "Visa", "Mastercard", "PayPal", "Klarna"];

export default function Footer() {
  const t = useTranslations("footer");
  const tHome = useTranslations("home");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (res.ok) {
        setSubscribed(true);
        setEmail("");
      }
    } catch {
      /* silent — non-critical */
    }
  };

  return (
    <footer className="border-t border-border bg-espresso text-cream">
      {/* Reassurance strip */}
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            { icon: Truck, title: tHome("trustShipping"), desc: tHome("trustShippingDesc") },
            { icon: RotateCcw, title: t("returnsTitle"), desc: t("returnsDesc") },
            { icon: ShieldCheck, title: tHome("trustSecure"), desc: tHome("trustSecureDesc") },
          ].map((item) => (
            <div key={item.title} className="flex items-center justify-center gap-3 sm:justify-start">
              <item.icon className="h-6 w-6 text-gold-light" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-white/60">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          {/* Brand + newsletter */}
          <div className="col-span-2">
            <span className="text-2xl font-bold uppercase tracking-[0.18em] font-[family-name:var(--font-heading)] text-cream">{brand.name}</span>
            <span className="ml-2 font-[family-name:var(--font-serif)] text-lg text-gold-light">{brand.arabic}</span>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">{t("tagline")}</p>

            <p className="mt-6 text-sm font-semibold">{t("newsletter")}</p>
            <p className="mt-1 text-xs text-white/55">{tHome("newsletterSubtitle")}</p>
            {subscribed ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2.5 text-sm text-gold-light">
                <Check className="h-4 w-4" />{tHome("newsletterThanks")}
              </p>
            ) : (
              <form onSubmit={subscribe} className="mt-3 flex max-w-sm gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tHome("newsletterPlaceholder")}
                  className="h-11 w-full rounded-full border border-white/15 bg-white/5 px-4 text-sm text-cream placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold-light/40"
                />
                <button type="submit" className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-gold px-5 text-sm font-semibold text-espresso transition-colors hover:bg-gold-light cursor-pointer">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}

            <div className="mt-6 flex items-center gap-3">
              <a href={brand.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15"><Camera className="h-4 w-4" /></a>
              <a href={brand.social.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15"><Music2 className="h-4 w-4" /></a>
              <a href={brand.social.pinterest} target="_blank" rel="noopener noreferrer" aria-label="Pinterest" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 transition-colors hover:bg-white/15"><Bookmark className="h-4 w-4" /></a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">{t("shopTitle")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/products?sort=newest" className="text-white/65 transition-colors hover:text-cream">{t("linkNew")}</Link></li>
              <li><Link href="/products?bestseller=true" className="text-white/65 transition-colors hover:text-cream">{t("linkBest")}</Link></li>
              <li><Link href="/products?category=tea-experience" className="text-white/65 transition-colors hover:text-cream">Theemoment</Link></li>
              <li><Link href="/products?category=candles-lanterns" className="text-white/65 transition-colors hover:text-cream">Kaarsen & Lantaarns</Link></li>
              <li><Link href="/products?category=fragrance" className="text-white/65 transition-colors hover:text-cream">Geur</Link></li>
              <li><Link href="/products?category=gifts" className="text-white/65 transition-colors hover:text-cream">Cadeaus</Link></li>
              <li><Link href="/products?sale=true" className="text-gold-light transition-colors hover:text-cream">{t("linkSale")}</Link></li>
            </ul>
          </div>

          {/* Marketplace */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">{t("marketplaceTitle")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/services" className="text-white/65 transition-colors hover:text-cream">{tNav("services")}</Link></li>
              <li><Link href="/vendors" className="text-white/65 transition-colors hover:text-cream">{tNav("vendors")}</Link></li>
              <li><Link href="/sell" className="text-gold-light transition-colors hover:text-cream">{tNav("sell")}</Link></li>
              <li><Link href="/account" className="text-white/65 transition-colors hover:text-cream">{t("account")}</Link></li>
              <li><Link href="/account/wishlist" className="text-white/65 transition-colors hover:text-cream">{t("favorites")}</Link></li>
            </ul>
          </div>

          {/* Service */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">{t("supportTitle")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/contact" className="text-white/65 transition-colors hover:text-cream">{t("contact")}</Link></li>
              <li><Link href="/shipping-returns" className="text-white/65 transition-colors hover:text-cream">{t("shippingReturns")}</Link></li>
              <li><Link href="/faq" className="text-white/65 transition-colors hover:text-cream">{t("faq")}</Link></li>
              <li><Link href="/account/orders" className="text-white/65 transition-colors hover:text-cream">{t("trackOrder")}</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">{t("companyTitle")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/about" className="text-white/65 transition-colors hover:text-cream">{t("aboutUs")}</Link></li>
              <li><Link href="/privacy" className="text-white/65 transition-colors hover:text-cream">{t("privacyPolicy")}</Link></li>
              <li><Link href="/terms" className="text-white/65 transition-colors hover:text-cream">{t("terms")}</Link></li>
              <li><Link href="/cookies" className="text-white/65 transition-colors hover:text-cream">{t("cookiePolicy")}</Link></li>
            </ul>
            <div className="mt-4 space-y-2 text-sm text-white/65">
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-gold-light" />{brand.email.support}</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold-light" />België & Nederland</p>
            </div>
          </div>
        </div>

        {/* Payments */}
        <div className="mt-12 flex flex-wrap items-center gap-2">
          {PAYMENTS.map((p) => (
            <span key={p} className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80">{p}</span>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/50">&copy; {new Date().getFullYear()} {brand.legalName}. {t("rights")}</p>
          <p className="text-xs text-white/50">{t("madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}
