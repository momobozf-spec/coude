"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Package } from "lucide-react";
import { useCartStore } from "@/store/cart";
import Button from "@/components/ui/Button";

export default function CheckoutSuccessPage() {
  const clearCart = useCartStore((s) => s.clearCart);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="mx-auto max-w-lg px-4 py-32 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
      >
        <CheckCircle className="h-20 w-20 text-emerald-500 mx-auto mb-6" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold mb-3">Thank you!</h1>
        <p className="text-muted-foreground text-lg mb-2">
          Your order has been placed successfully.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          You&apos;ll receive a confirmation email shortly with your order
          details.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard/orders">
            <Button variant="outline">
              <Package className="h-4 w-4 mr-2" />
              View Orders
            </Button>
          </Link>
          <Link href="/products">
            <Button>
              Continue Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
