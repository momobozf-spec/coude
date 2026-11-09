"use client";
import { useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function LoginForm({ t, next, lang }: { t: Dict["l"]; next: string; lang: Locale }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "fail">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect, data: { lang } },
    });
    setState(error ? "fail" : "sent");
  }

  if (state === "sent") return <p className="success" role="status">{t.sent}</p>;

  return (
    <form className="panel" onSubmit={submit}>
      <label className="field" htmlFor="email">
        {t.email}
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn btn-primary" type="submit" disabled={state === "busy"}>{t.send}</button>
      {state === "fail" && <p className="error" role="alert">{t.fail}</p>}
      <p className="small">{t.consent}</p>
    </form>
  );
}
