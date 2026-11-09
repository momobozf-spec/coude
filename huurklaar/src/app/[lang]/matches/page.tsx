import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { MatchesBoard } from "@/components/MatchesBoard";
import { getAccount } from "@/lib/account";
import { getDict, isLocale } from "@/lib/i18n";
import { getOrCreateSearchProfile, inboundAddress } from "@/lib/search";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MatchesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const a = await getAccount();
  if (!a) redirect(`/${lang}/login?next=/${lang}/matches`);

  if (!a.zoekpasActive) {
    return (
      <div style={{ display: "grid", gap: 16, maxWidth: 640 }}>
        <h1>{t.m.h}</h1>
        <p className="lead">{t.m.lead}</p>
        <p className="notice">{t.m.locked}</p>
        <div style={{ maxWidth: 280 }}><BuyButton product="zoekpas" lang={lang} label={t.pricing.subscribe} errorText={t.err.generic} /></div>
        <Link href={`/${lang}/prijzen`} className="small">{t.nav.pricing}</Link>
      </div>
    );
  }

  const profile = await getOrCreateSearchProfile(a.userId);
  const db = await supabaseServer();
  const { data: matches } = await db
    .from("matches")
    .select("id, source, url, title, municipality, rent_eur, charges_eur, bedrooms, score, reasons, status, received_at")
    .order("score", { ascending: false })
    .order("received_at", { ascending: false })
    .limit(300);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h1>{t.m.h}</h1>
      <p className="lead">{t.m.lead}</p>
      <MatchesBoard
        lang={lang}
        t={t.m}
        address={inboundAddress(profile.inbound_token)}
        profile={{
          maxMonthly: profile.max_monthly,
          municipalities: profile.municipalities,
          minBedrooms: profile.min_bedrooms,
          pets: profile.pets,
        }}
        verification={profile.forward_verification}
        lastMailAt={profile.last_mail_at}
        initial={(matches ?? []) as never}
        errText={t.err.generic}
      />
    </div>
  );
}
