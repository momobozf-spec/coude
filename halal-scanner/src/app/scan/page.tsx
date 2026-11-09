import type { Metadata } from "next";
import { ScanScreen } from "@/components/scan/ScanScreen";

export const metadata: Metadata = {
  title: "Scannen · Halal Product Scanner",
  description: "Scan een barcode om te zien of een product halal is.",
};

/**
 * `ScanScreen` is een client component en wordt gewoon geïmporteerd.
 *
 * Eerder stond hier een `next/dynamic` met `ssr: false`. Dat mag niet in een
 * Server Component — en het loste ook niets op: de zware afhankelijkheid is
 * ZXing, en die wordt pas geladen op het moment dat de camera daadwerkelijk
 * start (zie `useBarcodeScanner`). De initiële bundle van deze pagina bevat hem
 * dus sowieso niet.
 */
export default function ScanPage() {
  return <ScanScreen />;
}
