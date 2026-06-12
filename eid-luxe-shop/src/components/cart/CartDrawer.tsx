"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/store";
import { Price } from "@/components/ui/Price";
import { ProductImage } from "@/components/ui/ProductImage";
import { LinkButton } from "@/components/ui/Button";

export default function CartDrawer() {
  const { items, isDrawerOpen, closeDrawer, setQty, remove, subtotal } = useCart();

  useEffect(() => {
    if (isDrawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  const total = subtotal();
  const shipping = total > 120 || total === 0 ? 0 : 7.95;

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={closeDrawer}
        className="absolute inset-0 bg-forest-800/60 animate-fade-in"
      />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream-50 shadow-luxe animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-cream-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
              Je selectie
            </p>
            <h3 className="font-display text-2xl text-forest-800">Je mandje</h3>
          </div>
          <button onClick={closeDrawer} aria-label="Sluiten" className="text-forest-700">
            <X size={22} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-cream-100">
              <ShoppingBag size={32} className="text-warmbrown-400" />
            </div>
            <h4 className="font-display text-xl text-forest-800">Nog leeg.</h4>
            <p className="mt-2 max-w-xs text-sm text-warmbrown-500">
              Neem rustig de tijd om iets moois te kiezen voor wie je liefhebt.
            </p>
            <LinkButton href="/shop" variant="primary" className="mt-6" onClick={closeDrawer}>
              Naar de shop
            </LinkButton>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="grid gap-4">
                {items.map((item) => (
                  <li
                    key={item.product.id}
                    className="flex gap-4 rounded-2xl border border-cream-200 bg-white p-3"
                  >
                    <ProductImage
                      slug={item.product.slug}
                      accent={item.product.imageAccent}
                      alt={item.product.name}
                      className="h-24 w-24 flex-shrink-0 rounded-xl"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/product/${item.product.slug}`}
                          onClick={closeDrawer}
                          className="text-sm font-medium leading-tight text-forest-800 hover:text-gold-400"
                        >
                          {item.product.name}
                        </Link>
                        <button
                          onClick={() => remove(item.product.id)}
                          aria-label="Remove"
                          className="text-warmbrown-400 hover:text-forest-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-warmbrown-500 line-clamp-1">
                        {item.product.description}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-full border border-cream-300 bg-cream-50">
                          <button
                            onClick={() => setQty(item.product.id, item.quantity - 1)}
                            aria-label="Decrease"
                            className="grid h-7 w-7 place-items-center text-forest-700 hover:bg-cream-100 rounded-l-full"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-7 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => setQty(item.product.id, item.quantity + 1)}
                            aria-label="Increase"
                            className="grid h-7 w-7 place-items-center text-forest-700 hover:bg-cream-100 rounded-r-full"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <Price amount={item.product.price * item.quantity} size="sm" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-cream-200 bg-cream-100/60 px-6 py-5">
              <div className="grid gap-2 text-sm">
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
              <div className="mt-5 grid gap-2">
                <LinkButton href="/checkout" variant="primary" fullWidth onClick={closeDrawer}>
                  Veilig afrekenen
                </LinkButton>
                <LinkButton href="/cart" variant="ghost" fullWidth onClick={closeDrawer}>
                  Bekijk mandje
                </LinkButton>
              </div>
              <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-warmbrown-500">
                Veilig betalen · met liefde verpakt
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
