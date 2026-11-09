"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  forbidden: "Je hebt hiervoor geen rechten.",
  mfa_required: "Bevestig eerst je tweestapsverificatie.",
  confirm: "De bevestiging klopt niet.",
  not_found: "Niet gevonden.",
  last_owner: "Er moet minstens één eigenaar blijven.",
  self: "Dat kan je niet op je eigen account doen.",
  rate_limited: "Te veel acties na elkaar. Wacht even.",
  stripe: "Stripe weigerde de actie. Kijk het na in het Stripe-dashboard.",
  bad_request: "Ongeldige invoer.",
};

/**
 * Knop voor een beheeractie. Met `confirmText` verschijnt eerst een bevestiging in de pagina;
 * met `typeToConfirm` moet de gebruiker die tekst letterlijk intypen (voor onomkeerbare acties).
 */
export function AdminAction({
  url, body, label, method = "POST", variant = "ghost", confirmText, typeToConfirm, done = "Gedaan.",
}: {
  url: string; body?: Record<string, unknown>; label: string; method?: "POST" | "DELETE" | "PATCH";
  variant?: "ghost" | "primary" | "danger"; confirmText?: string; typeToConfirm?: string; done?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setState("busy");
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(body ?? {}), ...(typeToConfirm ? { confirm: typed } : {}) }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setState("ok");
      setMsg(done);
      setOpen(false);
      setTyped("");
      router.refresh();
    } else {
      setState("fail");
      setMsg(ERRORS[j.error] ?? "Er ging iets mis. Probeer opnieuw.");
    }
  }

  const btn = `btn btn-sm btn-${variant === "danger" ? "danger" : variant === "primary" ? "primary" : "ghost"}`;
  const needsConfirm = !!(confirmText || typeToConfirm);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {!open && (
        <button type="button" className={btn} style={{ justifySelf: "start" }} disabled={state === "busy"}
          onClick={() => (needsConfirm ? setOpen(true) : run())}>{label}</button>
      )}
      {open && (
        <div className="confirm" role="alertdialog" aria-label={label}>
          {confirmText && <p style={{ margin: 0 }}>{confirmText}</p>}
          {typeToConfirm && (
            <label className="field">Typ <code>{typeToConfirm}</code> om te bevestigen
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
          )}
          <div className="btns">
            <button type="button" className="btn btn-sm btn-danger" onClick={run}
              disabled={state === "busy" || (!!typeToConfirm && typed !== typeToConfirm)}>{label}</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setOpen(false); setTyped(""); }}>Annuleer</button>
          </div>
        </div>
      )}
      {msg && <p className={state === "ok" ? "success" : "error"} role="status">{msg}</p>}
    </div>
  );
}
