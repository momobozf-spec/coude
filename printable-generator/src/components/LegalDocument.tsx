"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/context";
import { DRAFT_BANNER, UPDATED_LABEL, fill, getLegalDoc } from "@/legal";
import type { LegalDocKey } from "@/legal/types";
import { LEGAL } from "@/lib/legal-entity";

const LANGS = ["nl", "fr", "en", "de"] as const;

export default function LegalDocument({ doc }: { doc: LegalDocKey }) {
  const { locale: uiLocale, setLocale } = useI18n();
  const { locale, doc: content } = getLegalDoc(doc, uiLocale);

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-6 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium">
        {DRAFT_BANNER[locale]}
      </div>
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={`px-2 py-1 rounded border ${l === locale ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{content.title}</h1>
      <p className="text-sm text-gray-500 mb-8">
        {UPDATED_LABEL[locale]}: {LEGAL.lastUpdated}
      </p>
      {content.sections.map((s) => (
        <section key={s.h} className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{s.h}</h2>
          {s.p?.map((para, i) => (
            <p key={i} className="text-gray-700 leading-relaxed mb-3">{fill(para)}</p>
          ))}
          {s.ul && (
            <ul className="list-disc pl-6 space-y-1.5 text-gray-700 leading-relaxed">
              {s.ul.map((li, i) => (
                <li key={i}>{fill(li)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="text-sm text-gray-500 mt-12">
        <Link href="/privacy" className="underline mr-4">Privacy</Link>
        <Link href="/terms" className="underline mr-4">Terms</Link>
        <Link href="/cookies" className="underline mr-4">Cookies</Link>
        <Link href="/legal" className="underline">Legal</Link>
      </p>
    </article>
  );
}
