"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";

/** Inschrijven op de nieuwsbrief; het adres gaat in de body, nooit in de URL. */
export default function NewsletterForm({ placeholder, button }: { placeholder: string; button: string }) {
  const tHome = useTranslations("home");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="mx-auto mt-8 flex items-center justify-center gap-2 text-sm font-medium">
        <Check className="h-4 w-4" />
        {tHome("newsletterThanks")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-full border border-white/20 bg-white/10 px-5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="h-12 whitespace-nowrap rounded-full bg-gold px-8 text-sm font-semibold text-secondary transition-colors hover:bg-gold-light cursor-pointer disabled:opacity-60"
      >
        {button}
      </button>
      {state === "error" && <p className="text-xs text-white/80 sm:hidden">Er ging iets mis. Probeer opnieuw.</p>}
    </form>
  );
}
