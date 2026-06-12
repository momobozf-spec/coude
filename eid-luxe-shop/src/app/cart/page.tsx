"use client";

import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/store";
import { Price } from "@/components/ui/Price";
import { ProductImage } from "@/components/ui/ProductImage";
import { LinkButton } from "@/components/ui/Button";
import { ProductGrid } from "@/components/product/ProductGrid";
import { TrustBadges } from "@/components/product/TrustBadges";
import { products as allProducts } from "@/data/products";

export default function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  const total = subtotal();
  const shipping = total > 120 || total === 0 ? 0 : 7.95;
  const upsell = allProducts.filter((p) => p.featured && !items.some((i) => i.product.id === p.id)).slice(0, 4);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
      <h1 className="font-display text-4xl text-forest-800 sm:text-5xl">
        Je mandje
      </h1>
      <p className="mt-2 text-sm text-warmbrown-500">
        {items.length === 0
          ? "Je mandje is nog leeg."
          : `${items.reduce((s, i) => s + i.quantity, 0)} item${items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""} klaar om mee te gaan.`}
      </p>

      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-cream-200 bg-cream-50 px-6 py-20 text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-cream-100">
            <ShoppingBag size={32} className="text-warmbrown-400" />
          </div>
          <p className="font-display text-2xl text-forest-800">
            Je mandje is nog leeg.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-warmbrown-500">
            Neem rustig de tijd om iets moois te kiezen voor wie je liefhebt.
          </p>
          <LinkButton href="/shop" variant="primary" className="mt-6">
            Naar de shop
          </LinkButton>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div>
            <ul className="grid gap-4">
              {items.map((item) => (
                <li
                  key={item.product.id}
                  className="flex flex-col gap-4 rounded-3xl border border-cream-200 bg-cream-50 p-4 sm:flex-row sm:items-center"
                >
                  <Link href={`/product/${item.product.slug}`} className="flex-shrink-0">
                    <ProductImage
                      slug={item.product.slug}
                      accent={item.product.imageAccent}
                      alt={item.product.name}
                      className="h-32 w-32 rounded-xl"
                    />
                  </Link>
                  <div className="flex-1">
                    <Link
                      href={`/product/${item.product.slug}`}
                      className="font-display text-lg leading-tight text-forest-800 hover:text-gold-400"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-xs text-warmbrown-500">
                      {item.product.description}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-full border border-cream-300">
                        <button
                          onClick={() => setQty(item.product.id, item.quantity - 1)}
                          aria-label="Decrease"
                          className="grid h-9 w-9 place-items-center text-forest-700 hover:bg-cream-100 rounded-l-full"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-9 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => setQty(item.product.id, item.quantity + 1)}
                          aria-label="Increase"
                          className="grid h-9 w-9 place-items-center text-forest-700 hover:bg-cream-100 rounded-r-full"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <Price amount={item.product.price * item.quantity} size="md" />
                        <button
                          onClick={() => remove(item.product.id)}
                          aria-label="Remove"
                          className="text-warmbrown-400 hover:text-forest-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <TrustBadges className="mt-10" />
          </div>

          {/* Summary */}
          <aside>
            <div className="sticky top-32 rounded-3xl border border-cream-200 bg-cream-50 p-6 shadow-card">
              <h3 className="font-display text-2xl text-forest-800">Overzicht</h3>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-warmbrown-500">Subtotaal</span>
                  <Price amount={total} size="sm" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-warmbrown-500">Verzending</span>
                  <span className="text-forest-800">
                    {shipping === 0 ? "Gratis · met dank" : <Price amount={shipping} size="sm" />}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-cream-300 pt-3">
                  <span className="font-medium text-forest-800">Totaal</span>
                  <Price amount={total + shipping} size="lg" />
                </div>
              </div>
              <LinkButton href="/checkout" variant="primary" fullWidth className="mt-6">
                Veilig afrekenen
              </LinkButton>
              <LinkButton href="/shop" variant="ghost" fullWidth className="mt-2">
                Verder kijken
              </LinkButton>
              <p className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-warmbrown-500">
                Veilig betalen · met liefde verpakt
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Upsell */}
      {items.length > 0 && upsell.length > 0 && (
        <div className="mt-20">
          <h2 className="mb-6 font-display text-3xl text-forest-800">
            Misschien past dit er ook bij?
          </h2>
          <ProductGrid products={upsell} cols={4} />
        </div>
      )}
    </section>
  );
}
