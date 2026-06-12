"use client";

import { useState, type FormEvent } from "react";
import { Mail, MessageCircle, MapPin, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ContactPage() {
  const [done, setDone] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setDone(true);
  };

  return (
    <>
      <section className="border-b border-cream-200 bg-cream-100">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            Contact
          </span>
          <h1 className="mt-3 font-display text-5xl leading-tight text-forest-800 sm:text-6xl">
            Schrijf ons gerust.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-warmbrown-600">
            Een vraag, een gedachte, een speciale wens? Wij &mdash; de twee
            oprichters &mdash; lezen elke boodschap zelf, en antwoorden meestal
            binnen een paar uur.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
          {/* Form */}
          <div className="rounded-2xl border border-cream-200 bg-cream-50 p-8">
            <h2 className="font-display text-2xl text-forest-800">
              Stuur ons een bericht
            </h2>
            <p className="mt-2 text-sm text-warmbrown-600">
              Geen formele uitwisseling &mdash; gewoon een gesprek.
            </p>
            {done ? (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-olive-200 bg-cream-50 p-5 text-sm text-forest-700">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-olive-600 text-cream-50">
                  <Check size={16} />
                </span>
                <div>
                  <p className="font-medium text-forest-800">Bedankt &mdash; je bericht is binnen.</p>
                  <p className="mt-0.5">We antwoorden zo snel als we kunnen, in shaa Allah.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Je naam" required />
                  <Input label="Je e-mail" type="email" required />
                </div>
                <Input label="Onderwerp" required />
                <Textarea label="Wat wil je ons zeggen?" required />
                <Button type="submit" variant="primary" className="mt-2 self-start">
                  Verstuur
                </Button>
              </form>
            )}
          </div>

          {/* Info */}
          <aside className="grid gap-3">
            <Info
              icon={<Mail size={18} strokeWidth={1.6} />}
              title="E-mail"
              value="hallo@baytnoor.com"
              meta="Wij antwoorden zelf"
            />
            <Info
              icon={<MessageCircle size={18} strokeWidth={1.6} />}
              title="Persoonlijk gesprek"
              value="Ma–Za · 09:00–19:00"
              meta="In NL, EN of FR"
            />
            <Info
              icon={<MapPin size={18} strokeWidth={1.6} />}
              title="Onze studio"
              value="Antwerpen, België"
              meta="Bezoek mogelijk op afspraak"
            />
            <Info
              icon={<Clock size={18} strokeWidth={1.6} />}
              title="Antwoordtijd"
              value="Doorgaans binnen een paar uur"
              meta="Buiten Eid-piek"
            />
          </aside>
        </div>
      </section>
    </>
  );
}

function Input({
  label,
  type = "text",
  required,
}: {
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-warmbrown-600">
        {label}
        {required && <span className="text-warmbrown-400"> *</span>}
      </span>
      <input
        type={type}
        required={required}
        className="mt-1.5 block w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-forest-800 focus:border-olive-400 focus:outline-none focus:ring-2 focus:ring-olive-100"
      />
    </label>
  );
}

function Textarea({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-warmbrown-600">
        {label}
        {required && <span className="text-warmbrown-400"> *</span>}
      </span>
      <textarea
        required={required}
        rows={6}
        className="mt-1.5 block w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-forest-800 focus:border-olive-400 focus:outline-none focus:ring-2 focus:ring-olive-100"
      />
    </label>
  );
}

function Info({
  icon,
  title,
  value,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-cream-200 bg-cream-50 p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cream-200 text-olive-600">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-warmbrown-500">
          {title}
        </p>
        <p className="mt-0.5 text-sm font-medium text-forest-800">{value}</p>
        <p className="text-xs text-warmbrown-500">{meta}</p>
      </div>
    </div>
  );
}
