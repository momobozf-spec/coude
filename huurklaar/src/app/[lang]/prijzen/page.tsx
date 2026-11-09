import { notFound } from "next/navigation";
import { BuyButton } from "@/components/BuyButton";
import { getAccount } from "@/lib/account";
import { intEnv } from "@/lib/env";
import { fill, getDict, isLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Pricing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang);
  const p = t.pricing;
  const a = await getAccount().catch(() => null);
  const ownsDossier = !!a && (a.dossierPaid || a.zoekpasActive);
  const ownsZoek = !!a?.zoekpasActive;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h1>{p.h}</h1>
      <div className="plans">
        <section className="panel plan">
          <h2>{p.free}</h2>
          <div className="price">{p.freeP}</div>
          <ul>{p.freeL.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>
        <section className="panel plan">
          <h2>{p.dossier}</h2>
          <div><span className="price">{p.dossierP}</span> <span className="muted">{p.dossierU}</span></div>
          <ul>{p.dossierL.map((x) => <li key={x}>{x}</li>)}</ul>
          {ownsDossier ? <span className="pill ok">{p.current}</span> : (
            <BuyButton product="dossier" lang={lang} label={p.buy} errorText={t.err.generic} />
          )}
        </section>
        <section className="panel plan featured">
          <h2>{p.zoek}</h2>
          <div><span className="price">{p.zoekP}</span> <span className="muted">{p.zoekU}</span></div>
          <ul>{p.zoekL.map((x) => <li key={x}>{x}</li>)}</ul>
          {ownsZoek ? <span className="pill ok">{p.current}</span> : (
            <BuyButton product="zoekpas" lang={lang} label={p.subscribe} errorText={t.err.generic} />
          )}
        </section>
      </div>
      <p className="small">{fill(p.fair, { n: intEnv("ZOEKPAS_CHECKS_PER_DAY", 40) })} {p.vat}</p>
    </div>
  );
}
