"use client";

import type { ReactNode } from "react";
import Toast from "@/components/ui/Toast";
import CartDrawer from "@/components/cart/CartDrawer";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <CartDrawer />
      <Toast />
    </>
  );
}
