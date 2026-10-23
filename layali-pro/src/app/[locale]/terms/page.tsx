import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import LegalEntityBlock, { legalEmail } from "@/components/legal/LegalEntityBlock";

export const metadata: Metadata = { title: "Algemene Voorwaarden" };
export const dynamic = "force-dynamic";

const h2 = "text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8";

export default function TermsPage() {
  const email = legalEmail();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Algemene Voorwaarden</h1>
      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>Laatst bijgewerkt: oktober 2026</p>

        <h2 className={h2}>1. Verkoper</h2>
        <LegalEntityBlock />

        <h2 className={h2}>2. Toepasselijkheid</h2>
        <p>Deze voorwaarden gelden voor elke bestelling via deze webshop door een consument.</p>

        <h2 className={h2}>3. Prijzen</h2>
        <p>
          Alle prijzen zijn in euro en inclusief btw. Verzendkosten worden vóór de betaling apart getoond en staan op de
          pagina <Link href="/shipping-returns" className="text-emerald underline">verzending &amp; retour</Link>.
        </p>

        <h2 className={h2}>4. Bestelling en overeenkomst</h2>
        <p>
          De overeenkomst komt tot stand zodra je betaling bevestigd is. Je ontvangt dan een bevestiging per e-mail met je
          bestelnummer. Is een product na je betaling toch niet meer leverbaar, dan laten we het je meteen weten en betalen
          we het bedrag binnen 14 dagen terug.
        </p>

        <h2 className={h2}>5. Betaling</h2>
        <p>Betalingen verlopen via Mollie. De beschikbare betaalmethodes zie je bij het afrekenen.</p>

        <h2 className={h2}>6. Levering</h2>
        <p>
          We leveren in België en Nederland. De vermelde levertermijnen zijn indicatief; we leveren in elk geval binnen 30
          dagen, tenzij anders afgesproken.
        </p>

        <h2 className={h2}>7. Herroepingsrecht</h2>
        <p>
          Je mag je aankoop binnen 14 dagen na ontvangst zonder opgave van reden herroepen. Laat het ons weten via {email}
          met je bestelnummer; daarna heb je 14 dagen om de producten terug te sturen. We betalen het aankoopbedrag,
          inclusief de standaardverzendkosten, terug binnen 14 dagen na je melding, maar mogen wachten tot we de producten
          terug ontvangen hebben.
        </p>
        <p>
          Uitgezonderd zijn verzegelde producten die om hygiënische redenen niet teruggestuurd kunnen worden zodra de
          verzegeling verbroken is (zoals geopende parfumolie of verzorgingsproducten) en bederfelijke producten.
        </p>

        <h2 className={h2}>8. Garantie</h2>
        <p>
          Op alle producten geldt de wettelijke garantie van twee jaar voor gebreken die bestonden bij de levering.
          Handgemaakte producten kunnen kleine afwijkingen in kleur, vorm en patroon hebben; dat is eigen aan het ambacht en
          geen gebrek.
        </p>

        <h2 className={h2}>9. Klachten en geschillen</h2>
        <p>
          Klachten kun je melden via {email}. Lukt het niet om er samen uit te komen, dan kun je terecht bij de
          Consumentenombudsdienst (www.consumentenombudsdienst.be). Op deze voorwaarden is het Belgisch recht van
          toepassing, onverminderd de dwingende bescherming die je als consument geniet in je eigen land.
        </p>
      </div>
    </div>
  );
}
