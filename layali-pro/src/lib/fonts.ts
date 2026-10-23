import { Cormorant_Garamond, Inter, Playfair_Display } from "next/font/google";

// Self-hosted via next/font: de lettertypes worden bij de build gedownload en
// vanaf het eigen domein geserveerd, dus geen verzoeken naar Google (GDPR).
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-playfair", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-cormorant", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-inter", display: "swap" });

/** Klassen voor <html>: zetten --font-playfair, --font-cormorant en --font-inter. */
export const fontVariables = `${playfair.variable} ${cormorant.variable} ${inter.variable}`;
