'use client';

import Link from 'next/link';
import { AccountSection } from '@/components/account-section';
import { AppShell } from '@/components/app-shell';
import { ChevronRightIcon, TagIcon } from '@/components/icons';
import { Button, ButtonLink, Card, PageTitle, SelectField } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { AppLocale } from '@/lib/format';
import { APP_LOCALES, LOCALE_LABEL, useI18n } from '@/lib/i18n';
import { THEMES, useTheme, type Theme } from '@/lib/theme';

export default function ProfilePage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, loading, logout } = useAuth();

  return (
    <AppShell>
      <PageTitle>{t('profile.title')}</PageTitle>

      <div className="space-y-4">
        <Card as="section" aria-labelledby="account-title">
          <h2 id="account-title" className="display text-[1.3rem] text-ink">
            {t('profile.account')}
          </h2>
          {loading && <p className="mt-2 text-sm text-ink-muted">{t('common.loading')}</p>}
          {!loading && user && (
            <div className="mt-3 space-y-4">
              <div className="flex items-center gap-3">
                <span className="display flex size-14 shrink-0 items-center justify-center rounded-full bg-brand text-[1.5rem] text-brand-ink" aria-hidden="true">
                  {user.fullName
                    .split(/\s+/)
                    .map((part) => part[0] ?? '')
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <p className="min-w-0 text-[15px] text-ink">
                  <span className="block font-bold">{t('auth.loggedInAs', { name: user.fullName })}</span>
                  <span className="block truncate text-sm text-ink-muted">{user.email}</span>
                </p>
              </div>
              <Button variant="secondary" onClick={() => void logout()}>
                {t('auth.logout')}
              </Button>
            </div>
          )}
          {!loading && !user && (
            <div className="mt-2 space-y-3">
              <p className="text-sm font-semibold text-ink">{t('profile.guest.title')}</p>
              <p className="text-sm text-ink-muted">{t('profile.guest.text')}</p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/inloggen?terug=%2Fprofiel">{t('nav.login')}</ButtonLink>
                <ButtonLink href="/registreren?terug=%2Fprofiel" variant="secondary">
                  {t('nav.register')}
                </ButtonLink>
              </div>
            </div>
          )}
        </Card>

        <Card as="section" aria-labelledby="prefs-title" className="p-0">
          <Link href="/profiel/voorkeuren" className="flex items-center gap-3 rounded-[18px] p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-tag text-tag-ink" aria-hidden="true">
              <TagIcon />
            </span>
            <span className="min-w-0 flex-1">
              <h2 id="prefs-title" className="text-base font-bold text-ink">
                {t('profile.preferencesLink')}
              </h2>
              <span className="mt-0.5 block text-sm text-ink-muted">{t('profile.preferencesText')}</span>
            </span>
            <ChevronRightIcon size={20} className="shrink-0 text-ink-muted" />
          </Link>
        </Card>

        <Card as="section" aria-labelledby="settings-title">
          <h2 id="settings-title" className="display text-[1.3rem] text-ink">
            {t('profile.settings')}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SelectField label={t('common.language')} name="locale" value={locale} onChange={(e) => setLocale(e.target.value as AppLocale)}>
              {APP_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_LABEL[code]}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('common.theme')} name="theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {THEMES.map((option) => (
                <option key={option} value={option}>
                  {t(`common.theme.${option}`)}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        {user && <AccountSection />}

        <Card>
          <h2 id="privacy-title" className="display text-[1.3rem] text-ink">
            {t('profile.privacyTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.privacyText')}</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Link href="/privacy" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-strong underline underline-offset-2">
              {t('privacy.title')}
            </Link>
            <Link href="/over-de-gegevens" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-strong underline underline-offset-2">
              {t('profile.dataLink')}
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
