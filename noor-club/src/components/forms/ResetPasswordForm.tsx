"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { resetPassword } from "@/actions/password";
import { EMPTY_RESULT } from "@/actions/types";
import { Link } from "@/navigation";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClasses } from "@/components/ui/Button";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const tRoot = useTranslations();
  const locale = useLocale();

  const [state, formAction, isPending] = useActionState(resetPassword, EMPTY_RESULT);
  const done = state !== EMPTY_RESULT && !state.error && !isPending;

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="status"
          className="rounded-2xl bg-emerald-light px-4 py-3 text-sm font-semibold text-emerald-dark"
        >
          {t("reset.done")}
        </p>
        <Link href="/login" className={buttonClasses("primary", "lg", "w-full")}>
          {t("login.submit")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <div className="flex flex-col gap-3">
          <FormError message={tRoot(state.error)} />
          <Link href="/wachtwoord-vergeten" className="text-sm font-bold text-emerald underline">
            {t("reset.requestNew")}
          </Link>
        </div>
      ) : null}

      <Field label={t("reset.password")} htmlFor="password" hint={t("fields.passwordHint")}>
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
        label={t("reset.submit")}
        pendingLabel={t("reset.pending")}
        size="lg"
        className="w-full"
      />
    </form>
  );
}
