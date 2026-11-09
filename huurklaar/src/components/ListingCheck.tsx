"use client";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { useEffect, useState } from "react";
import { PREFILL_KEY } from "@/components/HomeSearch";
import { restore, STORAGE_KEY } from "@/lib/dossier";
import { decimal, fill, money, type Dict, type Locale } from "@/lib/i18n";

type Analysis = {
  summary: string; area: string | null; rent_eur: number | null; charges_eur: number | null; charges_note: string | null;
  epc_mentioned: boolean; red_flags: { severity: "high" | "medium" | "low"; text: string }[];
  missing: string[]; visit_questions: string[]; scam_risk: "low" | "medium" | "high"; scam_reason: string; letter_opening: string;
};
type Result = {
  analysis: Analysis; total: number | null;
  budget: { level: "ok" | "warn" | "bad"; ratio: number; required: number; maxAffordable: number } | null;
  checksLeft: number | null;
};
type Me = { loggedIn: boolean; zoekpas: boolean; checksLeft: number | null; freeChecks: number };

export function ListingCheck({ lang, t, td, pricingLabel, loginLabel }: { lang: Locale; t: Dict["c"]; td: Dict["d"]; pricingLabel: string; loginLabel: string }) {
  const [text, setText] = useState("");
  const [income, setIncome] = useState<number | null>(null);
  const [useIncome, setUseIncome] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [usedInLetter, setUsedInLetter] = useState(false);

  useEffect(() => {
    try {
      const d = restore(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
      if (d) { const inc = d.inc1 + d.inc2 + d.inc3; if (inc > 0) setIncome(inc); }
    } catch { /* geen dossier */ }
    try {
      const pre = sessionStorage.getItem(PREFILL_KEY);
      if (pre) { setText(pre); sessionStorage.removeItem(PREFILL_KEY); }
    } catch { /* geen opslag */ }
    fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => setMe(null));
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (text.trim().length < 80) { setErr(t.tooShort); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang, netIncome: useIncome && income ? income : undefined }),
      });
      const j = await r.json();
      if (r.ok) {
        track("listing_check", { scam: j.analysis?.scam_risk ?? "?" });
        setRes(j);
        setUsedInLetter(false);
        setMe((m) => (m ? { ...m, checksLeft: j.checksLeft } : m));
      } else {
        setErr(
          j.error === "login" ? fill(t.needLogin, { n: me?.freeChecks ?? 3 })
          : j.error === "out_of_free" ? t.outOfFree
          : j.error === "day_limit" ? t.dayLimit
          : j.error === "too_short" ? t.tooShort
          : t.fail,
        );
      }
    } catch {
      setErr(t.fail);
    } finally {
      setBusy(false);
    }
  }

  function useOpening() {
    if (!res) return;
    try {
      const d = restore(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
      if (d) {
        d.opening = res.analysis.letter_opening;
        d.letter = null;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
        setUsedInLetter(true);
      }
    } catch { /* ignore */ }
  }

  const a = res?.analysis;
  const scamLabel = (s: Analysis["scam_risk"]) => (s === "high" ? t.scamHigh : s === "medium" ? t.scamMed : t.scamLow);
  const scamClass = (s: Analysis["scam_risk"]) => (s === "high" ? "bad" : s === "medium" ? "warn" : "ok");
  const sevClass = { high: "bad", medium: "warn", low: "ok" } as const;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <form className="panel" onSubmit={run}>
        <label className="field" htmlFor="listing">{t.paste}
          <textarea id="listing" style={{ minHeight: 200 }} placeholder={t.pastePh} value={text} maxLength={12000}
            onChange={(e) => setText(e.target.value)} />
        </label>
        {income ? (
          <label className="check" htmlFor="useinc">
            <input id="useinc" type="checkbox" checked={useIncome} onChange={(e) => setUseIncome(e.target.checked)} />
            <span>{t.useDossier} (€ {money(income, lang)})</span>
          </label>
        ) : null}
        <div className="btns">
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? t.running : t.run}</button>
          {me && (
            <span className="small">
              {!me.loggedIn ? fill(t.needLogin, { n: me.freeChecks }) : me.zoekpas ? t.unlimited : fill(t.left, { n: me.checksLeft ?? 0 })}
            </span>
          )}
        </div>
        {me && !me.loggedIn && <Link className="btn btn-ghost" style={{ justifySelf: "start" }} href={`/${lang}/login?next=/${lang}/check`}>{loginLabel}</Link>}
        {err && (
          <div style={{ display: "grid", gap: 8 }}>
            <p className="error" role="alert">{err}</p>
            {(err === t.outOfFree) && <Link className="btn btn-primary" style={{ justifySelf: "start" }} href={`/${lang}/prijzen`}>{pricingLabel}</Link>}
          </div>
        )}
      </form>

      {a && res && (
        <div className="result" aria-live="polite">
          <section className="panel">
            <span className="eyebrow">{t.summary}</span>
            <p style={{ margin: 0 }}>{a.summary}</p>
            <div className="btns">
              <span className={`pill ${scamClass(a.scam_risk)}`}>{t.scam}: {scamLabel(a.scam_risk)}</span>
              {res.budget && (
                <span className={`pill ${res.budget.level}`}>
                  {t.budget}: {res.budget.level === "ok" ? td.bOk : res.budget.level === "warn" ? td.bTight : td.bNo} ({decimal(res.budget.ratio, lang)} x)
                </span>
              )}
            </div>
            <p className="small">{a.scam_reason}</p>
          </section>

          <section className="panel">
            <span className="eyebrow">{t.price}</span>
            <div className="kv">
              <div><span>{t.rent}</span><b>{a.rent_eur != null ? `€ ${money(a.rent_eur, lang)}` : t.unknown}</b></div>
              <div><span>{t.costs}</span><b>{a.charges_eur != null ? `€ ${money(a.charges_eur, lang)}` : t.unknown}</b></div>
              {res.total != null && <div><span>{t.total}</span><b>€ {money(res.total, lang)}</b></div>}
              {res.budget && <div><span>{td.bNeed}</span><b>€ {money(res.budget.required, lang)}</b></div>}
            </div>
            {a.charges_note && <p className="small">{a.charges_note}</p>}
          </section>

          <section className="panel">
            <span className="eyebrow">{t.flags}</span>
            {a.red_flags.length ? (
              <ul className="flags">
                {a.red_flags.map((f, i) => (
                  <li key={i}><span className={`pill ${sevClass[f.severity]}`}>{t.sev[f.severity]}</span><span>{f.text}</span></li>
                ))}
              </ul>
            ) : <p className="success">{t.noFlags}</p>}
          </section>

          {a.missing.length > 0 && (
            <section className="panel">
              <span className="eyebrow">{t.missing}</span>
              <ul className="plain">{a.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </section>
          )}

          <section className="panel">
            <span className="eyebrow">{t.questions}</span>
            <ul className="plain">{a.visit_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </section>

          <section className="panel">
            <span className="eyebrow">{t.letterH}</span>
            <p className="quote">{a.letter_opening}</p>
            <p className="small">{t.letterHint}</p>
            <div className="btns">
              <button type="button" className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(a.letter_opening).catch(() => {})}>{td.copy}</button>
              <button type="button" className="btn btn-ghost" onClick={useOpening} disabled={usedInLetter}>→ {td.s5}</button>
              {usedInLetter && <Link href={`/${lang}/dossier`} className="small">{td.s5} ✓</Link>}
            </div>
          </section>

          <p className="small">{t.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
