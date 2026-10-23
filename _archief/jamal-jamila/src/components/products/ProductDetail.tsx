"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import {
  ShoppingBag, Minus, Plus, Check, Truck, Star, ChevronRight, ChevronDown,
  Gift, RotateCcw, ShieldCheck, Sparkles,
} from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import { colorSwatch } from "@/lib/colors";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import WishlistButton from "@/components/products/WishlistButton";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  user: { name: string | null };
  createdAt: Date;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  shortDesc?: string | null;
  description: string;
  price: number;
  comparePrice: number | null;
  sizes: string[];
  colors: string[];
  scents: string[];
  materials: string[];
  tags: string[];
  stock: number;
  badge?: string | null;
  category: { id: string; name: string; slug: string };
}

export default function ProductDetail({ product, reviews, avgRating }: { product: Product; reviews: Review[]; avgRating: number }) {
  const t = useTranslations("products");
  const [activeImg, setActiveImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || "");
  const [selectedColor, setSelectedColor] = useState(product.colors[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [giftWrap, setGiftWrap] = useState(false);
  const [added, setAdded] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("description");
  const addItem = useCartStore((s) => s.addItem);

  const soldOut = product.stock <= 0;
  const discount = product.comparePrice ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100) : 0;
  const galleryTiles = [0, 1, 2];

  const handleAdd = () => {
    if (soldOut) return;
    const giftNote = giftWrap ? ` — ${t("giftWrapNote")}` : "";
    addItem({
      id: `${product.id}-${selectedSize}-${selectedColor}-${giftWrap ? "gift" : ""}`,
      productId: product.id,
      name: `${product.name}${giftNote}`,
      price: product.price,
      image: "",
      quantity,
      size: selectedSize,
      color: selectedColor,
      stock: product.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const highlights = [
    ...(product.materials.length ? [`${t("material")}: ${product.materials.join(", ")}`] : []),
    ...(product.scents.length ? [`${t("scent")}: ${product.scents.join(", ")}`] : []),
    t("highlightCurated"),
    t("highlightGiftReady"),
  ];

  const sections = [
    { key: "description", title: t("description"), body: <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description}</p> },
    { key: "shipping", title: t("shippingInfo"), body: <p className="text-sm leading-relaxed text-muted-foreground">{t("shippingInfoBody")}</p> },
    { key: "returns", title: t("returnsInfo"), body: <p className="text-sm leading-relaxed text-muted-foreground">{t("returnsInfoBody")}</p> },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">{t("home")}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-foreground">{product.category.name}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Gallery */}
        <div className="space-y-4">
          <motion.div key={activeImg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-soft">
            <AtmosphereTile seed={`${product.slug}-${activeImg}`} label={product.name} category={product.category.slug} showLabel={false} glyphClassName="h-2/5 w-2/5" />
            <div className="absolute left-4 top-4 flex flex-col gap-1.5">
              {soldOut && <Badge variant="soldout">{t("outOfStock")}</Badge>}
              {discount > 0 && <Badge variant="sale">-{discount}%</Badge>}
              {product.badge === "NEW" && <Badge variant="new">Nieuw</Badge>}
              {product.badge === "BESTSELLER" && <Badge variant="bestseller">Bestseller</Badge>}
            </div>
          </motion.div>
          <div className="flex gap-3">
            {galleryTiles.map((i) => (
              <button key={i} onClick={() => setActiveImg(i)} className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors cursor-pointer ${activeImg === i ? "border-emerald" : "border-transparent"}`}>
                <AtmosphereTile seed={`${product.slug}-${i}`} label="" category={product.category.slug} showLabel={false} glyphClassName="h-1/2 w-1/2" />
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{product.category.name}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{product.name}</h1>

          {avgRating > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= Math.round(avgRating) ? "fill-gold text-gold" : "text-sand"}`} />)}</div>
              <span className="text-sm text-muted-foreground">{avgRating.toFixed(1)} ({reviews.length})</span>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-bold">{formatPrice(product.price)}</span>
            {product.comparePrice && product.comparePrice > product.price && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatPrice(product.comparePrice)}</span>
                <Badge variant="sale">-{discount}%</Badge>
              </>
            )}
          </div>

          {product.shortDesc && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{product.shortDesc}</p>}

          {/* Color swatches */}
          {product.colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">{t("color")}: <span className="font-normal text-muted-foreground">{selectedColor}</span></p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    title={color}
                    className={`flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 transition-all cursor-pointer ${selectedColor === color ? "ring-2 ring-emerald" : "ring-1 ring-border hover:ring-emerald/50"}`}
                  >
                    <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: colorSwatch(color) }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size selector */}
          {product.sizes.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">{t("size")}</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button key={size} onClick={() => setSelectedSize(size)} className={`h-10 min-w-[44px] rounded-lg border px-3 text-sm font-medium transition-colors cursor-pointer ${selectedSize === size ? "border-emerald bg-emerald text-white" : "border-border hover:border-emerald"}`}>
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock */}
          <div className="mt-6">
            {!soldOut ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald"><Check className="h-4 w-4" />{t("inStock")}{product.stock <= 10 ? ` — ${t("lowStock", { count: product.stock })}` : ""}</p>
            ) : (
              <p className="text-sm font-medium text-destructive">{t("outOfStock")}</p>
            )}
          </div>

          {/* Gift wrap */}
          {!soldOut && (
            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-white/60 p-3.5 transition-colors hover:border-emerald/50">
              <input type="checkbox" checked={giftWrap} onChange={(e) => setGiftWrap(e.target.checked)} className="h-4 w-4 accent-emerald cursor-pointer" />
              <Gift className="h-5 w-5 text-caramel" />
              <span className="flex-1 text-sm">
                <span className="font-medium">{t("giftWrapTitle")}</span>
                <span className="block text-xs text-muted-foreground">{t("giftWrapDesc")}</span>
              </span>
              <span className="text-xs font-semibold text-emerald">{t("giftWrapFree")}</span>
            </label>
          )}

          {/* Add to cart */}
          {!soldOut && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">{t("quantity")}</span>
                <div className="flex items-center rounded-full border border-border">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="flex h-10 w-10 items-center justify-center rounded-l-full hover:bg-muted cursor-pointer"><Minus className="h-4 w-4" /></button>
                  <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="flex h-10 w-10 items-center justify-center rounded-r-full hover:bg-muted cursor-pointer"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="lg" className="flex-1" onClick={handleAdd}>
                  {added ? <><Check className="mr-2 h-4 w-4" />{t("addedToCart")}</> : <><ShoppingBag className="mr-2 h-4 w-4" />{t("addToCart")}</>}
                </Button>
                <WishlistButton productId={product.id} variant="inline" />
              </div>
            </div>
          )}

          {/* Trust row */}
          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border pt-7">
            {[
              { icon: Truck, label: t("trustShip") },
              { icon: RotateCcw, label: t("trustReturn") },
              { icon: ShieldCheck, label: t("trustSecure") },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
                <item.icon className="h-5 w-5 text-emerald" strokeWidth={1.5} />
                <span className="text-[11px] leading-tight text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Highlights */}
          <div className="mt-7 rounded-2xl bg-muted/60 p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-caramel" />{t("highlights")}</p>
            <ul className="space-y-2">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />{h}
                </li>
              ))}
            </ul>
          </div>

          {/* Accordion */}
          <div className="mt-7 divide-y divide-border border-t border-border">
            {sections.map((s) => (
              <div key={s.key}>
                <button
                  onClick={() => setOpenSection(openSection === s.key ? null : s.key)}
                  className="flex w-full items-center justify-between py-4 text-left text-sm font-semibold cursor-pointer"
                >
                  {s.title}
                  <ChevronDown className={`h-4 w-4 transition-transform ${openSection === s.key ? "rotate-180" : ""}`} />
                </button>
                {openSection === s.key && <div className="pb-4">{s.body}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="mt-16 border-t border-border pt-16">
          <h2 className="mb-8 text-2xl font-bold font-[family-name:var(--font-heading)]">{t("reviews")} ({reviews.length})</h2>
          <div className="grid max-w-4xl gap-6 sm:grid-cols-2">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-border bg-white/60 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= review.rating ? "fill-gold text-gold" : "text-sand"}`} />)}</div>
                  <span className="text-sm font-medium">{review.user.name || "Anoniem"}</span>
                </div>
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
