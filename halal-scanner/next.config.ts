import type { NextConfig } from "next";

/**
 * Productafbeeldingen komen van Open Food Facts. Next weigert externe
 * afbeeldingen zonder expliciete toestemming, en dat is maar goed ook: zonder
 * deze lijst zou elke URL uit een externe database als afbeelding geladen
 * kunnen worden. Alleen de hosts die OFF daadwerkelijk gebruikt staan hier.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      { protocol: "https", hostname: "static.openfoodfacts.org" },
      { protocol: "https", hostname: "world.openfoodfacts.org" },
    ],
  },
};

export default nextConfig;
