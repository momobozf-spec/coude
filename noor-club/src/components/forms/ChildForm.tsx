"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createChildAction, updateChildAction } from "@/actions/children";
import { EMPTY_RESULT } from "@/actions/types";
import { useActionRedirect } from "@/components/forms/useActionRedirect";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { AVATARS } from "@/lib/validators";
import { avatarGlyph, avatarTint } from "@/lib/avatars";
import { cn } from "@/lib/cn";

type ChildFormProps = {
  child?: { id: string; name: string; avatar: string; ageBand: string };
};

const AGE_BANDS = ["4-6", "7-9"] as const;

export function ChildForm({ child }: ChildFormProps) {
  const t = useTranslations("children");
  const tAvatars = useTranslations("avatars");
  const tRoot = useTranslations();
  const locale = useLocale();

  const isEdit = child !== undefined;
  const [state, formAction] = useActionState(
    isEdit ? updateChildAction : createChildAction,
    EMPTY_RESULT,
  );

  useActionRedirect(state.redirectTo);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {child ? <input type="hidden" name="childId" value={child.id} /> : null}

      {state.error ? <FormError message={tRoot(state.error)} /> : null}

      <Field label={t("name")} htmlFor={`child-name-${child?.id ?? "new"}`}>
        <TextInput
          id={`child-name-${child?.id ?? "new"}`}
          name="name"
          required
          maxLength={30}
          defaultValue={child?.name ?? ""}
          placeholder={t("namePlaceholder")}
        />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-emerald-dark">{t("avatar")}</legend>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((avatar) => (
            <label
              key={avatar}
              className={cn(
                "tap-target flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-transparent p-2",
                avatarTint(avatar),
                "has-[:checked]:border-emerald has-[:checked]:ring-2 has-[:checked]:ring-emerald",
              )}
            >
              <input
                type="radio"
                name="avatar"
                value={avatar}
                defaultChecked={(child?.avatar ?? "fox") === avatar}
                className="sr-only"
              />
              <span className="text-2xl" aria-hidden="true">
                {avatarGlyph(avatar)}
              </span>
              <span className="text-[11px] font-bold text-slate-700">
                {tAvatars(avatar)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-emerald-dark">{t("ageBand")}</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map((band) => (
            <label
              key={band}
              className="tap-target flex cursor-pointer items-center rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 has-[:checked]:border-emerald has-[:checked]:bg-emerald-light has-[:checked]:text-emerald-dark"
            >
              <input
                type="radio"
                name="ageBand"
                value={band}
                defaultChecked={(child?.ageBand ?? "4-6") === band}
                className="sr-only"
              />
              {band === "4-6" ? t("ageBand46") : t("ageBand79")}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton
        label={isEdit ? t("save") : t("create")}
        pendingLabel={isEdit ? t("saving") : t("creating")}
        size="lg"
      />
    </form>
  );
}
