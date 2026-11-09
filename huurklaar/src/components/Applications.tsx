"use client";
import { useState } from "react";
import { APP_STATUSES, needsFollowUp, type Application, type AppStatus } from "@/lib/applications";
import { fill, type Dict, type Locale } from "@/lib/i18n";

const OPEN: AppStatus[] = ["visit", "sent", "waiting"];

export function Applications({ lang, t, initial, errText }: { lang: Locale; t: Dict["k"]; initial: Application[]; errText: string }) {
  const [items, setItems] = useState<Application[]>(initial);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);

  const due = items.filter((a) => needsFollowUp(a));
  const open = items.filter((a) => OPEN.includes(a.status));
  const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-BE" : "nl-BE", { day: "numeric", month: "short" });
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim(), url: url.trim() || null, status: "sent", next_action_on: inDays(3) }),
    }).catch(() => null);
    const j = r?.ok ? await r.json() : null;
    if (j?.item) { setItems((xs) => [j.item, ...xs]); setTitle(""); setUrl(""); } else setErr(errText);
    setBusy(false);
  }

  async function patch(id: number, body: Partial<Application>) {
    setErr(null);
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...body } : x)));
    const r = await fetch(`/api/applications/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    if (!r?.ok) { setItems(prev); setErr(errText); }
  }

  async function remove(id: number) {
    setConfirm(null);
    const prev = items;
    setItems((xs) => xs.filter((x) => x.id !== id));
    const r = await fetch(`/api/applications/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { setItems(prev); setErr(errText); }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="btns">
        <span className="pill warn">{fill(t.countOpen, { n: open.length })}</span>
        {due.length > 0 && <span className="pill bad">{fill(t.countDue, { n: due.length })}</span>}
      </div>

      <form className="panel" onSubmit={add}>
        <span className="eyebrow">{t.add}</span>
        <div className="row">
          <label className="field" htmlFor="atitle">{t.title}<input id="atitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} required /></label>
          <label className="field" htmlFor="aurl">{t.url}<input id="aurl" type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000} /></label>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifySelf: "start" }}>{t.save}</button>
      </form>

      {err && <p className="error" role="alert">{err}</p>}
      {!items.length && <p className="muted">{t.empty}</p>}

      <ul className="matches">
        {items.map((a) => {
          const isDue = needsFollowUp(a);
          return (
            <li key={a.id} className={`match ${isDue ? "due" : ""}`}>
              <div className="match-head">
                <h3>{a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer nofollow">{a.title}</a> : a.title}</h3>
                {isDue && <span className="pill bad">{t.due}</span>}
              </div>
              {isDue && <p className="small">{t.dueHint}</p>}
              <div className="row">
                <label className="field" htmlFor={`st-${a.id}`}>{t.status}
                  <select id={`st-${a.id}`} value={a.status} onChange={(e) => patch(a.id, { status: e.target.value as AppStatus })}>
                    {APP_STATUSES.map((s) => <option key={s} value={s}>{t.s[s]}</option>)}
                  </select>
                </label>
                <label className="field" htmlFor={`ap-${a.id}`}>{t.appliedOn}
                  <input id={`ap-${a.id}`} type="date" value={a.applied_on} onChange={(e) => e.target.value && patch(a.id, { applied_on: e.target.value })} />
                </label>
                <label className="field" htmlFor={`nx-${a.id}`}>{t.next}
                  <input id={`nx-${a.id}`} type="date" value={a.next_action_on ?? ""} onChange={(e) => patch(a.id, { next_action_on: e.target.value || null })} />
                </label>
              </div>
              <label className="field" htmlFor={`nt-${a.id}`}>{t.note}
                <textarea id={`nt-${a.id}`} defaultValue={a.note ?? ""} maxLength={2000} style={{ minHeight: 60 }}
                  onBlur={(e) => e.target.value !== (a.note ?? "") && patch(a.id, { note: e.target.value || null })} />
              </label>
              <div className="btns">
                <span className="small">{fmtDate(a.applied_on)}</span>
                {confirm === a.id ? (
                  <>
                    <span className="small">{t.confirmDel}</span>
                    <button type="button" className="btn btn-primary" onClick={() => remove(a.id)}>{t.yes}</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>{t.no}</button>
                  </>
                ) : (
                  <button type="button" className="linkbtn" onClick={() => setConfirm(a.id)}>{t.del}</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
