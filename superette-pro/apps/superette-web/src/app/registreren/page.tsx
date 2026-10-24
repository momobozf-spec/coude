'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/app-shell';
import { errorMessage } from '@/components/states';
import { Button, Checkbox, Field, Notice, PageTitle } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { safeReturnPath } from '@/lib/navigation';

export default function RegisterPage() {
  return (
    <Suspense fallback={<AppShell />}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const { t, locale } = useI18n();
  const { register, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get('terug'), '/profiel');

  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(returnTo);
  }, [user, router, returnTo]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!terms) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        // De API kent nl en fr; Engelstalige gebruikers krijgen nl als voorkeurstaal in hun profiel.
        locale: locale === 'fr' ? 'fr' : 'nl',
        acceptsTerms: true,
        // Er is (nog) geen nieuwsbrief: geen toestemming vragen voor iets wat niet bestaat.
        acceptsMarketing: false,
      });
      router.replace(returnTo);
    } catch (cause) {
      if (cause instanceof ApiError && cause.issues) {
        setFieldErrors(Object.fromEntries(cause.issues.map((issue) => [issue.path, issue.message])));
      }
      setError(errorMessage(cause, t));
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <PageTitle lead={t('auth.register.intro')}>{t('auth.register.title')}</PageTitle>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label={t('auth.fullName')} name="fullName" autoComplete="name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={fieldErrors['fullName']} />
          <Field label={t('auth.email')} name="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={fieldErrors['email']} />
          <Field
            label={t('auth.password')}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            hint={t('auth.password.hint')}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={fieldErrors['password']}
          />
          <Checkbox label={t('auth.terms')} checked={terms} onChange={(e) => setTerms(e.target.checked)} required name="acceptsTerms" />
          <p className="-mt-2 text-xs text-ink-muted">
            {t('auth.termsRead')}{' '}
            <Link href="/voorwaarden" className="font-semibold text-brand underline-offset-2 hover:underline">
              {t('nav.terms')}
            </Link>
            {' · '}
            <Link href="/privacy" className="font-semibold text-brand underline-offset-2 hover:underline">
              {t('nav.privacy')}
            </Link>
          </p>
          <Button type="submit" size="lg" full disabled={busy || !terms}>
            {busy ? t('common.loading') : t('auth.register.submit')}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm">
          <Link href={`/inloggen?terug=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand underline-offset-2 hover:underline">
            {t('auth.register.toLogin')}
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
