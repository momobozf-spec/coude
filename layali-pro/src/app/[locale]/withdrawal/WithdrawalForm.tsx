"use client";

import { useState } from "react";

/**
 * Online herroepingsfunctie (Richtlijn (EU) 2023/2673): eerst een duidelijke
 * knop "Hier de overeenkomst herroepen", dan een korte verklaring (naam,
 * bestelnummer, e-mail voor de bevestiging) en een aparte bevestigingsknop.
 * Geen vooraf aangevinkte vakjes, geen extra toestemmingen.
 */
const TEXT = {
  nl: {
    open: "Hier de overeenkomst herroepen",
    intro: "Vul in waarvoor je herroept. Je krijgt een ontvangstbevestiging per e-mail.",
    name: "Naam",
    email: "E-mailadres (voor de bevestiging)",
    order: "Bestelnummer",
    items: "Welke producten? (leeg = de hele bestelling)",
    confirm: "Herroeping bevestigen",
    sending: "Bezig…",
    done: "Je herroeping is ontvangen op",
    mailed: "We hebben een ontvangstbevestiging gemaild.",
    notMailed: "De bevestigingsmail kon niet verstuurd worden; bewaar deze pagina of mail ons.",
    error: "Versturen lukte niet. Probeer opnieuw of mail ons je herroeping.",
  },
  fr: {
    open: "Se rétracter du contrat ici",
    intro: "Indiquez ce dont vous vous rétractez. Vous recevrez un accusé de réception par e-mail.",
    name: "Nom",
    email: "Adresse e-mail (pour l'accusé de réception)",
    order: "Numéro de commande",
    items: "Quels produits ? (vide = toute la commande)",
    confirm: "Confirmer la rétractation",
    sending: "Envoi…",
    done: "Votre rétractation a été reçue le",
    mailed: "Nous vous avons envoyé un accusé de réception par e-mail.",
    notMailed: "L'e-mail de confirmation n'a pas pu être envoyé ; conservez cette page ou écrivez-nous.",
    error: "L'envoi a échoué. Réessayez ou envoyez-nous votre rétractation par e-mail.",
  },
} as const;

const input =
  "flex h-11 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function WithdrawalForm({ locale }: { locale: string }) {
  const t = locale === "fr" ? TEXT.fr : TEXT.nl;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ receivedAt: string; acknowledged: boolean } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          orderNumber: form.get("orderNumber"),
          items: form.get("items"),
          confirm: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? t.error);
      setResult({ receivedAt: data.receivedAt, acknowledged: Boolean(data.acknowledged) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const when = new Date(result.receivedAt).toLocaleString(locale === "fr" ? "fr-BE" : "nl-BE", {
      timeZone: "Europe/Brussels",
    });
    return (
      <div role="status" className="rounded-2xl border border-emerald/40 bg-white p-6 text-sm text-foreground">
        <p className="font-semibold">
          {t.done} {when}.
        </p>
        <p className="mt-2 text-muted-foreground">{result.acknowledged ? t.mailed : t.notMailed}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded-full bg-emerald px-8 text-sm font-medium text-white hover:bg-emerald/90 cursor-pointer"
      >
        {t.open}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-white p-6">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <label className="block space-y-1.5 text-sm font-medium text-foreground">
        <span>{t.name}</span>
        <input name="name" required maxLength={120} autoComplete="name" className={input} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground">
        <span>{t.email}</span>
        <input name="email" type="email" required maxLength={254} autoComplete="email" className={input} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground">
        <span>{t.order}</span>
        <input name="orderNumber" required maxLength={40} placeholder="LAYALI-2026-000001" className={input} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground">
        <span>{t.items}</span>
        <textarea name="items" rows={2} maxLength={1000} className={`${input} h-auto py-3`} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 items-center justify-center rounded-full bg-emerald px-8 text-sm font-medium text-white hover:bg-emerald/90 disabled:opacity-50 cursor-pointer"
      >
        {busy ? t.sending : t.confirm}
      </button>
    </form>
  );
}
