import type { Metadata } from "next";
import { SearchScreen } from "@/components/search/SearchScreen";

export const metadata: Metadata = {
  title: "Zoeken · Halal Product Scanner",
  description: "Zoek een product op naam, merk of barcode.",
};

export default function SearchPage() {
  return <SearchScreen />;
}
