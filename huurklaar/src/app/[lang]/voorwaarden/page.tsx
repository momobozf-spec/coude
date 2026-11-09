import { notFound } from "next/navigation";
import { LegalDoc } from "@/components/LegalDoc";
import { isLocale } from "@/lib/i18n";
import { TERMS } from "@/lib/legal";

export default async function Terms({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LegalDoc doc={TERMS[lang]} />;
}
