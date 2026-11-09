import { notFound } from "next/navigation";
import { DossierCoach } from "@/components/DossierCoach";
import { getDict, isLocale } from "@/lib/i18n";

export default async function DossierPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h1>{t.nav.dossier}</h1>
      <DossierCoach lang={lang} t={t.d} tErr={t.err.generic} unlockLabel={t.d.unlock} />
    </div>
  );
}
