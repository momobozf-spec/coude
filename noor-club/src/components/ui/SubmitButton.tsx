"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * Submit button that disables itself while its parent form action is pending.
 * `useFormStatus` reads the status of the enclosing <form>, so this must stay a
 * separate client component rendered *inside* the form.
 *
 * It also stays disabled until this component has mounted. Before hydration a
 * click would submit the form natively, and a client action cannot run — the
 * mutation would go through while the page sat there doing nothing visible.
 * The window is a few hundred milliseconds; the button simply is not offered
 * until it genuinely works.
 */
export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
}: {
  label: string;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const disabled = pending || !ready;

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-busy={pending}
      className={buttonClasses(variant, size, className)}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
