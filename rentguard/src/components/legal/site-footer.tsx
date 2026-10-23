import Link from 'next/link';

import type { Locale } from '@/i18n/config';
import { formatEntityAddress, getLegalEntity } from '@/lib/legal/entity';

/** Wettelijke vermeldingen (WER art. XII.6) en links naar privacy/voorwaarden. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const entity = getLegalEntity();

  return (
    <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
      <nav className="mb-3 flex flex-wrap gap-4 text-sm">
        <Link href={`/${locale}/legal/privacy`} className="underline underline-offset-2">
          {locale === 'nl' ? 'Privacyverklaring' : 'Déclaration de confidentialité'}
        </Link>
        <Link href={`/${locale}/legal/terms`} className="underline underline-offset-2">
          {locale === 'nl' ? 'Algemene voorwaarden' : 'Conditions générales'}
        </Link>
      </nav>
      <p>
        {entity.name} · {formatEntityAddress(entity)} ·{' '}
        {locale === 'nl' ? 'Ondernemingsnummer' : 'Numéro d’entreprise'}{' '}
        {entity.vatNumber} ·{' '}
        <a href={`mailto:${entity.email}`} className="underline underline-offset-2">
          {entity.email}
        </a>
      </p>
    </footer>
  );
}
