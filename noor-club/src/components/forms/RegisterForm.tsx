"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { registerAction } from "@/actions/auth";
import { EMPTY_RESULT } from "@/actions/types";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function RegisterForm() {
  const t = useTranslations("auth");
  const tRoot = useTranslations();
  const locale = useLocale();
  const [state, formAction] = useActionState(registerAction, EMPTY_RESULT);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />

      {state.error ? <FormError message={tRoot(state.error)} /> : null}

      <Field label={t("fields.name")} htmlFor="name">
        <TextInput
          id="name"
          name="name"
          autoComplete="name"
          required
          placeholder={t("fields.namePlaceholder")}
        />
      </Field>

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

      <Field label={t("fields.password")} htmlFor="password" hint={t("fields.passwordHint")}>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      <SubmitButton
        label={t("register.submit")}
        pendingLabel={t("register.pending")}
        size="lg"
        className="w-full"
      />

      <p className="text-xs leading-relaxed text-slate-500">{t("register.consent")}</p>
    </form>
  );
}
