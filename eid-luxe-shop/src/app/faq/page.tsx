"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

const SECTIONS = [
  {
    id: "ordering",
    title: "Bestellen",
    items: [
      {
        q: "Hoe lang duurt het voor mijn bestelling vertrekt?",
        a: "We pakken elke bestelling zelf in, in onze studio in Antwerpen, binnen 24 uur. Tijdens de drukke Eid-periode kan dat oplopen tot 48 uur — barakallahu fik voor je geduld.",
      },
      {
        q: "Kan ik een persoonlijk kaartje toevoegen?",
        a: "Zeker. Bij het afrekenen vind je een veld waar je je boodschap kan schrijven. Wij schrijven die met de hand over op een Bayt Noor kaartje.",
      },
      {
        q: "Kan ik in grotere hoeveelheden bestellen voor een evenement of bedrijf?",
        a: "Met plezier. Schrijf ons via het contactformulier met je aantal en je gewenste datum. We bekijken het samen en geven je binnen 24 uur een eerlijke prijs.",
      },
    ],
  },
  {
    id: "shipping",
    title: "Verzending",
    items: [
      {
        q: "Versturen jullie wereldwijd?",
        a: "Ja, we versturen vanuit Antwerpen naar meer dan 35 landen. Binnen de EU 3-5 werkdagen, daarbuiten 5-10 werkdagen.",
      },
      {
        q: "Hoeveel kost de verzending?",
        a: "Standaard verzending wereldwijd is €7,95, gratis vanaf €100. Express binnen de EU is €14,95.",
      },
      {
        q: "Kan ik direct naar iemand anders versturen?",
        a: "Natuurlijk. Geef het adres van de ontvanger op en schrijf je boodschap in het kaartje-veld. Er staat geen prijs op het pakket.",
      },
    ],
  },
  {
    id: "tracking",
    title: "Bestelling volgen",
    items: [
      {
        q: "Hoe volg ik mijn bestelling?",
        a: "Zodra je pakket vertrekt, krijg je een tracking-link per e-mail. Je kan ook altijd inloggen op je account om de status te zien.",
      },
      {
        q: "Ik heb geen tracking ontvangen.",
        a: "Kijk eerst even in je spamfolder. Vind je het niet? Schrijf ons dan op hallo@baytnoor.com met je bestelnummer, dan zoeken we het direct uit.",
      },
    ],
  },
  {
    id: "returns",
    title: "Retour",
    items: [
      {
        q: "Wat is jullie retourbeleid?",
        a: "Je kan elk ongeopend en ongebruikt product binnen 14 dagen terugsturen voor een volledige terugbetaling. Voor klanten in de EU dragen wij de retourkosten.",
      },
      {
        q: "Kan ik dadels en huidverzorging terugsturen?",
        a: "Voedsel en huidverzorging waarvan de zegel verbroken is, kunnen we om hygiënische redenen niet terugnemen. Een ongeopend pakje wel.",
      },
      {
        q: "Hoe lang duurt een terugbetaling?",
        a: "Zodra we je retour ontvangen, betalen we binnen 3 werkdagen terug. Het kan 5-10 dagen duren voor het op je rekening verschijnt, afhankelijk van je bank.",
      },
    ],
  },
  {
    id: "products",
    title: "Onze producten",
    items: [
      {
        q: "Zijn jullie producten halal?",
        a: "Ja, alhamdulillah. Onze voeding, parfum en verzorging zijn halal — geen alcohol, geen dierlijke musk, geen haram ingrediënten.",
      },
      {
        q: "Waar komen jullie producten vandaan?",
        a: "We werken direct met telers in Madinah, ambachtslieden in Marrakech, en parfumeurs in Grasse. Geen tussenpersonen, geen onnodige schakels.",
      },
      {
        q: "Zijn jullie kaarsen vegan?",
        a: "Ja. We gebruiken 100% natuurlijke sojawas en katoenen wieken.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <>
      <section className="border-b border-cream-200 bg-cream-100">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-20">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
            Veelgestelde vragen
          </span>
          <h1 className="mt-3 font-display text-5xl leading-tight text-forest-800 sm:text-6xl">
            Wat je mag weten,
            <span className="italic text-warmbrown-600"> in het kort.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-warmbrown-600">
            Geen lange juridische taal. We schreven de antwoorden zoals we ze aan
            een vriend zouden geven. Vind je iets niet?{" "}
            <a href="/contact" className="text-olive-600 underline">
              Schrijf ons gerust
            </a>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 lg:px-6">
        {SECTIONS.map((sec) => (
          <div key={sec.id} id={sec.id} className="mb-10">
            <h2 className="font-display text-2xl text-forest-800">{sec.title}</h2>
            <div className="mt-5 grid gap-2">
              {sec.items.map((it) => (
                <FAQItem key={it.q} q={it.q} a={it.a} />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-16 rounded-2xl bg-olive-700 p-10 text-center text-cream-50">
          <h3 className="font-display text-3xl">Vond je je antwoord niet?</h3>
          <p className="mx-auto mt-3 max-w-md text-sm text-cream-200/85">
            Schrijf ons gerust. Wij &mdash; de twee oprichters &mdash; lezen het
            zelf, en antwoorden meestal binnen een paar uur.
          </p>
          <LinkButton
            href="/contact"
            variant="secondary"
            className="mt-6"
          >
            Schrijf ons
          </LinkButton>
        </div>
      </section>
    </>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-medium text-forest-800">{q}</span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-warmbrown-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-cream-200 px-5 py-4 text-sm leading-relaxed text-warmbrown-600 animate-fade-in">
          {a}
        </div>
      )}
    </div>
  );
}
