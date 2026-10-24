'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/app-shell';
import { errorMessage } from '@/components/states';
import { Button, Field, Notice, PageTitle } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { safeReturnPath } from '@/lib/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={<AppShell />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { t } = useI18n();
  const { login, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnPath(params.get('terug'), '/profiel');
  const expired = params.get('reden') === 'verlopen';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(returnTo);
  }, [user, router, returnTo]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ email, password });
      router.replace(returnTo);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? t('auth.error.invalid') : errorMessage(cause, t));
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <PageTitle>{t('auth.login.title')}</PageTitle>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {expired && !error && <Notice tone="warning">{t('auth.sessionExpired')}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label={t('auth.email')} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label={t('auth.password')} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" size="lg" full disabled={busy}>
            {busy ? t('common.loading') : t('auth.login.submit')}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm">
          <Link href={`/registreren?terug=${encodeURIComponent(returnTo)}`} className="font-semibold text-brand underline-offset-2 hover:underline">
            {t('auth.login.toRegister')}
          </Link>
        </p>
        <p className="mt-6 text-center text-xs text-ink-muted">{t('auth.sameAccountNote')}</p>
      </div>
    </AppShell>
  );
}
