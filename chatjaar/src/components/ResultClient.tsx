"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadBox } from "./UploadBox";
import { SlideDeck } from "./SlideDeck";
import { buildSlides } from "@/lib/slides";
import { loadAiResult, loadAnalysis, saveAiResult, saveAnalysis, type StoredAnalysis } from "@/lib/session-store";
import type { AiResult } from "@/lib/ai-types";
import { getDict, type Locale } from "@/i18n/dictionaries";

type PayState = "checking" | "paid" | "unpaid";
type AiState = "idle" | "loading" | "done" | "error";

export function ResultClient({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const dict = getDict(locale);
  const t = dict.result;
  const [pay, setPay] = useState<PayState>("checking");
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [aiState, setAiState] = useState<AiState>("idle");

  const runAi = useCallback(
    async (a: StoredAnalysis) => {
      setAiState("loading");
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, payload: { ...a.bundle.payload, lang: locale } }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as AiResult;
        saveAiResult(sessionId, data);
        setAi(data);
        setAiState("done");
      } catch {
        setAiState("error");
      }
    },
    [sessionId, locale],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionId) return setPay("unpaid");
      try {
        const res = await fetch(`/api/verify?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const data = (await res.json()) as { paid: boolean };
        if (cancelled) return;
        setPay(data.paid ? "paid" : "unpaid");
        if (data.paid) {
          const stored = loadAnalysis();
          setAnalysis(stored);
          const cached = loadAiResult(sessionId);
          if (cached) {
            setAi(cached);
            setAiState("done");
          } else if (stored) {
            runAi(stored);
          }
        }
      } catch {
        if (!cancelled) setPay("unpaid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, runAi]);


  const slides = useMemo(
    () => (analysis ? buildSlides(analysis.stats, locale, ai, analysis.bundle.codeToName) : []),
    [analysis, ai, locale],
  );

  if (pay === "checking") return <p className="text-xl font-semibold">{t.checking}</p>;

  if (pay === "unpaid") {
    return (
      <div className="max-w-xl">
        <p className="text-xl font-semibold">{t.notPaid}</p>
        <Link href={`/${locale}/start`} className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-bold text-cream">
          {dict.nav.start}
        </Link>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-2xl">
        <h1 className="display text-5xl">{t.reupload}</h1>
        <p className="mt-4 text-lg text-ink-soft">{t.reuploadLead}</p>
        <div className="mt-8">
          <UploadBox
            locale={locale}
            onDone={(r) => {
              const a = { stats: r.stats, bundle: r.bundle, createdAt: Date.now() };
              saveAnalysis(a);
              setAnalysis(a);
              if (!loadAiResult(sessionId)) runAi(a);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="display text-5xl sm:text-6xl">{t.thanks}</h1>
      {aiState === "loading" && (
        <p className="mt-4 inline-block rounded-full bg-sun px-4 py-2 font-semibold" aria-live="polite">
          {t.aiLoading}
        </p>
      )}
      {aiState === "error" && (
        <p className="mt-4 flex flex-wrap items-center gap-3 font-semibold" role="alert">
          {t.aiError}
          <button
            type="button"
            onClick={() => runAi(analysis)}
            className="rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold"
          >
            {t.aiRetry}
          </button>
        </p>
      )}
      <div className="mt-8">
        <SlideDeck slides={slides} year={analysis.stats.year} locale={locale} actions />
      </div>
      <Link href={`/${locale}/start`} className="mt-4 inline-block font-semibold underline underline-offset-4">
        {t.newChat}
      </Link>
    </div>
  );
}
