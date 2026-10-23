"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatPrice } from "@/lib/utils";
import Button from "@/components/ui/Button";

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-40" />
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-32 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-32 text-center">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
        <h1 className="text-2xl font-bold mb-3">Your cart is empty</h1>
        <p className="text-muted-foreground mb-8">
          Looks like you haven&apos;t added anything to your cart yet.
        </p>
        <Link href="/products">
          <Button>
            Continue Shopping
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  const subtotal = totalPrice();
  const shipping = subtotal >= 150 ? 0 : 12.99;
  const total = subtotal + shipping;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Shopping Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="flex gap-4 p-4 rounded-2xl border border-border"
              >
                <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatPrice(item.price)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-border rounded-full">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-l-full transition-colors cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-r-full transition-colors cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-sm">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-28 rounded-2xl border border-border p-6 space-y-4">
            <h2 className="font-semibold text-lg">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {shipping === 0 ? (
                    <span className="text-emerald-600">Free</span>
                  ) : (
                    formatPrice(shipping)
                  )}
                </span>
              </div>
            </div>

            <hr className="border-border" />

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>

            <Link href="/checkout" className="block">
              <Button className="w-full" size="lg">
                Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            {subtotal < 150 && (
              <p className="text-xs text-muted-foreground text-center">
                Add {formatPrice(150 - subtotal)} more for free shipping
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
