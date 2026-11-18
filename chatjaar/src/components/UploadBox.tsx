"use client";

import { useRef, useState } from "react";
import { analyzeFile, type AnalyzeResult } from "@/lib/analyze";
import { getDict, type Locale } from "@/i18n/dictionaries";

type Ok = Extract<AnalyzeResult, { ok: true }>;

export function UploadBox({ locale, onDone }: { locale: Locale; onDone: (r: Ok) => void }) {
  const t = getDict(locale).upload;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function handle(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    const r = await analyzeFile(file, locale);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (r.ok) onDone(r);
    else setError(t.errors[r.error]);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-start gap-4 rounded-[28px_28px_28px_8px] border-[3px] border-dashed p-6 transition-colors sm:p-8 ${
          over ? "border-pink bg-white" : "border-ink/30 bg-white/60"
        }`}
      >
        <p className="text-xl font-bold">{busy ? t.busy : t.drop}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="rounded-full bg-ink px-6 py-3 text-lg font-bold text-cream disabled:opacity-50"
        >
          {t.choose}
        </button>
        <input
          ref={input}
          type="file"
          accept=".zip,.txt,text/plain,application/zip"
          className="sr-only"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <p className="text-sm text-ink-soft">{t.localNote}</p>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-pink/20 px-4 py-3 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
