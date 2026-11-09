import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";
import { buttonClasses } from "@/components/ui/Button";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl" aria-hidden="true">
        🧭
      </p>
      <h1 className="text-2xl font-extrabold text-emerald-dark">{t("notFoundTitle")}</h1>
      <p className="text-slate-600">{t("notFoundBody")}</p>
      <Link href="/" className={buttonClasses("primary", "lg")}>
        {t("backHome")}
      </Link>
    </div>
  );
}
