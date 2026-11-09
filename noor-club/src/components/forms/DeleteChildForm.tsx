"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deleteChildAction } from "@/actions/children";
import { EMPTY_RESULT } from "@/actions/types";
import { useActionRedirect } from "@/components/forms/useActionRedirect";
import { FormError } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

export function DeleteChildForm({ childId }: { childId: string }) {
  const t = useTranslations("children");
  const tRoot = useTranslations();
  const locale = useLocale();

  const [state, formAction] = useActionState(deleteChildAction, EMPTY_RESULT);
  useActionRedirect(state.redirectTo);

  return (
    <form action={formAction} className="mt-6 border-t border-slate-100 pt-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="childId" value={childId} />

      {state.error ? <FormError message={tRoot(state.error)} /> : null}

      <p className="mb-2 text-xs text-slate-500">{t("deleteConfirm")}</p>
      <SubmitButton
        label={t("delete")}
        pendingLabel={t("saving")}
        variant="danger"
        size="sm"
      />
    </form>
  );
}
