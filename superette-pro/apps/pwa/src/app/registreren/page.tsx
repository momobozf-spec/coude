'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Alert, Button, Card, Checkbox, Field, Wordmark } from '@/components/ui';

export default function RegisterPage() {
  const { t, locale } = useI18n();
  const { register } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' });
  const [accessLog, setAccessLog] = useState(false);
  const [camera, setCamera] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // De twee verplichte toestemmingen. De knop blijft uit tot ze allebei staan —
  // eerlijker dan een 400 van de server nadat de klant alles heeft ingetikt.
  const consentsGiven = accessLog && camera;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        locale,
        acceptsAccessLogging: true,
        acceptsCameraSurveillance: true,
        acceptsMarketing: marketing,
      });
      router.replace('/sleutel');
    } catch (cause) {
      if (cause instanceof ApiError && cause.issues) {
        setFieldErrors(Object.fromEntries(cause.issues.map((issue) => [issue.path, issue.message])));
      }
      setError(cause instanceof ApiError ? cause.message : 'Er ging iets mis');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Wordmark className="text-3xl" />
      </div>

      <h1 className="mb-6 font-[family-name:var(--font-display)] text-2xl">{t('auth.register.title')}</h1>

      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field
          label={t('auth.fullName')}
          name="fullName"
          autoComplete="name"
          required
          value={form.fullName}
          onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          error={fieldErrors['fullName']}
        />
        <Field
          label={t('auth.email')}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          error={fieldErrors['email']}
        />
        <Field
          label={t('auth.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint={t('auth.password.hint')}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          error={fieldErrors['password']}
        />
        <Field
          label={t('auth.phone')}
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+32470123456"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          error={fieldErrors['phone']}
        />

        <Card className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">{t('consent.title')}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{t('consent.intro')}</p>
          </div>

          <Checkbox
            name="accessLog"
            checked={accessLog}
            onChange={(event) => setAccessLog(event.target.checked)}
            label={
              <>
                {t('consent.accessLog')}
                <span className="ml-1.5 text-xs text-accent">({t('consent.required')})</span>
              </>
            }
          />
          <Checkbox
            name="camera"
            checked={camera}
            onChange={(event) => setCamera(event.target.checked)}
            label={
              <>
                {t('consent.camera')}
                <span className="ml-1.5 text-xs text-accent">({t('consent.required')})</span>
              </>
            }
          />

          <hr className="border-hairline" />

          {/* Marketing staat onder een streep en is nooit voorgevinkt: AVG art. 7.4
              verbiedt het koppelen van toestemming aan een dienst die er niet van
              afhangt. */}
          <Checkbox
            name="marketing"
            checked={marketing}
            onChange={(event) => setMarketing(event.target.checked)}
            label={t('consent.marketing')}
          />
        </Card>

        <Button type="submit" disabled={busy || !consentsGiven}>
          {busy ? t('common.loading') : t('auth.register.submit')}
        </Button>
      </form>

      <Link href="/inloggen" className="mt-6 text-center text-sm text-accent underline-offset-4 hover:underline">
        {t('auth.register.toLogin')}
      </Link>
    </main>
  );
}
