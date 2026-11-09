import type { Metadata } from "next";
import { ProductScreen } from "@/components/product/ProductScreen";

export const metadata: Metadata = {
  title: "Product · Halal Product Scanner",
};

/**
 * Directe productpagina, bereikbaar vanuit zoekresultaten en deelbare links.
 *
 * Gebruikt exact dezelfde lookup en dezelfde weergave als de scanner: er is één
 * productresultaat in deze app, niet twee die uit elkaar kunnen lopen.
 */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ barcode: string }>;
}) {
  const { barcode } = await params;
  return <ProductScreen barcode={barcode} />;
}
