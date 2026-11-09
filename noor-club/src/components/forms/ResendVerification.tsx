"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { resendVerification } from "@/actions/account";
import { EMPTY_RESULT } from "@/actions/types";
import { FormError } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function ResendVerification({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("verify");
  const tRoot = useTranslations();
  const locale = useLocale();

  const [state, formAction] = useActionState(resendVerification, EMPTY_RESULT);

  if (state.okAt) {
    return (
      <p role="status" className="text-sm font-bold text-emerald-dark">
        {t("resent")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      {state.error ? <FormError message={tRoot(state.error)} /> : null}
      <SubmitButton
        label={t("resend")}
        pendingLabel={t("resending")}
        variant={compact ? "secondary" : "primary"}
        size={compact ? "sm" : "md"}
      />
    </form>
  );
}
