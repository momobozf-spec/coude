"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Enroll = { factorId: string; qr: string; secret: string };

export function MfaForm({ hasFactor }: { hasFactor: boolean }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [code, setCode] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "busy" | "fail">("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb.auth.mfa.listFactors();
      if (error) { setErr("Kon je verificatiemethodes niet laden."); setState("fail"); return; }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) { setFactorId(verified.id); setState("ready"); return; }
      // Halve, niet-bevestigde registraties opruimen en opnieuw beginnen.
      for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        await sb.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: e, error: ee } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Huurklaar ${new Date().toISOString().slice(0, 10)}` });
      if (ee || !e) { setErr("Registratie starten lukte niet. Staat MFA aan in Supabase (Authentication → Multi-Factor)?"); setState("fail"); return; }
      setEnroll({ factorId: e.id, qr: e.totp.qr_code, secret: e.totp.secret });
      setFactorId(e.id);
      setState("ready");
    })();
  }, [hasFactor]);

  async function verify(ev: React.FormEvent) {
    ev.preventDefault();
    if (!factorId) return;
    setState("busy");
    setErr("");
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    if (error) { setErr("Die code klopt niet of is verlopen. Probeer de volgende code."); setState("ready"); return; }
    window.location.href = "/admin";
  }

  if (state === "loading") return <p className="muted">Laden…</p>;

  return (
    <form className="panel" onSubmit={verify}>
      {enroll && (
        <>
          <h2>Eenmalig instellen</h2>
          <p className="small">Scan deze QR-code met je authenticator-app. Lukt scannen niet? Voer de sleutel handmatig in.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mfa-qr" src={enroll.qr} alt="QR-code voor je authenticator-app" />
          <code className="addr">{enroll.secret}</code>
        </>
      )}
      <label className="field" htmlFor="code">Code van 6 cijfers
        <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required
          value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
      </label>
      <button className="btn btn-primary" type="submit" disabled={state === "busy" || !factorId}>Bevestig</button>
      {err && <p className="error" role="alert">{err}</p>}
    </form>
  );
}
