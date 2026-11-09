"use client";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { useEffect, useState } from "react";
import { restore, STORAGE_KEY, totals } from "@/lib/dossier";
import { fill, money, type Dict, type Locale } from "@/lib/i18n";
import type { Reason } from "@/lib/matching";

type Match = {
  id: number; source: string; url: string; title: string; municipality: string | null;
  rent_eur: number | null; charges_eur: number | null; bedrooms: number | null;
  score: number; reasons: Reason[]; status: "new" | "seen" | "dismissed" | "applied"; received_at: string;
};
type Profile = { maxMonthly: number | null; municipalities: string[]; minBedrooms: number; pets: boolean };

const GOOD: Reason[] = ["budget_ok", "area_ok", "bedrooms_ok"];
const BAD: Reason[] = ["budget_over", "area_other", "bedrooms_low", "pets_no"];

export function MatchesBoard({
  lang, t, address, profile, verification, lastMailAt, initial, errText,
}: {
  lang: Locale; t: Dict["m"]; address: string; profile: Profile; verification: string | null;
  lastMailAt: string | null; initial: Match[]; errText: string;
}) {
  const [items, setItems] = useState<Match[]>(initial);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [maxMonthly, setMaxMonthly] = useState<string>(profile.maxMonthly ? String(profile.maxMonthly) : "");
  const [places, setPlaces] = useState(profile.municipalities.join(", "));
  const [bedrooms, setBedrooms] = useState(profile.minBedrooms);
  const [pets, setPets] = useState(profile.pets);
  const [saveState, setSaveState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [hint, setHint] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const d = restore(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
      if (d) { const { budget } = totals(d); if (budget.maxAffordable > 0) setHint(budget.maxAffordable); }
    } catch { /* geen dossier */ }
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang === "fr" ? "fr-BE" : "nl-BE", { dateStyle: "medium", timeStyle: "short" });

  async function copyAddress() {
    try { await navigator.clipboard.writeText(address); setCopied(true); } catch { setCopied(false); }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveState("busy");
    const n = parseInt(maxMonthly, 10);
    const r = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxMonthly: Number.isFinite(n) && n > 0 ? n : null, municipalities: places, minBedrooms: bedrooms, pets }),
    }).catch(() => null);
    if (r?.ok) { setSaveState("ok"); window.location.reload(); } else setSaveState("fail");
  }

  async function setStatus(m: Match, status: Match["status"]) {
    setErr(null);
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === m.id ? { ...x, status } : x)));
    const r = await fetch(`/api/matches/${m.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!r?.ok) { setItems(prev); setErr(errText); }
    else if (status === "applied") track("match_applied", { score: m.score });
  }

  const visible = items.filter((m) => (showAll ? true : m.status !== "dismissed"));

  return (
    <div className="work">
      <div className="stack">
        <section className="panel" aria-labelledby="mlist">
          <h2 id="mlist">{t.listH}</h2>
          {err && <p className="error" role="alert">{err}</p>}
          {!visible.length && <p className="muted">{t.empty}</p>}
          <ul className="matches">
            {visible.map((m) => {
              const total = m.rent_eur != null ? m.rent_eur + (m.charges_eur ?? 0) : null;
              return (
                <li key={m.id} className={`match ${m.status}`}>
                  <div className="match-head">
                    <span className={`pill ${m.score >= 80 ? "ok" : m.score >= 60 ? "warn" : "bad"}`}>{t.score} {m.score}</span>
                    <span className="small">{m.source} · {fmt(m.received_at)}</span>
                  </div>
                  <h3>{m.title}</h3>
                  <p className="small">
                    {[m.municipality, total != null ? `€ ${money(total, lang)} ${t.perMonth}` : null, m.bedrooms != null ? `${m.bedrooms} ${t.rooms}` : null]
                      .filter(Boolean).join(" · ")}
                  </p>
                  <div className="reasons">
                    {m.reasons.map((r) => (
                      <span key={r} className={`chip ${GOOD.includes(r) ? "ok" : BAD.includes(r) ? "bad" : ""}`}>{t.r[r]}</span>
                    ))}
                  </div>
                  <div className="btns">
                    <a className="btn btn-ghost" href={m.url} target="_blank" rel="noopener noreferrer nofollow">{t.open}</a>
                    <Link className="btn btn-ghost" href={`/${lang}/check`}>{t.check}</Link>
                    {m.status === "applied" ? (
                      <span className="pill ok">✓ {t.applied}</span>
                    ) : m.status === "dismissed" ? (
                      <button type="button" className="btn btn-ghost" onClick={() => setStatus(m, "new")}>{t.undo}</button>
                    ) : (
                      <>
                        <button type="button" className="btn btn-primary" onClick={() => setStatus(m, "applied")}>{t.applied}</button>
                        <button type="button" className="btn btn-ghost" onClick={() => setStatus(m, "dismissed")}>{t.dismiss}</button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {items.some((m) => m.status === "dismissed") && (
            <button type="button" className="linkbtn" onClick={() => setShowAll((v) => !v)}>{showAll ? t.hideAll : t.showAll}</button>
          )}
        </section>
      </div>

      <aside className="rail">
        <section className="panel">
          <span className="eyebrow">{t.addrH}</span>
          <code className="addr">{address}</code>
          <div className="btns">
            <button type="button" className="btn btn-ghost" onClick={copyAddress}>{t.copyAddr}</button>
            {copied && <span className="small" role="status">{t.copied}</span>}
          </div>
          <p className="small">{t.addrHint}</p>
          <p className="small">{lastMailAt ? fill(t.lastMail, { d: fmt(lastMailAt) }) : t.noMail}</p>
        </section>

        {verification && (
          <section className="panel">
            <span className="eyebrow">{t.verifyH}</span>
            <p className="small">{t.verifyHint}</p>
            <pre className="verify">{verification}</pre>
          </section>
        )}

        <form className="panel" onSubmit={saveProfile}>
          <span className="eyebrow">{t.profileH}</span>
          <label className="field" htmlFor="maxm">{t.maxMonthly}
            <input id="maxm" type="number" min={0} step={10} inputMode="numeric" value={maxMonthly} onChange={(e) => setMaxMonthly(e.target.value)} />
            {hint && <small>{fill(t.maxHint, { n: money(hint, lang) })}</small>}
          </label>
          <label className="field" htmlFor="places">{t.places}
            <input id="places" value={places} onChange={(e) => setPlaces(e.target.value)} maxLength={1000} />
            <small>{t.placesHint}</small>
          </label>
          <label className="field" htmlFor="beds">{t.bedrooms}
            <input id="beds" type="number" min={0} max={10} value={bedrooms} onChange={(e) => setBedrooms(Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0)))} />
          </label>
          <label className="check" htmlFor="pets"><input id="pets" type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} /><span>{t.pets}</span></label>
          <button className="btn btn-primary" type="submit" disabled={saveState === "busy"}>{t.save}</button>
          {saveState === "fail" && <p className="error" role="alert">{errText}</p>}
        </form>

        <section className="panel">
          <span className="eyebrow">{t.howH}</span>
          <ol className="plain">{t.how.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
      </aside>
    </div>
  );
}
