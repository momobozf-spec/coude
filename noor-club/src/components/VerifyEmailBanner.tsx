import { getTranslations } from "next-intl/server";
import { ResendVerification } from "@/components/forms/ResendVerification";

/**
 * A nudge, not a wall.
 *
 * Locking the app until the address is confirmed costs conversion and punishes
 * a parent for a slow mail server. Checkout is where it actually matters — see
 * `startCheckout` — because an unreachable paying customer is the problem.
 */
export async function VerifyEmailBanner({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "verify" });

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-gold bg-gold-light p-4"
    >
      <div className="min-w-0">
        <p className="font-extrabold text-emerald-dark">{t("bannerTitle")}</p>
        <p className="mt-0.5 text-sm text-slate-700">{t("bannerBody")}</p>
      </div>
      <ResendVerification compact />
    </div>
  );
}
