"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/i18n/context";
import { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>{children}</I18nProvider>
    </SessionProvider>
  );
}
