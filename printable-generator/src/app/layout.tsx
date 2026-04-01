import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0d9488",
};

export const metadata: Metadata = {
  title: {
    default: "Noor Printables — Islamic Activity Sheets for Kids Aged 4-8",
    template: "%s | Noor Printables",
  },
  description:
    "Generate printable Islamic educational activities for children aged 4-8. Coloring pages, mazes, word searches & digital coloring with Ramadan, Eid, Arabic letters themes. Used by 2,400+ Muslim parents & 180+ Islamic schools.",
  keywords: [
    "Islamic printables", "Islamic coloring pages", "Ramadan activities kids",
    "Eid worksheets", "Arabic letters coloring", "Islamic school worksheets",
    "Muslim kids activities", "Islamic education", "Quran activities children",
  ],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://noorprintables.com"),
  openGraph: {
    title: "Noor Printables — Islamic Activity Sheets for Kids",
    description: "Generate coloring pages, mazes & word searches themed around Ramadan, Eid, Arabic letters & Islamic values. Ages 4-8.",
    url: "/",
    siteName: "Noor Printables",
    type: "website",
    locale: "en_US",
    images: ["/api/og?title=Noor+Printables&subtitle=Islamic+Educational+Activities+for+Kids"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Noor Printables — Islamic Activity Sheets for Kids",
    description: "Islamic coloring pages, mazes & word searches for children aged 4-8. Start free.",
  },
  robots: { index: true, follow: true, "max-image-preview": "large" as const },
  icons: { icon: "/favicon.ico" },
  manifest: undefined,
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Noor Printables",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web",
              description: "Islamic educational printable activities for children aged 4-8",
              offers: [
                { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free Plan" },
                { "@type": "Offer", price: "12", priceCurrency: "USD", name: "Pro Plan" },
                { "@type": "Offer", price: "49", priceCurrency: "USD", name: "School Plan" },
              ],
              aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", ratingCount: "312" },
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>

        {GA_ID && GA_ID !== "G-XXXXXXXXXX" && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
