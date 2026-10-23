import type { Metadata } from "next";
import LegalDocument from "@/components/LegalDocument";

export const metadata: Metadata = { title: "Juridische informatie" };

export default function Page() {
  return <LegalDocument doc="legal" />;
}
