"use client";
import { track } from "@vercel/analytics";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildLetter, docShort, EMPTY, EXAMPLE, restore, startLabel, STORAGE_KEY, totals, type Dossier } from "@/lib/dossier";
import { decimal, money, type Dict, type Locale } from "@/lib/i18n";
import { buildDossierPdf, guessType } from "@/lib/pdf";
import { ASK_KEYS, DOC_KEYS, dossierScore, forbiddenAsked, todoKeys, verdict, type AskKey, type DocKey } from "@/lib/rules";
import { BuyButton } from "@/components/BuyButton";

const MAX_FILE = 10 * 1024 * 1024;

type Me = { loggedIn: boolean; canExportPdf: boolean };

export function DossierCoach({ lang, t, tErr, unlockLabel }: { lang: Locale; t: Dict["d"]; tErr: string; unlockLabel: string }) {
  const [d, setD] = useState<Dossier>(EXAMPLE);
  const [isExample, setIsExample] = useState(true);
  const [files, setFiles] = useState<Partial<Record<DocKey, File[]>>>({});
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [pdf, setPdf] = useState<{ state: "idle" | "busy" | "done" | "fail"; url?: string; name?: string }>({ state: "idle" });
  const loaded = useRef(false);

  // Laden uit dit toestel
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const r = raw ? restore(JSON.parse(raw)) : null;
      if (r) { setD(r); setIsExample(false); }
    } catch { /* geen opslag beschikbaar */ }
    loaded.current = true;
    fetch("/api/me").then((r) => r.json()).then(setMe).catch(() => setMe({ loggedIn: false, canExportPdf: false }));
  }, []);

  // Bewaren op dit toestel
  useEffect(() => {
    if (!loaded.current || isExample) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }, [d, isExample]);

  useEffect(() => () => { if (pdf.url) URL.revokeObjectURL(pdf.url); }, [pdf.url]);

  function set<K extends keyof Dossier>(k: K, v: Dossier[K]) {
    setIsExample(false);
    setD((prev) => ({ ...prev, [k]: v }));
    if (pdf.state === "done") setPdf({ state: "idle" });
  }
  const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };

  const { total, income, budget } = totals(d);
  const docsPresent = useMemo(
    () => DOC_KEYS.filter((k) => d.docs.includes(k) || (files[k]?.length ?? 0) > 0),
    [d.docs, files],
  );
  const scoreInput = { totalMonthly: total, netIncome: income, job: d.job, monthsEmployed: d.months, docs: docsPresent, about: d.about };
  const { score } = dossierScore(scoreInput);
  const todos = todoKeys(scoreInput);
  const bad = forbiddenAsked(d.asked);
  const autoLetter = buildLetter({ ...d, docs: docsPresent }, t, lang);
  const letter = d.letter ?? autoLetter;

  function toggle<T extends string>(list: T[], k: T): T[] {
    return list.includes(k) ? list.filter((x) => x !== k) : [...list, k];
  }

  function addFiles(k: DocKey, list: FileList | null) {
    setFileErr(null);
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const type = f.type || guessType(f.name);
      if (!["application/pdf", "image/jpeg", "image/png"].includes(type)) { setFileErr(t.badType); continue; }
      if (f.size > MAX_FILE) { setFileErr(t.tooBig); continue; }
      ok.push(f);
    }
    if (ok.length) {
      setFiles((prev) => ({ ...prev, [k]: [...(prev[k] ?? []), ...ok] }));
      if (!d.docs.includes(k)) set("docs", [...d.docs, k]);
      setPdf({ state: "idle" });
    }
  }
  function removeFile(k: DocKey, i: number) {
    setFiles((prev) => ({ ...prev, [k]: (prev[k] ?? []).filter((_, j) => j !== i) }));
    setPdf({ state: "idle" });
  }

  async function copyLetter() {
    try { await navigator.clipboard.writeText(letter); setCopyMsg(t.copied); }
    catch { setCopyMsg(t.copyFail); }
  }

  async function makePdf() {
    setPdf({ state: "busy" });
    try {
      const attachments = DOC_KEYS.flatMap((k) => (files[k] ?? []).map((file) => ({ label: docShort(t, k), file })));
      const bytes = await buildDossierPdf({
        title: t.cvTitle,
        name: d.name || "—",
        forLine: d.address ? `${t.cvFor}: ${d.address}` : "",
        facts: [
          [t.cvHh, `${d.people} ${t.cvPersons}`],
          [t.cvIncome, `€ ${money(income, lang)} / m`],
          [t.cvRatio, `${decimal(budget.ratio, lang)} x`],
          [t.cvStart, startLabel(d.start, lang) || "—"],
          [t.cvJob, t[jobKey(d.job)]],
          [t.cvDocs, String(attachments.length)],
        ],
        contact: [d.email, d.phone].filter(Boolean).join("  ·  "),
        letter,
        attachments,
        attachmentsLabel: t.cvDocs,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const slug = (d.name || "dossier").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
      track("dossier_pdf", { attachments: attachments.length });
      setPdf({ state: "done", url: URL.createObjectURL(blob), name: `huurdossier-${slug || "dossier"}.pdf` });
    } catch (e) {
      console.error(e);
      setPdf({ state: "fail" });
    }
  }

  function resetAll() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setD(EMPTY);
    setFiles({});
    setIsExample(false);
    setPdf({ state: "idle" });
  }

  const level = budget.level;

  return (
    <div className="work">
      <div className="stack">
        {isExample && <p className="notice">{t.example}</p>}

        <section className="panel" aria-labelledby="s1">
          <span className="eyebrow">1</span>
          <h2 id="s1">{t.s1}</h2>
          <div className="row">
            <label className="field" htmlFor="region">{t.fRegion}
              <select id="region" value={d.region} onChange={(e) => set("region", e.target.value as Dossier["region"])}>
                <option value="VL">Vlaanderen / Flandre</option>
                <option value="BXL">Brussel / Bruxelles</option>
                <option value="WAL">Wallonië / Wallonie</option>
              </select>
            </label>
            <NumField id="rent" label={t.fRent} value={d.rent} onChange={(v) => set("rent", num(v))} />
            <NumField id="costs" label={t.fCosts} value={d.costs} onChange={(v) => set("costs", num(v))} />
            <NumField id="garage" label={t.fGarage} value={d.garage} onChange={(v) => set("garage", num(v))} />
          </div>
          <label className="field" htmlFor="address">{t.fStreet}
            <input id="address" value={d.address} onChange={(e) => set("address", e.target.value)} autoComplete="off" />
          </label>
        </section>

        <section className="panel" aria-labelledby="s2">
          <span className="eyebrow">2</span>
          <h2 id="s2">{t.s2}</h2>
          <div className="row">
            <label className="field" htmlFor="name">{t.fName}<input id="name" value={d.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></label>
            <label className="field" htmlFor="email">{t.fEmail}<input id="email" type="email" value={d.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></label>
            <label className="field" htmlFor="phone">{t.fPhone}<input id="phone" type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" /></label>
          </div>
          <div className="row">
            <NumField id="people" label={t.fPeople} value={d.people} onChange={(v) => set("people", Math.max(1, Math.round(num(v))))} step={1} />
            <label className="field" htmlFor="start">{t.fStart}<input id="start" type="month" value={d.start} onChange={(e) => set("start", e.target.value)} /></label>
          </div>
          <div className="row">
            <NumField id="inc1" label={t.fIncome1} value={d.inc1} onChange={(v) => set("inc1", num(v))} />
            <NumField id="inc2" label={t.fIncome2} value={d.inc2} onChange={(v) => set("inc2", num(v))} />
            <NumField id="inc3" label={t.fIncomeOther} hint={t.fIncomeOtherH} value={d.inc3} onChange={(v) => set("inc3", num(v))} />
          </div>
          <div className="row">
            <label className="field" htmlFor="job">{t.fJob}
              <select id="job" value={d.job} onChange={(e) => set("job", e.target.value as Dossier["job"])}>
                <option value="vast">{t.jVast}</option><option value="tijd">{t.jTijd}</option><option value="zelf">{t.jZelf}</option>
                <option value="uitk">{t.jUitk}</option><option value="stud">{t.jStud}</option>
              </select>
            </label>
            <NumField id="months" label={t.fMonths} value={d.months} onChange={(v) => set("months", Math.round(num(v)))} step={1} />
          </div>
          <label className="field" htmlFor="about">{t.fAbout}
            <textarea id="about" value={d.about} onChange={(e) => set("about", e.target.value)} maxLength={2000} />
          </label>
        </section>

        <section className="panel" aria-labelledby="s3">
          <span className="eyebrow">3</span>
          <h2 id="s3">{t.s3}</h2>
          <p className="small">{t.s3h}</p>
          <div>
            {DOC_KEYS.map((k) => (
              <div className="docrow" key={k}>
                <label className="check" htmlFor={k}>
                  <input id={k} type="checkbox" checked={docsPresent.includes(k)} disabled={(files[k]?.length ?? 0) > 0}
                    onChange={() => set("docs", toggle(d.docs, k))} />
                  <span>{t[k]}</span>
                </label>
                <div className="files">
                  {(files[k] ?? []).map((f, i) => (
                    <span className="file" key={`${f.name}-${i}`}>
                      <span title={f.name}>{f.name}</span>
                      <button type="button" aria-label={`${t.remove} ${f.name}`} onClick={() => removeFile(k, i)}>×</button>
                    </span>
                  ))}
                  <label className="upload" htmlFor={`f-${k}`}>+ {t.addFile}
                    <input id={`f-${k}`} type="file" accept="application/pdf,image/jpeg,image/png" multiple
                      onChange={(e) => { addFiles(k, e.target.files); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          {fileErr && <p className="error" role="alert">{fileErr}</p>}
        </section>

        <section className="panel" aria-labelledby="s4">
          <span className="eyebrow">4</span>
          <h2 id="s4">{t.s4}</h2>
          <p className="small">{t.s4h}</p>
          <div style={{ display: "grid", gap: 8 }}>
            {ASK_KEYS.map((k: AskKey) => (
              <label className="check" key={k} htmlFor={k}>
                <input id={k} type="checkbox" checked={d.asked.includes(k)} onChange={() => set("asked", toggle(d.asked, k))} />
                <span>{t[k]}</span>
              </label>
            ))}
          </div>
          <div aria-live="polite">
            {!d.asked.length ? (
              <div className="watch clear"><p>{t.wNone}</p></div>
            ) : bad.length ? (
              <div className="watch">
                <p><strong>{t.wBad}</strong></p>
                {bad.map((b) => <p key={b.key}>• {t[b.explain as keyof Dict["d"]] as string}</p>)}
                {d.region === "WAL" && <p>{t.wWal}</p>}
                <p>{t.wAction}</p>
              </div>
            ) : (
              <div className="watch clear"><p>{t.wOk}</p></div>
            )}
          </div>
        </section>

        <section className="panel" aria-labelledby="s5">
          <span className="eyebrow">5</span>
          <h2 id="s5">{t.s5}</h2>
          <textarea id="letter" className="letter" value={letter} onChange={(e) => set("letter", e.target.value)} aria-labelledby="s5" />
          <div className="btns">
            <button type="button" className="btn btn-ghost" onClick={copyLetter}>{t.copy}</button>
            {d.letter !== null && (
              <button type="button" className="btn btn-ghost" onClick={() => set("letter", null)}>↺</button>
            )}
            <span className="small" aria-live="polite">{copyMsg}</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="s6">
          <span className="eyebrow">6</span>
          <h2 id="s6">{t.s6}</h2>
          <p className="small">{t.s6h}</p>
          {me && !me.canExportPdf ? (
            <>
              <p className="notice">{t.locked}</p>
              <div style={{ maxWidth: 260 }}><BuyButton product="dossier" lang={lang} label={unlockLabel} errorText={tErr} /></div>
            </>
          ) : (
            <div className="btns">
              <button type="button" className="btn btn-primary" onClick={makePdf} disabled={!me || pdf.state === "busy"}>
                {pdf.state === "busy" ? t.making : t.makePdf}
              </button>
              {pdf.state === "done" && pdf.url && (
                <a className="btn btn-ghost" href={pdf.url} download={pdf.name}>{t.downloadPdf}</a>
              )}
            </div>
          )}
          {pdf.state === "done" && <p className="success" role="status">{t.pdfDone}</p>}
          {pdf.state === "fail" && <p className="error" role="alert">{t.pdfFail}</p>}
        </section>

        <button type="button" className="btn btn-ghost" style={{ justifySelf: "start" }} onClick={resetAll}>{t.reset}</button>
      </div>

      <aside className="rail" aria-label={t.scoreK}>
        <section className="panel score">
          <span className="eyebrow">{t.scoreK}</span>
          <div className="dial" aria-live="polite"><span>{score}</span><small>/100</small></div>
          <div className="bar" aria-hidden="true"><i style={{ width: `${score}%` }} /></div>
          <strong>{t[verdict(score)]}</strong>
        </section>
        <section className="panel">
          <span className="eyebrow">{t.budgetK}</span>
          <div className="kv">
            <div><span>{t.bTotal}</span><b>€ {money(total, lang)}</b></div>
            <div><span>{t.bNeed}</span><b>€ {money(budget.required, lang)}</b></div>
            <div><span>{t.bHave}</span><b>€ {money(income, lang)}</b></div>
            <div><span>{t.bRatio}</span><b>{decimal(budget.ratio, lang, 2)} x</b></div>
            <div><span>{t.bMax}</span><b>€ {money(budget.maxAffordable, lang)}</b></div>
          </div>
          <span className={`pill ${level}`}>{level === "ok" ? t.bOk : level === "warn" ? t.bTight : t.bNo}</span>
        </section>
        <section className="panel">
          <span className="eyebrow">{t.todoK}</span>
          <ul className="todo">
            {todos.length ? todos.map((k) => <li key={k}>{t[k as keyof Dict["d"]] as string}</li>) : <li className="done">{t.t_ok}</li>}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function jobKey(j: Dossier["job"]) {
  return ({ vast: "jVast", tijd: "jTijd", zelf: "jZelf", uitk: "jUitk", stud: "jStud" } as const)[j];
}

function NumField({ id, label, hint, value, onChange, step = 10 }: { id: string; label: string; hint?: string; value: number; onChange: (v: string) => void; step?: number }) {
  return (
    <label className="field" htmlFor={id}>{label}
      <input id={id} type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
