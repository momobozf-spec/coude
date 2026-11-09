import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeSearch } from "@/components/HomeSearch";
import { getDict, isLocale } from "@/lib/i18n";

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDict(lang).home;
  const features: [string, string, string][] = [
    ["€", t.f1h, t.f1],
    ["✓", t.f2h, t.f2],
    ["!", t.f3h, t.f3],
    ["↓", t.f4h, t.f4],
  ];
  return (
    <>
      <p className="banner"><span>🔒 {t.banner}</span></p>
      <section className="hero">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.h1} <em>{t.h1em}</em></h1>
        <ul className="checklist">{t.checks.map((c) => <li key={c}>{c}</li>)}</ul>
        <HomeSearch lang={lang} placeholder={t.searchPh} button={t.searchBtn} />
        <div className="btns">
          <Link className="btn btn-primary" href={`/${lang}/dossier`}>{t.ctaDossier}</Link>
          <Link className="btn btn-ghost" href={`/${lang}/prijzen`}>{getDict(lang).nav.pricing}</Link>
        </div>
      </section>

      <div className="section-title"><h2>{t.featuresH}</h2></div>
      <section className="cards">
        {features.map(([icon, h, p]) => (
          <article className="card" key={h}>
            <span className="icon" aria-hidden="true">{icon}</span>
            <h3>{h}</h3>
            <p>{p}</p>
          </article>
        ))}
      </section>

      <div className="section-title"><h2>{t.howH}</h2></div>
      <ol className="cards" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {t.steps.map((s, i) => (
          <li className="card" key={s}>
            <span className="pill accent num">{i + 1}</span>
            <h3>{s}</h3>
          </li>
        ))}
      </ol>

      <section className="band">
        <h2>{t.privacyH}</h2>
        <p>{t.privacy}</p>
      </section>
    </>
  );
}
