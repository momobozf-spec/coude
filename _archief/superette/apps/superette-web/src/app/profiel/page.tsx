'use client';

import Link from 'next/link';
import { AccountSection } from '@/components/account-section';
import { AppShell } from '@/components/app-shell';
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
          <h2 id="account-title" className="text-base font-bold text-ink">
            {t('profile.account')}
          </h2>
          {loading && <p className="mt-2 text-sm text-ink-muted">{t('common.loading')}</p>}
          {!loading && user && (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-ink">
                {t('auth.loggedInAs', { name: user.fullName })}
                <br />
                <span className="text-ink-muted">{user.email}</span>
              </p>
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

        <Card as="section" aria-labelledby="prefs-title">
          <h2 id="prefs-title" className="text-base font-bold text-ink">
            {t('profile.preferencesLink')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.preferencesText')}</p>
          <ButtonLink href="/profiel/voorkeuren" variant="secondary" className="mt-3">
            {t('profile.preferencesLink')}
          </ButtonLink>
        </Card>

        <Card as="section" aria-labelledby="settings-title">
          <h2 id="settings-title" className="text-base font-bold text-ink">
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

        <Card as="section" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="text-base font-bold text-ink">
            {t('profile.privacyTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{t('profile.privacyText')}</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Link href="/privacy" className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
              {t('privacy.title')}
            </Link>
            <Link href="/over-de-gegevens" className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
              {t('profile.dataLink')}
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
