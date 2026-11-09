"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { requestPasswordReset } from "@/actions/password";
import { EMPTY_RESULT } from "@/actions/types";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tRoot = useTranslations();
  const locale = useLocale();

  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    EMPTY_RESULT,
  );

  // A successful request returns an empty result; the message below is
  // deliberately identical whether or not the address exists.
  const submitted = state !== EMPTY_RESULT && !state.error && !isPending;

  if (submitted) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-emerald-light px-4 py-3 text-sm font-semibold text-emerald-dark"
      >
        {t("forgot.sent")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />

      {state.error ? <FormError message={tRoot(state.error)} /> : null}

      <Field label={t("fields.email")} htmlFor="email">
        <TextInput
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder={t("fields.emailPlaceholder")}
        />
      </Field>

      <SubmitButton
        label={t("forgot.submit")}
        pendingLabel={t("forgot.pending")}
        size="lg"
        className="w-full"
      />
    </form>
  );
}
