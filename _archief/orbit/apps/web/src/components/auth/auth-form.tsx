'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { ApiErrorBody } from '@orbit/types';
import { Button } from '@/components/ui/primitives';

/**
 * Inloggen en registreren delen dit formulier. De foutteksten komen uit de
 * `ErrorCode` die de API teruggeeft, niet uit HTTP-statussen: zo staat de
 * vertaling op één plek en blijft de API-boodschap taalvrij.
 */

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mailadres of wachtwoord klopt niet.',
  EMAIL_IN_USE: 'Er bestaat al een account met dit e-mailadres.',
  CONFLICT: 'Er bestaat al een account met dit e-mailadres.',
  RATE_LIMITED: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.',
  VALIDATION_FAILED: 'Controleer de ingevulde gegevens.',
  INTERNAL: 'Er ging iets mis aan onze kant. Probeer het opnieuw.',
};

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      ...(isRegister
        ? {
            name: String(form.get('name') ?? ''),
            // De tijdzone van de browser is een betere gok dan een vaste
            // standaard; de gebruiker kan hem later wijzigen.
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }
        : {}),
      platform: 'WEB' as const,
    };

    try {
      const response = await fetch(`/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        const code = body?.error?.code ?? 'INTERNAL';
        setError(MESSAGES[code] ?? body?.error?.message ?? MESSAGES.INTERNAL ?? 'Er ging iets mis.');
        return;
      }

      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } catch {
      setError('Geen verbinding. Controleer je internetverbinding.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {isRegister ? (
        <Field label="Naam" name="name" type="text" autoComplete="name" required />
      ) : null}

      <Field
        label="E-mailadres"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus={!isRegister}
      />

      <Field
        label="Wachtwoord"
        name="password"
        type="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        required
        minLength={isRegister ? 10 : undefined}
        hint={isRegister ? 'Minimaal 10 tekens. Een zin werkt beter dan een kort wachtwoord.' : undefined}
      />

      {error ? (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={busy} className="w-full">
        {busy ? 'Bezig...' : isRegister ? 'Account aanmaken' : 'Inloggen'}
      </Button>

      <p className="text-center text-sm text-ink-tertiary">
        {isRegister ? (
          <>
            Al een account?{' '}
            <Link href="/login" className="text-accent-text hover:underline">
              Inloggen
            </Link>
          </>
        ) : (
          <>
            Nog geen account?{' '}
            <Link href="/registreren" className="text-accent-text hover:underline">
              Registreren
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = `field-${props.name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base outline-none transition-colors placeholder:text-ink-disabled focus:border-line-focus"
      />
      {hint ? <p className="mt-1 text-xs text-ink-tertiary">{hint}</p> : null}
    </div>
  );
}
