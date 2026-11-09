"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deleteAccount } from "@/actions/account";
import { EMPTY_RESULT } from "@/actions/types";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/Button";

/**
 * Deleting is behind two gates: opening the panel, and typing the account's own
 * e-mail address. This wipes every child's progress permanently, so a stray tap
 * must not be able to do it.
 */
export function DangerZone({ email }: { email: string }) {
  const t = useTranslations("account.danger");
  const tRoot = useTranslations();
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction] = useActionState(deleteAccount, EMPTY_RESULT);

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <section className="rounded-card border-2 border-red-200 bg-red-50/60 p-5">
      <h2 className="text-lg font-extrabold text-red-800">{t("title")}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{t("body")}</p>

      {!open ? (
        <div className="mt-4">
          <Button variant="danger" onClick={() => setOpen(true)}>
            {t("open")}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />

          {state.error ? <FormError message={tRoot(state.error)} /> : null}

          <Field label={t("confirmLabel", { email })} htmlFor="confirmEmail">
            <TextInput
              id="confirmEmail"
              name="confirmEmail"
              type="email"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={email}
              required
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {/* Enabled only once the typed address matches. */}
            {matches ? (
              <SubmitButton
                label={t("confirm")}
                pendingLabel={t("deleting")}
                variant="danger"
              />
            ) : (
              <Button variant="danger" disabled>
                {t("confirm")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tRoot("common.cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
