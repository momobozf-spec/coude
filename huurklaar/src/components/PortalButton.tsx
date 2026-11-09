"use client";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export function PortalButton({ lang, label, errorText }: { lang: Locale; label: string; errorText: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function go() {
    setBusy(true);
    setErr(false);
    try {
      const r = await fetch("/api/portal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang }) });
      const j = await r.json();
      if (j.url) window.location.href = j.url;
      else setErr(true);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>{label}</button>
      {err && <p className="error" role="alert">{errorText}</p>}
    </>
  );
}
