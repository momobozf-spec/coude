import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/layout/BottomNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Halal Product Scanner",
  description:
    "Scan een barcode en zie of een product halal is, met uitleg en bronnen bij elke beoordeling.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoomen niet blokkeren: dat breekt de app voor wie tekst moet vergroten.
  maximumScale: 5,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="min-h-dvh pb-20">
        {/* Eerste tabstop: wie met toetsenbord navigeert hoeft niet door de
            hele navigatie heen voordat hij bij de inhoud is. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--surface)] focus:px-4 focus:py-2"
        >
          Direct naar de inhoud
        </a>

        <main id="main" className="mx-auto w-full max-w-md px-4 py-6">
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}
