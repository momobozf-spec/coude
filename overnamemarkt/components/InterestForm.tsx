"use client";

import { useActionState } from "react";
import { expressInterest, type FormState } from "@/app/actions";
import { BUDGETS } from "@/lib/format";
import { SubmitButton } from "./SubmitButton";

export function InterestForm({ listingId, defaultEmail }: { listingId: string; defaultEmail: string }) {
  const [state, action] = useActionState<FormState, FormData>(expressInterest, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  if (state.ok) return <p className="msg ok" role="status">{state.message}</p>;
  return (
    <form action={action} style={{ display: "grid", gap: 14 }} noValidate key={state.attempt ?? 0}>
      <input type="hidden" name="listing_id" value={listingId} />
      <div className="fields">
        <div className="field full">
          <label htmlFor="message">Wie ben je en wat wil je weten?</label>
          <textarea id="message" name="message" maxLength={2000} defaultValue={v.message ?? ""} aria-invalid={!!e.message} aria-describedby={e.message ? "err-message" : undefined}
            placeholder="Bijvoorbeeld: ik ben ondernemer in dezelfde sector en wil de churn en de klantconcentratie zien." />
          {e.message && <span className="ferr" id="err-message">{e.message}</span>}
        </div>
        <div className="field">
          <label htmlFor="contact_email">E-mailadres voor contact</label>
          <input id="contact_email" name="contact_email" type="email" autoComplete="email" defaultValue={v.contact_email ?? defaultEmail} aria-invalid={!!e.contact_email} />
          {e.contact_email && <span className="ferr">{e.contact_email}</span>}
        </div>
        <div className="field">
          <label htmlFor="budget">Budget <span className="hint">(optioneel)</span></label>
          <select id="budget" name="budget" defaultValue={v.budget ?? ""}>
            <option value="">Zeg ik liever niet</option>
            {BUDGETS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="field full" style={{ gap: 10 }}>
          <label className="check" htmlFor="consent_confidential">
            <input id="consent_confidential" name="consent_confidential" type="checkbox" defaultChecked={v.consent_confidential === "on"} />
            <span>Ik behandel informatie die ik over dit bedrijf krijg vertrouwelijk.</span>
          </label>
          {e.consent_confidential && <span className="ferr">{e.consent_confidential}</span>}
          <label className="check" htmlFor="consent_share">
            <input id="consent_share" name="consent_share" type="checkbox" defaultChecked={v.consent_share === "on"} />
            <span>Jullie mogen mijn bericht en e-mailadres doorgeven aan de verkoper van deze aanbieding.</span>
          </label>
          {e.consent_share && <span className="ferr">{e.consent_share}</span>}
        </div>
      </div>
      {state.message && <p className="msg err" role="alert">{state.message}</p>}
      <div><SubmitButton pendingText="Versturen…">Interesse versturen</SubmitButton></div>
    </form>
  );
}
