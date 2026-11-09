import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/Toaster";
import CookieConsent from "@/components/CookieConsent";
import { PRICES, PRICE_CURRENCY } from "@/lib/pricing";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0d9488",
};

export const metadata: Metadata = {
  title: {
    template: "%s | Noor Printables",
    default: "Noor Printables — Islamitisch Educatief Platform",
  },
  description:
    "Islamitische werkbladen, spelletjes en video's voor kinderen van 4-8 jaar.",
  keywords: ["islamitisch onderwijs", "kinderen", "werkbladen", "quran", "arabic",
    "Islamic printables", "Ramadan activities", "Muslim kids activities"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://noorprintables.com"),
  openGraph: {
    title: "Noor Printables — Islamitisch Educatief Platform",
    description: "Islamitische werkbladen, spelletjes en video's voor kinderen van 4-8 jaar.",
    siteName: "Noor Printables",
    type: "website",
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Noor Printables",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              description: "Islamic educational activities for children aged 4-8",
              offers: [
                { "@type": "Offer", price: "0", priceCurrency: PRICE_CURRENCY, name: "Free" },
                { "@type": "Offer", price: String(PRICES.pro.monthly), priceCurrency: PRICE_CURRENCY, name: "Pro" },
                { "@type": "Offer", price: String(PRICES.school.monthly), priceCurrency: PRICE_CURRENCY, name: "School" },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
