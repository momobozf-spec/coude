import type { Metadata } from "next";
import { Truck, RotateCcw, MapPin, PackageCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SHIPPING, fromCents } from "@/lib/money";
import { formatPrice } from "@/lib/utils";
import { ConceptNotice, legalEmail } from "@/components/legal/LegalEntityBlock";
import { shopPolicy } from "@/lib/legal";

// Bedragen komen uit dezelfde constanten als de checkout, zodat deze pagina
// nooit iets anders belooft dan er aangerekend wordt.
const euro = (cents: number) => formatPrice(fromCents(cents));

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Livraison & retour" : "Verzending & retour" };
}

const h2 = "text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8";
const a = "text-emerald underline";

export default async function ShippingReturnsPage({ params }: Props) {
  const { locale } = await params;
  const fr = locale === "fr";
  const email = legalEmail();
  const policy = shopPolicy();
  const days = policy.withdrawalDays;

  const badges = fr
    ? [
        { icon: Truck, title: "Livraison gratuite", desc: `Dès ${euro(SHIPPING.freeFromCents)} en BE & NL` },
        { icon: PackageCheck, title: "Express possible", desc: `${euro(SHIPPING.expressCents)} en BE & NL` },
        { icon: RotateCcw, title: `${days} jours de rétractation`, desc: "À compter de la réception" },
        { icon: MapPin, title: "Suivi du colis", desc: "Numéro de suivi par e-mail" },
      ]
    : [
        { icon: Truck, title: "Gratis verzending", desc: `Vanaf ${euro(SHIPPING.freeFromCents)} in BE & NL` },
        { icon: PackageCheck, title: "Express mogelijk", desc: `${euro(SHIPPING.expressCents)} in BE & NL` },
        { icon: RotateCcw, title: `${days} dagen bedenktijd`, desc: "Vanaf ontvangst" },
        { icon: MapPin, title: "Track & trace", desc: "Trackingnummer per e-mail" },
      ];

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">
        {fr ? "Livraison & retour" : "Verzending & retour"}
      </h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {badges.map((b) => (
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
        <ConceptNotice locale={locale} />
        {fr ? (
          <>
            <h2 className={h2}>Frais et délais de livraison</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Belgique et Pays-Bas :</strong> {euro(SHIPPING.standardCents)} en standard (3-5 jours ouvrables
                indicatifs) · gratuit dès {euro(SHIPPING.freeFromCents)}.
              </li>
              <li>
                <strong>Express (Belgique et Pays-Bas) :</strong> {euro(SHIPPING.expressCents)} (1-2 jours ouvrables
                indicatifs).
              </li>
            </ul>
            <p>
              Nous livrons uniquement en Belgique et aux Pays-Bas, au plus tard dans les {policy.maxDeliveryDays} jours.
              Dès que votre colis est en route, vous recevez un e-mail avec le numéro de suivi.
            </p>

            <h2 className={h2}>Droit de rétractation et retour</h2>
            <p>
              Vous disposez de {days} jours à compter de la réception pour vous rétracter sans motif. Informez-nous par
              e-mail à {email} avec votre numéro de commande (vous pouvez utiliser le{" "}
              <Link href="/withdrawal" className={a}>formulaire de rétractation</Link>), puis renvoyez les produits dans les{" "}
              {days} jours. Nous vous remboursons, frais de livraison standard compris, dans les {days} jours suivant
              votre rétractation ; nous pouvons attendre d&apos;avoir reçu les produits ou une preuve d&apos;envoi.
            </p>
            <p>
              <strong>Frais de retour :</strong>{" "}
              {policy.returnCostsPaidBy === "customer"
                ? "les frais directs de renvoi sont à votre charge."
                : "nous prenons en charge les frais directs de renvoi."}
            </p>
            <p>
              <strong>Exceptions :</strong> les produits scellés descellés après livraison pour des raisons d&apos;hygiène
              ou de santé (huile de parfum, encens ou soins ouverts) et les denrées périssables (comme les dattes) ne
              peuvent pas être retournés.
            </p>

            <h2 className={h2}>Produit endommagé ou erroné ?</h2>
            <p>
              Contactez-nous dès que possible via {email}. La garantie légale de deux ans pour les produits non conformes
              s&apos;applique toujours. Voir aussi nos <Link href="/terms" className={a}>conditions générales</Link>.
            </p>
          </>
        ) : (
          <>
            <h2 className={h2}>Verzendkosten &amp; levertijden</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>België en Nederland:</strong> {euro(SHIPPING.standardCents)} standaard (indicatief 3-5 werkdagen) ·
                gratis vanaf {euro(SHIPPING.freeFromCents)}.
              </li>
              <li>
                <strong>Express (België en Nederland):</strong> {euro(SHIPPING.expressCents)} (indicatief 1-2 werkdagen).
              </li>
            </ul>
            <p>
              We leveren alleen in België en Nederland, uiterlijk binnen {policy.maxDeliveryDays} dagen. Zodra je pakket
              onderweg is, ontvang je een e-mail met het trackingnummer.
            </p>

            <h2 className={h2}>Herroepingsrecht en retourneren</h2>
            <p>
              Je hebt {days} dagen vanaf ontvangst om je aankoop zonder opgave van reden te herroepen. Meld het via{" "}
              {email} met je bestelnummer (je mag het{" "}
              <Link href="/withdrawal" className={a}>modelformulier voor herroeping</Link> gebruiken) en stuur de producten
              binnen {days} dagen terug. We betalen je terug, inclusief de standaardverzendkosten, binnen {days} dagen na
              je melding; we mogen wachten tot we de producten of een verzendbewijs ontvangen hebben.
            </p>
            <p>
              <strong>Retourkosten:</strong>{" "}
              {policy.returnCostsPaidBy === "customer"
                ? "de rechtstreekse kosten van het terugzenden zijn voor jouw rekening."
                : "wij betalen de rechtstreekse kosten van het terugzenden."}
            </p>
            <p>
              <strong>Uitzonderingen:</strong> verzegelde producten waarvan de verzegeling na levering om hygiëne- of
              gezondheidsredenen verbroken is (geopende parfumolie, wierook of verzorgingsproducten) en bederfelijke
              producten (zoals dadels) kunnen niet retour.
            </p>

            <h2 className={h2}>Beschadigd of verkeerd ontvangen?</h2>
            <p>
              Neem zo snel mogelijk contact met ons op via {email}. Je wettelijke garantie van twee jaar op niet-conforme
              producten blijft altijd gelden. Zie ook onze <Link href="/terms" className={a}>algemene voorwaarden</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
