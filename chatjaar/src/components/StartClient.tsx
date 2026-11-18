"use client";

import { useEffect, useMemo, useState } from "react";
import { UploadBox } from "./UploadBox";
import { SlideDeck } from "./SlideDeck";
import { buildSlides, FREE_SLIDES } from "@/lib/slides";
import { clearAll, loadAnalysis, saveAnalysis, type StoredAnalysis } from "@/lib/session-store";
import { getDict, type Locale } from "@/i18n/dictionaries";

export function StartClient({ locale, canceled }: { locale: Locale; canceled: boolean }) {
  const dict = getDict(locale);
  const t = dict.teaser;
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [consent, setConsent] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(false);

  useEffect(() => {
    // Read the stored analysis after hydration (sessionStorage only exists in the browser).
    if (!canceled) return;
    let active = true;
    Promise.resolve().then(() => {
      if (active) setAnalysis(loadAnalysis());
    });
    return () => {
      active = false;
    };
  }, [canceled]);

  const slides = useMemo(() => (analysis ? buildSlides(analysis.stats, locale) : []), [analysis, locale]);

  async function pay() {
    setPaying(true);
    setPayError(false);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, consent }),
      });
      const data = (await res.json()) as { url?: string };
      if (!res.ok || !data.url) throw new Error("checkout");
      window.location.assign(data.url);
    } catch {
      setPaying(false);
      setPayError(true);
    }
  }

  if (!analysis) {
    return (
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="display text-5xl sm:text-6xl">{dict.upload.title}</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">{dict.upload.lead}</p>
          {canceled && <p className="mt-4 rounded-2xl bg-sun/50 px-4 py-3 font-semibold">{dict.result.canceled}</p>}
          <div className="mt-8">
            <UploadBox
              locale={locale}
              onDone={(r) => {
                const a = { stats: r.stats, bundle: r.bundle, createdAt: Date.now() };
                saveAnalysis(a);
                setAnalysis(a);
                window.scrollTo({ top: 0 });
              }}
            />
          </div>
        </div>
        <div className="grid gap-6 self-start sm:grid-cols-2 lg:grid-cols-1">
          {[
            [dict.upload.iosTitle, dict.upload.iosSteps],
            [dict.upload.androidTitle, dict.upload.androidSteps],
          ].map(([title, steps]) => (
            <section key={title as string} className="rounded-3xl bg-white p-6">
              <h2 className="text-xl font-bold">{title as string}</h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-soft">
                {(steps as string[]).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display text-5xl sm:text-6xl">{t.ready}</h1>
      <div className="mt-8">
        <SlideDeck slides={slides} year={analysis.stats.year} locale={locale} unlocked={FREE_SLIDES} />
      </div>
      <section className="mt-4 max-w-2xl rounded-[28px_28px_28px_8px] bg-grape p-6 text-cream sm:p-8">
        <h2 className="display text-4xl">{t.unlockTitle}</h2>
        <p className="mt-3 text-lg text-cream/85">{t.unlockLead}</p>
        <p className="mt-2 font-bold text-sun">{t.lockedCount(Math.max(0, slides.length - FREE_SLIDES))}</p>
        <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-[#ff5da2]"
          />
          <span>{t.consent}</span>
        </label>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={pay}
            disabled={!consent || paying}
            className="rounded-full bg-sun px-6 py-3 text-lg font-bold text-grape disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paying ? t.paying : t.pay}
          </button>
          <button
            type="button"
            onClick={() => {
              clearAll();
              setAnalysis(null);
            }}
            className="font-semibold text-cream/80 underline underline-offset-4"
          >
            {t.again}
          </button>
        </div>
        {payError && (
          <p role="alert" className="mt-4 font-semibold text-sun">
            {t.payError}
          </p>
        )}
      </section>
    </div>
  );
}
