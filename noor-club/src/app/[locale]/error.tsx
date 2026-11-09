"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl" aria-hidden="true">
        🌙
      </p>
      <h1 className="text-2xl font-extrabold text-emerald-dark">{t("boundaryTitle")}</h1>
      <p className="text-slate-600">{t("boundaryBody")}</p>
      <Button onClick={reset} size="lg">
        {t("retry")}
      </Button>
    </div>
  );
}
