import type { Metadata } from "next";
import { Inter, Playfair_Display, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Providers from "@/components/providers/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bayt Noor — Betekenisvolle geschenken voor Eid en familie",
  description:
    "Een kleine familiezaak. Wij verzorgen warme, eerlijke geschenken voor Eid al-Adha en andere gezegende momenten. Van ons gezin, naar het jouwe.",
  keywords: [
    "Eid al-Adha",
    "Islamitische geschenken",
    "familie",
    "baraka",
    "dadels",
    "musk parfum",
    "gebedsmat",
    "Marokkaanse thee",
  ],
  openGraph: {
    title: "Bayt Noor — Van ons gezin, naar het jouwe",
    description:
      "Betekenisvolle geschenken voor Eid en gezegende familiemomenten.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${cormorant.variable}`}
    >
      <body className="bg-cream-50 text-forest-800 font-sans antialiased">
        <Providers>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
