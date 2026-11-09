"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_INFO, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";

const ERR: Record<string, string> = {
  not_found: "Geen account met dat e-mailadres. Laat die persoon eerst één keer inloggen op de site.",
  last_owner: "Er moet minstens één eigenaar blijven.",
  self: "Je kan je eigen rol niet wijzigen.",
  bad_request: "Ongeldige invoer.",
};

export function TeamForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/team", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), role }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { setMsg({ ok: true, text: `${email} is nu ${ROLE_LABEL[role]}.` }); setEmail(""); router.refresh(); }
    else setMsg({ ok: false, text: ERR[j.error] ?? "Er ging iets mis." });
    setBusy(false);
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
      <h3>Teamlid toevoegen of rol wijzigen</h3>
      <div className="row">
        <label className="field" htmlFor="tm-email">E-mailadres van het account<input id="tm-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field" htmlFor="tm-role">Rol
          <select id="tm-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <small>{ROLE_INFO[role]}</small>
        </label>
      </div>
      <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifySelf: "start" }}>Opslaan</button>
      {msg && <p className={msg.ok ? "success" : "error"} role="status">{msg.text}</p>}
      <p className="small">Elk teamlid moet bij de eerste keer tweestapsverificatie instellen.</p>
    </form>
  );
}
