import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: {
    default: "Layali — Oriental Lifestyle & Home",
    template: "%s | Layali",
  },
  description: brand.description,
  keywords: [
    "oriental home decor",
    "Marokkaanse decoratie",
    "Arabische decoratie",
    "Marokkaanse theeglazen",
    "Oosterse woondecoratie",
    "geurkaarsen",
    "hammam cadeaupakket",
    "luxe cadeaupakket",
    "oriental gifts",
    "Marokkaanse sfeer in huis",
  ],
  openGraph: {
    title: "Layali — Oriental Lifestyle & Home",
    description: brand.description,
    type: "website",
    locale: "nl_BE",
    alternateLocale: ["fr_BE"],
    siteName: "Layali",
    url: brand.url,
  },
  twitter: {
    card: "summary_large_image",
    title: "Layali — Oriental Lifestyle & Home",
    description: brand.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
