"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="thomas.peeters@immo-gent.be" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state.error ? <p className="rounded-md bg-hot-100 px-3 py-2 text-sm text-hot-600">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
