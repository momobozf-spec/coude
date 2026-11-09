import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalButton } from "@/components/PortalButton";
import { getAccount } from "@/lib/account";
import { fill, getDict, isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params, searchParams,
}: { params: Promise<{ lang: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { paid } = await searchParams;
  const a = await getAccount();
  if (!a) redirect(`/${lang}/login?next=/${lang}/account`);
  const t = getDict(lang);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(lang === "fr" ? "fr-BE" : "nl-BE", { day: "numeric", month: "long", year: "numeric" });

  const plan = a.zoekpasActive ? t.a.planZoek : a.dossierPaid ? t.a.planDossier : t.a.planFree;

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 640 }}>
      <h1>{t.a.h}</h1>
      {paid && <p className="success" role="status">{t.a.thanks}</p>}
      <section className="panel">
        <div className="kv">
          <div><span>E-mail</span><b>{a.email}</b></div>
          <div><span>{t.a.plan}</span><b>{plan}</b></div>
          {a.zoekpasActive && a.zoekpasPeriodEnd && (
            <div><span /><span className="muted">{fill(a.zoekpasCancelAtPeriodEnd ? t.a.ends : t.a.renew, { d: fmt(a.zoekpasPeriodEnd) })}</span></div>
          )}
          <div><span>{t.a.checksUsed}</span><b>{a.checksUsed}</b></div>
        </div>
        <div className="btns">
          {a.stripeCustomerId && <PortalButton lang={lang} label={t.a.manage} errorText={t.err.generic} />}
          {!a.zoekpasActive && <Link className="btn btn-ghost" href={`/${lang}/prijzen`}>{t.nav.pricing}</Link>}
        </div>
      </section>
      <section className="panel">
        <h2>{t.a.deleteH}</h2>
        <p className="small">{t.a.deleteP}</p>
      </section>
    </div>
  );
}
