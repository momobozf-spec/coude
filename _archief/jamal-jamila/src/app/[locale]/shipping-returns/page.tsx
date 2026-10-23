import type { Metadata } from "next";
import { Truck, RotateCcw, MapPin, PackageCheck } from "lucide-react";

export const metadata: Metadata = { title: "Verzending & Retour" };

export default function ShippingReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Verzending &amp; Retour</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {[
          { icon: Truck, title: "Gratis verzending", desc: "Vanaf €75 in BE & NL" },
          { icon: PackageCheck, title: "Snelle levering", desc: "3-5 werkdagen standaard" },
          { icon: RotateCcw, title: "14 dagen retour", desc: "Niet tevreden? Stuur retour" },
          { icon: MapPin, title: "Track & trace", desc: "Volg je pakket online" },
        ].map((b) => (
          <div key={b.title} className="flex items-center gap-3 rounded-2xl border border-border p-4 bg-white">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage/30">
              <b.icon className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)]">Verzendkosten &amp; levertijden</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>België:</strong> €4,95 standaard · gratis vanaf €75 · levering 2-4 werkdagen.</li>
          <li><strong>Nederland:</strong> €5,95 standaard · gratis vanaf €75 · levering 3-5 werkdagen.</li>
          <li><strong>Frankrijk:</strong> €9,95 · levering 4-7 werkdagen.</li>
          <li><strong>Express (BE/NL):</strong> €9,95 · levering 1-2 werkdagen.</li>
        </ul>
        <p>Bestellingen worden verzonden via Bpost (BE) en PostNL (NL). Zodra je pakket onderweg is, ontvang je een e-mail met trackingnummer.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Retourneren</h2>
        <p>Niet helemaal tevreden? Je hebt 14 dagen bedenktijd vanaf ontvangst. Producten dienen ongebruikt en in de originele verpakking te zijn. Meld je retour via hello@layali.shop met je bestelnummer; wij sturen je de retourinstructies.</p>
        <p><strong>Uitzonderingen:</strong> om hygiënische redenen kunnen geopende geuren, parfumolie, wierook, verzorgingsproducten en voedingswaren (zoals dadels) niet retour.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Beschadigd of verkeerd ontvangen?</h2>
        <p>Mocht er iets mis zijn met je bestelling, neem dan binnen 48 uur contact met ons op via hello@layali.shop. We lossen het graag snel voor je op.</p>
      </div>
    </div>
  );
}
