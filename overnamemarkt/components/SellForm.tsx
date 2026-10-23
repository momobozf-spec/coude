"use client";

import { useActionState } from "react";
import { submitListing, type FormState } from "@/app/actions";
import { LISTING_TYPES } from "@/lib/format";
import { SubmitButton } from "./SubmitButton";

function Err({ msg, id }: { msg?: string; id: string }) {
  return msg ? <span className="ferr" id={`err-${id}`}>{msg}</span> : null;
}

export function SellForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitListing, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const inv = (k: string) => ({ "aria-invalid": !!e[k], "aria-describedby": e[k] ? `err-${k}` : undefined, defaultValue: v[k] ?? "" });

  return (
    <form action={action} className="panel" noValidate key={state.attempt ?? 0}>
      <h2>Nieuwe aanbieding</h2>
      <div className="fields">
        <div className="field full">
          <label htmlFor="title">Korte omschrijving</label>
          <input id="title" name="title" type="text" maxLength={120} placeholder="Bijvoorbeeld: Planningstool voor schoonmaakbedrijven" {...inv("title")} />
          <Err msg={e.title} id="title" />
        </div>
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" {...inv("type")}>
            <option value="">Kies…</option>
            {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Err msg={e.type} id="type" />
        </div>
        <div className="field">
          <label htmlFor="country">Land</label>
          <select id="country" name="country" {...inv("country")}>
            <option value="">Kies…</option>
            <option value="BE">België</option>
            <option value="NL">Nederland</option>
          </select>
          <Err msg={e.country} id="country" />
        </div>
        <div className="field">
          <label htmlFor="founded_year">Gestart in (jaar) <span className="hint">(optioneel)</span></label>
          <input id="founded_year" name="founded_year" type="text" inputMode="numeric" placeholder="2021" {...inv("founded_year")} />
          <Err msg={e.founded_year} id="founded_year" />
        </div>
        <div className="field">
          <label htmlFor="asking_price">Vraagprijs (€)</label>
          <input id="asking_price" name="asking_price" type="text" inputMode="decimal" placeholder="150.000" {...inv("asking_price")} />
          <Err msg={e.asking_price} id="asking_price" />
        </div>
        <div className="field">
          <label htmlFor="revenue_12m">Omzet laatste 12 maanden (€)</label>
          <input id="revenue_12m" name="revenue_12m" type="text" inputMode="decimal" {...inv("revenue_12m")} />
          <Err msg={e.revenue_12m} id="revenue_12m" />
        </div>
        <div className="field">
          <label htmlFor="profit_12m">Nettowinst laatste 12 maanden (€)</label>
          <input id="profit_12m" name="profit_12m" type="text" inputMode="decimal" {...inv("profit_12m")} />
          <Err msg={e.profit_12m} id="profit_12m" />
        </div>
        <div className="field">
          <label htmlFor="customers">Betalende klanten <span className="hint">(optioneel)</span></label>
          <input id="customers" name="customers" type="text" inputMode="numeric" {...inv("customers")} />
          <Err msg={e.customers} id="customers" />
        </div>
        <div className="field">
          <label htmlFor="tech_stack">Technologie <span className="hint">(optioneel)</span></label>
          <input id="tech_stack" name="tech_stack" type="text" maxLength={200} placeholder="Laravel, MySQL, Azure" {...inv("tech_stack")} />
          <Err msg={e.tech_stack} id="tech_stack" />
        </div>
        <div className="field full">
          <label htmlFor="sale_reason">Waarom verkoop je? <span className="hint">(optioneel)</span></label>
          <input id="sale_reason" name="sale_reason" type="text" maxLength={300} {...inv("sale_reason")} />
          <Err msg={e.sale_reason} id="sale_reason" />
        </div>
        <div className="field full">
          <label htmlFor="description">Beschrijving</label>
          <textarea id="description" name="description" maxLength={4000}
            placeholder="Wat doet het product, voor wie, hoe komen klanten binnen, wat gaat mee bij de verkoop?" {...inv("description")} />
          <Err msg={e.description} id="description" />
        </div>
        <div className="field">
          <label htmlFor="contact_email">E-mailadres voor contact <span className="hint">(niet publiek)</span></label>
          <input id="contact_email" name="contact_email" type="email" autoComplete="email" {...inv("contact_email")} defaultValue={v.contact_email ?? defaultEmail} />
          <Err msg={e.contact_email} id="contact_email" />
        </div>
        <div className="field full" style={{ gap: 10 }}>
          <label className="check" htmlFor="consent_accuracy">
            <input id="consent_accuracy" name="consent_accuracy" type="checkbox" defaultChecked={v.consent_accuracy === "on"} />
            <span>De cijfers kloppen naar mijn beste weten en ik kan ze bij interesse onderbouwen.</span>
          </label>
          <Err msg={e.consent_accuracy} id="consent_accuracy" />
          <label className="check" htmlFor="consent_publish">
            <input id="consent_publish" name="consent_publish" type="checkbox" defaultChecked={v.consent_publish === "on"} />
            <span>Jullie mogen deze aanbieding na controle publiceren, zonder mijn naam en e-mailadres.</span>
          </label>
          <Err msg={e.consent_publish} id="consent_publish" />
        </div>
      </div>
      {state.message && <p className="msg err" role="alert">{state.message}</p>}
      <div><SubmitButton pendingText="Indienen…">Aanbieding indienen</SubmitButton></div>
    </form>
  );
}
