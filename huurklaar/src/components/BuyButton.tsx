"use client";
import { track } from "@vercel/analytics";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export function BuyButton({
  product, lang, label, className = "btn btn-primary", errorText,
}: { product: "dossier" | "zoekpas"; lang: Locale; label: string; className?: string; errorText: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product, lang }),
      });
      if (r.status === 401) {
        window.location.href = `/${lang}/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const j = await r.json();
      if (j.url) {
        track("checkout_start", { product });
        window.location.href = j.url;
        return;
      }
      if (j.error === "already_owned") {
        window.location.href = `/${lang}/account`;
        return;
      }
      setMsg(errorText);
    } catch {
      setMsg(errorText);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button type="button" className={className} onClick={go} disabled={busy} aria-busy={busy}>{label}</button>
      {msg && <p className="error" role="alert">{msg}</p>}
    </div>
  );
}
