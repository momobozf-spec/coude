import { notFound } from "next/navigation";
import { ListingCheck } from "@/components/ListingCheck";
import { getDict, isLocale } from "@/lib/i18n";

export default async function CheckPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 820 }}>
      <h1>{t.c.h}</h1>
      <p className="lead">{t.c.lead}</p>
      <ListingCheck lang={lang} t={t.c} td={t.d} pricingLabel={t.pricing.subscribe} loginLabel={t.nav.login} />
    </div>
  );
}
