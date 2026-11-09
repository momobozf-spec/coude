"use client";

import { useActionState } from "react";
import { requestLogin, type FormState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(requestLogin, {});
  if (state.ok) return <p className="msg ok" role="status">{state.message}</p>;
  return (
    <form action={action} style={{ display: "grid", gap: 14, maxWidth: 420 }} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">E-mailadres</label>
        <input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!state.errors?.email} />
        {state.errors?.email && <span className="ferr">{state.errors.email}</span>}
      </div>
      {state.message && <p className="msg err" role="alert">{state.message}</p>}
      <div><SubmitButton pendingText="Versturen…">Stuur aanmeldlink</SubmitButton></div>
    </form>
  );
}
