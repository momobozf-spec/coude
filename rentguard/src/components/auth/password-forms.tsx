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

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

type Action = (state: AuthState, formData: FormData) => Promise<AuthState>;

export function ForgotPasswordForm({
  locale,
  messages: t,
  action,
}: {
  locale: Locale;
  messages: Messages;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  if (state.resetRequested) {
    return (
      <Alert tone="success">
        <p>{t.auth.resetLinkSent}</p>
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
      <Field
        label={t.auth.email}
        htmlFor="email"
        required
        error={state.fieldErrors?.email?.[0] ?? null}
      >
        <Input name="email" type="email" inputMode="email" autoComplete="email" required />
      </Field>
      <Submit label={t.auth.sendResetLink} busy={t.common.loading} />
    </form>
  );
}

export function ResetPasswordForm({
  locale,
  messages: t,
  action,
}: {
  locale: Locale;
  messages: Messages;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state.error ? (
        <Alert tone="critical">
          <p>{t.auth.errors[state.error]}</p>
        </Alert>
      ) : null}
      <Field
        label={t.auth.newPassword}
        htmlFor="password"
        required
        hint={t.auth.passwordHint}
        error={state.fieldErrors?.password?.[0] ?? null}
      >
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label={t.auth.confirmPassword} htmlFor="confirm" required>
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Submit label={t.auth.savePassword} busy={t.common.loading} />
    </form>
  );
}
