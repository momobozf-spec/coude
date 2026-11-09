"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/navigation";
import { setLocaleAction } from "@/actions/children";
import { Field, FormError, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { LOCALES, LOCALE_LABELS, isLocale } from "@/lib/locales";

/**
 * Saves the parent's preferred language *and* navigates to it, so the setting
 * takes effect on the page they are already looking at.
 */
export function LanguageForm() {
  const t = useTranslations("account");
  const tRoot = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [selected, setSelected] = useState(locale);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        setSaved(false);

        startTransition(async () => {
          const result = await setLocaleAction({}, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setSaved(true);
          const next = String(formData.get("locale") ?? "");
          if (isLocale(next) && next !== locale) {
            router.replace(pathname, { locale: next });
          }
        });
      }}
    >
      {error ? <FormError message={tRoot(error)} /> : null}

      <Field label={t("language")} htmlFor="account-locale">
        <Select
          id="account-locale"
          name="locale"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_LABELS[code]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? t("subscribing") : tRoot("common.save")}
        </Button>
        {saved && !isPending ? (
          <span className="text-sm font-bold text-emerald">{t("languageSaved")}</span>
        ) : null}
      </div>
    </form>
  );
}
