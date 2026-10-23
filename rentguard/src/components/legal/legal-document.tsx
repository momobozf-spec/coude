import Link from 'next/link';

import type { Locale } from '@/i18n/config';
import { SiteFooter } from '@/components/legal/site-footer';

export interface LegalSection {
  title: string;
  paragraphs: string[];
  list?: string[];
}

/** Opmaak voor privacyverklaring en voorwaarden, met conceptbanner. */
export function LegalDocument({
  locale,
  title,
  updated,
  sections,
}: {
  locale: Locale;
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link href={`/${locale}`} className="text-sm text-slate-600 underline underline-offset-2">
        {locale === 'nl' ? 'Terug' : 'Retour'}
      </Link>

      <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
        {locale === 'nl'
          ? 'Concept — laten nalezen door een jurist.'
          : 'Projet — à faire relire par un juriste.'}
      </p>

      <h1 className="mt-6 text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {locale === 'nl' ? 'Laatst bijgewerkt' : 'Dernière mise à jour'}: {updated}
      </p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-slate-700">
                {paragraph}
              </p>
            ))}
            {section.list ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <SiteFooter locale={locale} />
    </main>
  );
}
