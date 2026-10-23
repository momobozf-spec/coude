import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = { title: "Algemene voorwaarden" };

export default function Page() {
  return <LegalDocument doc="terms" />;
}
