'use client';

import { AppShell } from '@/components/app-shell';
import { ButtonLink, EmptyState } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <AppShell>
      {/* Elke pagina één h1, ook de foutpagina (axe: page-has-heading-one). */}
      <h1 className="sr-only">{t('errors.notFound.title')}</h1>
      <EmptyState title={t('errors.notFound.title')} text={t('errors.notFound.text')} action={<ButtonLink href="/">{t('nav.home')}</ButtonLink>} />
    </AppShell>
  );
}
