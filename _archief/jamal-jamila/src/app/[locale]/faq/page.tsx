"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const faqItems = [
  {
    q: "Hoe lang duurt de verzending?",
    a: "Standaard verzending naar België en Nederland duurt 3-5 werkdagen. Express verzending duurt 1-2 werkdagen. Bestellingen boven €75 worden gratis verzonden.",
  },
  {
    q: "Kan ik mijn bestelling retourneren?",
    a: "Ja, je hebt 14 dagen bedenktijd. Producten moeten ongebruikt en in de originele verpakking zijn. Geopende geuren, parfumolie en voedingswaren zijn om hygiënische redenen uitgesloten. Neem contact op voor een retourlabel.",
  },
  {
    q: "Zijn de producten handgemaakt?",
    a: "Veel van onze producten — zoals de theeglazen, lantaarns en keramieken schaaltjes — zijn met de hand gemaakt. Kleine verschillen in kleur, vorm of patroon zijn daardoor uniek en horen bij het ambacht.",
  },
  {
    q: "Hoe houd ik mijn theeglazen en messing het mooist?",
    a: "Theeglazen zijn meestal vaatwasbestendig (zie productpagina). Messing en koper poets je af en toe met een zachte doek; gebruik geen schuurmiddelen. Zo blijft de warme glans behouden.",
  },
  {
    q: "Welke betaalmethoden accepteren jullie?",
    a: "We accepteren Bancontact (België), iDEAL (Nederland), creditcard en meer. Alle betalingen worden veilig verwerkt via Mollie.",
  },
  {
    q: "Kan ik mijn bestelling volgen?",
    a: "Ja, zodra je bestelling is verzonden ontvang je een e-mail met trackinginformatie. Je kunt de status ook bekijken in je account onder 'Bestellingen'.",
  },
  {
    q: "Bieden jullie cadeauverpakking aan?",
    a: "Onze sfeerboxen en cadeaupakketten komen al sfeervol verpakt. Voor losse producten kun je bij het afrekenen kiezen voor een cadeauverpakking.",
  },
  {
    q: "Hoe neem ik contact op?",
    a: "Je kunt ons bereiken via het contactformulier op onze website of stuur een e-mail naar hello@layali.shop. We reageren binnen 24 uur.",
  },
];

export default function FAQPage() {
  const t = useTranslations("common");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)]">{t("faq")}</h1>
        <p className="mt-3 text-muted-foreground">Antwoorden op veelgestelde vragen</p>
      </div>

      <div className="space-y-3">
        {faqItems.map((item, i) => (
          <div key={i} className="rounded-2xl border border-border bg-white overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-6 text-left cursor-pointer"
            >
              <span className="font-medium text-sm pr-4">{item.q}</span>
              <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", openIndex === i && "rotate-180")} />
            </button>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">{item.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
