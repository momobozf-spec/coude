import { startCheckout, openPortal } from "@/actions/billing";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * Plain <form> posting to a server action, so this stays a server component and
 * the checkout redirect happens server-side — no client JS needed to buy.
 */
export function CheckoutButton({
  locale,
  label,
  consentLabel,
  disabled = false,
  variant = "gold",
  size = "lg",
  className,
}: {
  locale: string;
  label: string;
  /** When given, an explicit waiver checkbox is required before paying. */
  consentLabel?: string;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <form action={startCheckout} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />

      {consentLabel ? (
        // Separate from the terms on purpose: waiving the 14-day withdrawal
        // right has to be its own deliberate act, not a bundled tick.
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-700">
          <input
            type="checkbox"
            name="waiveWithdrawal"
            required
            className="mt-1 h-5 w-5 shrink-0 rounded border-2 border-emerald accent-emerald"
          />
          <span>{consentLabel}</span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={disabled}
        className={buttonClasses(variant, size, className)}
      >
        {label}
      </button>
    </form>
  );
}

export function PortalButton({
  locale,
  label,
  variant = "secondary",
  size = "md",
  className,
}: {
  locale: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <form action={openPortal}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={buttonClasses(variant, size, className)}>
        {label}
      </button>
    </form>
  );
}
