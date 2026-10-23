'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import type { AuthState } from '@/app/[locale]/(auth)/actions';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/nl';
import { Alert } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

const INITIAL: AuthState = { error: null };

function SubmitButton({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending}>
      {pending ? busyLabel : label}
    </Button>
  );
}

export function AuthForm({
  mode,
  locale,
  messages: t,
  action,
}: {
  mode: 'login' | 'register';
  locale: Locale;
  messages: Messages;
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  if (state.awaitingConfirmation) {
    return (
      <Alert tone="success" title={t.auth.checkYourEmail}>
        <p>
          {locale === 'nl'
            ? 'Wij stuurden u een bevestigingslink. Na bevestiging komt u ' +
              'rechtstreeks in uw overzicht terecht.'
            : 'Nous vous avons envoyé un lien de confirmation. Après ' +
              'confirmation, vous arriverez directement dans votre aperçu.'}
        </p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />

      {state.error ? (
        <Alert tone="critical">
          <p>{t.auth.errors[state.error]}</p>
        </Alert>
      ) : null}

      {mode === 'register' ? (
        <Field
          label={t.auth.fullName}
          htmlFor="fullName"
          required
          error={state.fieldErrors?.fullName?.[0] ?? null}
        >
          <Input
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
          />
        </Field>
      ) : null}

      <Field
        label={t.auth.email}
        htmlFor="email"
        required
        error={state.fieldErrors?.email?.[0] ?? null}
      >
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
        />
      </Field>

      <Field
        label={t.auth.password}
        htmlFor="password"
        required
        hint={mode === 'register' ? t.auth.passwordHint : undefined}
        error={state.fieldErrors?.password?.[0] ?? null}
      >
        <Input
          name="password"
          type="password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          minLength={mode === 'register' ? 10 : undefined}
        />
      </Field>

      <SubmitButton
        label={mode === 'register' ? t.auth.signUp : t.auth.signIn}
        busyLabel={t.common.loading}
      />
    </form>
  );
}
