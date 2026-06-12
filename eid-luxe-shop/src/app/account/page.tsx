"use client";

import { useState } from "react";
import { Heart, Lock, Mail, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AccountPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 lg:grid-cols-2 lg:px-6 lg:py-20">
      {/* Form card */}
      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-8">
        <div className="mb-6 flex gap-2 rounded-full bg-cream-100 p-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-olive-600 text-cream-50" : "text-forest-700"
            }`}
          >
            Inloggen
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              mode === "register" ? "bg-olive-600 text-cream-50" : "text-forest-700"
            }`}
          >
            Account aanmaken
          </button>
        </div>

        <h1 className="font-display text-3xl text-forest-800">
          {mode === "login" ? "Welkom terug." : "Welkom bij Bayt Noor."}
        </h1>
        <p className="mt-2 text-sm text-warmbrown-600">
          {mode === "login"
            ? "Log in om je bestellingen, favorieten en adressen rustig te beheren."
            : "Maak een account aan om je voorkeuren te bewaren en je bestellingen te volgen."}
        </p>

        <form className="mt-6 grid gap-4" onSubmit={(e) => e.preventDefault()}>
          {mode === "register" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Voornaam" />
              <Input label="Achternaam" />
            </div>
          )}
          <Input label="E-mailadres" type="email" icon={<Mail size={14} strokeWidth={1.6} />} />
          <Input label="Wachtwoord" type="password" icon={<Lock size={14} strokeWidth={1.6} />} />
          {mode === "login" && (
            <a href="#" className="text-right text-xs text-warmbrown-500 hover:text-olive-600">
              Wachtwoord vergeten?
            </a>
          )}
          <Button type="submit" variant="primary" fullWidth size="md">
            {mode === "login" ? "Inloggen" : "Account aanmaken"}
          </Button>
          <p className="text-center text-[11px] uppercase tracking-[0.18em] text-warmbrown-500">
            Dit is een demo · er wordt geen account gemaakt
          </p>
        </form>
      </div>

      {/* Side panel */}
      <aside className="grid gap-3">
        <Perk
          icon={<Package size={18} strokeWidth={1.6} />}
          title="Volg elke bestelling"
          desc="Zie waar je pakket is, en bestel snel iets opnieuw als je het wenst."
        />
        <Perk
          icon={<Heart size={18} strokeWidth={1.6} />}
          title="Bewaar wat je leuk vindt"
          desc="Een rustige plek om producten op te slaan voor later."
        />
        <Perk
          icon={<Mail size={18} strokeWidth={1.6} />}
          title="Een woord wanneer er iets is"
          desc="Geen reclamebombardement. Enkel als er iets nieuws is dat de moeite is."
        />
      </aside>
    </section>
  );
}

function Input({
  label,
  type = "text",
  icon,
}: {
  label: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-warmbrown-600">
        {label}
      </span>
      <div className="relative mt-1.5">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-warmbrown-400">
            {icon}
          </span>
        )}
        <input
          type={type}
          className={`block w-full rounded-xl border border-cream-300 bg-cream-50 py-2.5 pr-4 text-sm text-forest-800 focus:border-olive-400 focus:outline-none focus:ring-2 focus:ring-olive-100 ${
            icon ? "pl-10" : "pl-4"
          }`}
        />
      </div>
    </label>
  );
}

function Perk({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-cream-200 bg-cream-50 p-5">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-cream-200 text-olive-600">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-base leading-tight text-forest-800">{title}</h3>
        <p className="mt-1 text-sm text-warmbrown-600">{desc}</p>
      </div>
    </div>
  );
}
