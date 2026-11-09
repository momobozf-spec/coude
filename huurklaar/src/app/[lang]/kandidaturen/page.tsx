import { notFound, redirect } from "next/navigation";
import { Applications } from "@/components/Applications";
import { BuyButton } from "@/components/BuyButton";
import { getAccount } from "@/lib/account";
import type { Application } from "@/lib/applications";
import { getDict, isLocale } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function KandidaturenPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const a = await getAccount();
  if (!a) redirect(`/${lang}/login?next=/${lang}/kandidaturen`);

  if (!a.zoekpasActive) {
    return (
      <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
        <h1>{t.k.h}</h1>
        <p className="lead">{t.k.lead}</p>
        <p className="notice">{t.k.locked}</p>
        <div style={{ maxWidth: 280 }}><BuyButton product="zoekpas" lang={lang} label={t.pricing.subscribe} errorText={t.err.generic} /></div>
      </div>
    );
  }

  const db = await supabaseServer();
  const { data } = await db.from("applications").select("*").order("updated_at", { ascending: false }).limit(300);

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 900 }}>
      <h1>{t.k.h}</h1>
      <p className="lead">{t.k.lead}</p>
      <Applications lang={lang} t={t.k} initial={(data ?? []) as Application[]} errText={t.err.generic} />
    </div>
  );
}
