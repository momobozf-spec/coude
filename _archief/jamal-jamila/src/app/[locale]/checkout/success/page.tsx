"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Package, XCircle, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { trackPurchase } from "@/lib/analytics";
import Button from "@/components/ui/Button";

type State = "loading" | "paid" | "failed" | "pending";

export default function CheckoutSuccessPage() {
  const t = useTranslations("checkoutSuccess");
  const tf = useTranslations("checkoutFailed");
  const tCommon = useTranslations("common");
  const clearCart = useCartStore((s) => s.clearCart);
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let active = true;
    if (!orderNumber) {
      // No order ref (e.g. legacy Stripe redirect) — assume success.
      setState("paid");
      clearCart();
      return;
    }
    const check = async () => {
      try {
        const res = await fetch(`/api/orders/status?order=${encodeURIComponent(orderNumber)}`);
        const data = await res.json();
        if (!active) return;
        if (data.paymentStatus === "PAID") {
          setState("paid");
          trackPurchase(data.orderNumber, data.total);
          clearCart();
        } else if (data.paymentStatus === "FAILED" || data.paymentStatus === "CANCELLED") {
          setState("failed");
        } else {
          setState("pending");
        }
      } catch {
        if (active) setState("pending");
      }
    };
    check();
    return () => {
      active = false;
    };
  }, [orderNumber, clearCart]);

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-lg px-4 py-32 text-center">
        <Loader2 className="h-10 w-10 text-emerald mx-auto animate-spin" />
        <p className="mt-4 text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-32 text-center">
        <XCircle className="h-20 w-20 text-destructive mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3 font-[family-name:var(--font-heading)]">{tf("title")}</h1>
        <p className="text-muted-foreground text-lg mb-8">{tf("message")}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/checkout"><Button>{tf("retry")}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <Link href="/products"><Button variant="outline">{tf("backToCart")}</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-32 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 15, stiffness: 200 }}>
        <CheckCircle className="h-20 w-20 text-emerald mx-auto mb-6" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 className="text-3xl font-bold mb-3 font-[family-name:var(--font-heading)]">{t("title")}</h1>
        <p className="text-muted-foreground text-lg mb-2">{t("message")}</p>
        {orderNumber && (
          <p className="text-sm mb-2">
            {t("orderNumber")}: <span className="font-semibold">{orderNumber}</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground mb-8">{t("emailSent")}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/account/orders"><Button variant="outline"><Package className="h-4 w-4 mr-2" />{t("viewOrders")}</Button></Link>
          <Link href="/products"><Button>{t("continueShopping")}<ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
        </div>
      </motion.div>
    </div>
  );
}
