"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loginAction } from "@/actions/auth";
import { EMPTY_RESULT } from "@/actions/types";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const tRoot = useTranslations();
  const locale = useLocale();
  const [state, formAction] = useActionState(loginAction, EMPTY_RESULT);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

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

      <Field label={t("fields.password")} htmlFor="password">
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <SubmitButton
        label={t("login.submit")}
        pendingLabel={t("login.pending")}
        size="lg"
        className="w-full"
      />
    </form>
  );
}
