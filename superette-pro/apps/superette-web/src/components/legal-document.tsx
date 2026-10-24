'use client';

/**
 * Toont een juridisch document (privacy, voorwaarden, cookies) in de taal van
 * de gebruiker, met de gegevens van de uitbater ingevuld. Het adres komt van
 * de server (`LEGAL_ENTITY_ADDRESS`); ontbreekt het, dan staat er een
 * zichtbare plaatshouder — nooit een verzonnen adres.
 */
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Notice, PageTitle } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { LEGAL_ENTITY } from '@/lib/legal';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from '@/lib/legal-content';

const MISSING_ADDRESS = {
  nl: `${LEGAL_ENTITY.city} [straat en nummer: nog in te vullen]`,
  fr: `${LEGAL_ENTITY.city} [rue et numéro : à compléter]`,
  en: `${LEGAL_ENTITY.city} [street and number: to be completed]`,
} as const;

const RELATED: ReadonlyArray<{ href: string; id: LegalDocumentId | 'data' }> = [
  { href: '/privacy', id: 'privacy' },
  { href: '/voorwaarden', id: 'terms' },
  { href: '/cookies', id: 'cookies' },
  { href: '/over-de-gegevens', id: 'data' },
];

export function LegalDocumentView({ document: id, address }: { document: LegalDocumentId; address: string | null }) {
  const { t, locale } = useI18n();
  const doc = LEGAL_DOCUMENTS[id][locale];
  const values: Record<string, string> = {
    name: LEGAL_ENTITY.name,
    kbo: LEGAL_ENTITY.enterpriseNumber,
    city: LEGAL_ENTITY.city,
    email: LEGAL_ENTITY.email,
    address: address ?? MISSING_ADDRESS[locale],
  };
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

  return (
    <AppShell>
      <PageTitle>{doc.title}</PageTitle>
      <Notice tone="warning" className="mb-6">
        {doc.draftNotice}
      </Notice>

      <div className="space-y-8 text-sm leading-relaxed text-ink">
        {doc.sections.map((section) => (
          <section key={section.id} aria-labelledby={`${id}-${section.id}`}>
            <h2 id={`${id}-${section.id}`} className="text-lg font-bold">
              {section.heading}
            </h2>
            {section.body.map((block, index) =>
              typeof block === 'string' ? (
                <p key={index} className="mt-2">
                  {fill(block)}
                </p>
              ) : (
                <ul key={index} className="mt-2 list-disc space-y-1.5 pl-5">
                  {block.list.map((item) => (
                    <li key={item}>{fill(item)}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}

        <p className="text-xs text-ink-muted">{doc.version}</p>

        <nav aria-label={t('legal.related')} className="flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-4 text-sm">
          {RELATED.filter((item) => item.id !== id).map((item) => (
            <Link key={item.href} href={item.href} className="font-semibold text-brand underline-offset-2 hover:underline">
              {item.id === 'data' ? t('nav.data') : LEGAL_DOCUMENTS[item.id][locale].title}
            </Link>
          ))}
        </nav>
      </div>
    </AppShell>
  );
}
