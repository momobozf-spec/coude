'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Alert, Button, Field, Wordmark } from '@/components/ui';

export default function LoginPage() {
  const { t } = useI18n();
  const { login, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace('/sleutel');
  }, [user, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await login({ email, password });
      router.replace('/sleutel');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Er ging iets mis');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <Wordmark className="text-4xl" />
        <p className="mt-2 text-sm text-ink-muted">{t('app.tagline')}</p>
      </div>

      <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl">{t('auth.login.title')}</h1>

      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field
          label={t('auth.email')}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label={t('auth.password')}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" disabled={busy}>
          {busy ? t('common.loading') : t('auth.login.submit')}
        </Button>
      </form>

      <Link href="/registreren" className="mt-6 text-center text-sm text-accent underline-offset-4 hover:underline">
        {t('auth.login.toRegister')}
      </Link>
    </main>
  );
}
