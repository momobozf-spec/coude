"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/i18n/context";
import { ToastProvider } from "@/components/ui/Toaster";
import { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
