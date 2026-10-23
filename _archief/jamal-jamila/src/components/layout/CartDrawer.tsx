"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Lock } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatPrice, getShippingCost } from "@/lib/utils";
import AtmosphereTile from "@/components/ui/AtmosphereTile";
import FreeShippingBar from "@/components/layout/FreeShippingBar";
import Button from "@/components/ui/Button";

const PAYMENTS = ["Bancontact", "iDEAL", "Visa", "Mastercard", "Klarna"];

export default function CartDrawer() {
  const t = useTranslations("cart");
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const subtotal = totalPrice();
  const shippingCost = getShippingCost(subtotal);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50" onClick={closeCart} />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold font-[family-name:var(--font-heading)]">
                <ShoppingBag className="h-5 w-5" />
                {t("title")}
              </h2>
              <button onClick={closeCart} className="rounded-full p-1.5 transition-colors hover:bg-muted cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Free shipping progress */}
            {items.length > 0 && (
              <div className="border-b border-border px-6 py-4">
                <FreeShippingBar subtotal={subtotal} />
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground">{t("empty")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t("emptyDesc")}</p>
                  <Link href="/products" onClick={closeCart} className="mt-6 inline-block">
                    <Button>{t("continueShopping")}</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl">
                        <AtmosphereTile seed={item.name} label={item.name} showLabel={false} glyphClassName="h-1/2 w-1/2" />
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-medium leading-tight">{item.name}</h3>
                          {(item.size || item.color) && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{[item.size, item.color].filter(Boolean).join(" / ")}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center rounded-full border border-border">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-l-full hover:bg-muted cursor-pointer"><Minus className="h-3 w-3" /></button>
                            <span className="w-7 text-center text-xs">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-r-full hover:bg-muted cursor-pointer"><Plus className="h-3 w-3" /></button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</span>
                            <button onClick={() => removeItem(item.id)} className="p-1 text-muted-foreground transition-colors hover:text-destructive cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="space-y-3 border-t border-border p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("shipping")}</span>
                  <span>{shippingCost === 0 ? <span className="text-emerald">{t("shippingFree")}</span> : formatPrice(shippingCost)}</span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between text-lg font-semibold">
                  <span>{t("total")}</span>
                  <span>{formatPrice(subtotal + shippingCost)}</span>
                </div>
                <Link href="/checkout" onClick={closeCart} className="block">
                  <Button className="w-full" size="lg">
                    <Lock className="mr-2 h-4 w-4" />
                    {t("checkout")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {PAYMENTS.map((p) => (
                    <span key={p} className="rounded border border-border bg-white px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
