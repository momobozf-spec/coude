import type { Metadata } from "next";
import { Truck, RotateCcw, MapPin, PackageCheck } from "lucide-react";
import { SHIPPING, fromCents } from "@/lib/money";
import { formatPrice } from "@/lib/utils";
import { legalEmail } from "@/components/legal/LegalEntityBlock";

// Bedragen komen uit dezelfde constanten als de checkout, zodat deze pagina
// nooit iets anders belooft dan er aangerekend wordt.
const euro = (cents: number) => formatPrice(fromCents(cents));

export const metadata: Metadata = { title: "Verzending & Retour" };

export const dynamic = "force-dynamic";

export default function ShippingReturnsPage() {
  const email = legalEmail();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Verzending &amp; Retour</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {[
          { icon: Truck, title: "Gratis verzending", desc: `Vanaf ${euro(SHIPPING.freeFromCents)} in BE & NL` },
          { icon: PackageCheck, title: "Express mogelijk", desc: `${euro(SHIPPING.expressCents)} in BE & NL` },
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
          <li><strong>België en Nederland:</strong> {euro(SHIPPING.standardCents)} standaard · gratis vanaf {euro(SHIPPING.freeFromCents)}.</li>
          <li><strong>Express (België en Nederland):</strong> {euro(SHIPPING.expressCents)}.</li>
        </ul>
        <p>We leveren alleen in België en Nederland. Zodra je pakket onderweg is, ontvang je een e-mail met het trackingnummer.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Retourneren</h2>
        <p>Niet helemaal tevreden? Je hebt 14 dagen bedenktijd vanaf ontvangst. Producten dienen ongebruikt en in de originele verpakking te zijn. Meld je retour via {email} met je bestelnummer; wij sturen je de retourinstructies.</p>
        <p><strong>Uitzonderingen:</strong> om hygiënische redenen kunnen geopende geuren, parfumolie, wierook, verzorgingsproducten en voedingswaren (zoals dadels) niet retour.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Beschadigd of verkeerd ontvangen?</h2>
        <p>Is er iets mis met je bestelling? Neem zo snel mogelijk contact met ons op via {email}; we lossen het graag voor je op. Je wettelijke garantie van twee jaar op niet-conforme producten blijft altijd gelden.</p>
      </div>
    </div>
  );
}
