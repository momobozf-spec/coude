import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import LegalEntityBlock, { ConceptNotice, legalEmail } from "@/components/legal/LegalEntityBlock";
import { shopPolicy } from "@/lib/legal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Conditions générales" : "Algemene voorwaarden" };
}

const h2 = "text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8";
const a = "text-emerald underline";

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const email = legalEmail();
  const policy = shopPolicy();
  const fr = locale === "fr";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">
        {fr ? "Conditions générales de vente" : "Algemene verkoopvoorwaarden"}
      </h1>
      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <ConceptNotice locale={locale} />
        {fr ? (
          <>
            <p>Dernière mise à jour : octobre 2026</p>

            <h2 className={h2}>1. Vendeur</h2>
            <LegalEntityBlock locale="fr" />

            <h2 className={h2}>2. Champ d&apos;application</h2>
            <p>
              Les présentes conditions s&apos;appliquent à toute commande passée par un consommateur sur cette boutique en
              ligne. En passant commande, vous acceptez ces conditions. Elles sont disponibles à tout moment sur cette page
              et peuvent être enregistrées ou imprimées.
            </p>

            <h2 className={h2}>3. Offre et prix</h2>
            <p>
              Les prix sont en euros, TVA comprise. Les frais de livraison sont indiqués séparément avant le paiement et sur
              la page <Link href="/shipping-returns" className={a}>livraison &amp; retour</Link>. Les photos et descriptions
              sont aussi fidèles que possible ; de légères différences de couleur ou de texture ne constituent pas un défaut.
            </p>

            <h2 className={h2}>4. Commande et conclusion du contrat</h2>
            <p>
              Vous vérifiez votre panier, vos coordonnées et le mode de livraison avant de cliquer sur « Commander avec
              obligation de paiement ». Le contrat est conclu dès que votre paiement est confirmé ; vous recevez alors une
              confirmation par e-mail avec votre numéro de commande. Si un produit n&apos;est finalement plus disponible
              après votre paiement, nous vous en informons immédiatement et vous remboursons dans les 14 jours.
            </p>

            <h2 className={h2}>5. Paiement</h2>
            <p>
              Les paiements sont traités par Mollie B.V. Les moyens de paiement disponibles sont affichés lors du paiement.
              Nous ne recevons jamais vos données de carte ou bancaires.
            </p>

            <h2 className={h2}>6. Livraison</h2>
            <p>
              Nous livrons en Belgique et aux Pays-Bas. Les délais indiqués sont indicatifs ; sauf accord contraire, nous
              livrons au plus tard dans les {policy.maxDeliveryDays} jours suivant la conclusion du contrat. À défaut,
              vous pouvez annuler la commande et êtes remboursé sans délai. Le risque de perte ou d&apos;endommagement
              vous est transféré au moment où vous (ou un tiers désigné par vous, autre que le transporteur) prenez
              possession du colis.
            </p>

            <h2 className={h2}>7. Droit de rétractation</h2>
            <p>
              Vous pouvez vous rétracter sans motif dans un délai de {policy.withdrawalDays} jours à compter du jour où
              vous (ou un tiers désigné par vous) prenez possession du produit. Pour une commande livrée en plusieurs
              colis, le délai court à partir de la réception du dernier colis.
            </p>
            <p>
              Vous pouvez vous rétracter directement en ligne via{" "}
              <Link href="/withdrawal" className={a}>Se rétracter du contrat ici</Link> ; vous recevez aussitôt un
              accusé de réception par e-mail. Vous pouvez aussi nous informer par toute autre déclaration dénuée
              d&apos;ambiguïté (par exemple par e-mail à {email}, éventuellement avec le formulaire type sur la même
              page) en mentionnant votre numéro de commande.
              Renvoyez ensuite les produits au plus tard {policy.withdrawalDays} jours après nous avoir informé.
            </p>
            <p>
              Nous remboursons tous les paiements reçus, y compris les frais de livraison standard, au plus tard{" "}
              {policy.withdrawalDays} jours après réception de votre rétractation, avec le même moyen de paiement. Nous
              pouvons différer le remboursement jusqu&apos;à réception des produits ou jusqu&apos;à ce que vous ayez
              fourni une preuve d&apos;expédition. Si vous avez choisi une livraison express, le supplément par rapport à la
              livraison standard n&apos;est pas remboursé.
            </p>
            <p>
              {policy.returnCostsPaidBy === "customer"
                ? "Les frais directs de renvoi des produits sont à votre charge."
                : "Nous prenons en charge les frais directs de renvoi des produits."}{" "}
              Vous êtes responsable de la dépréciation des produits résultant de manipulations autres que celles
              nécessaires pour établir leur nature, leurs caractéristiques et leur bon fonctionnement.
            </p>
            <p>
              <strong>Exceptions :</strong> le droit de rétractation ne s&apos;applique pas aux produits scellés qui ne
              peuvent être renvoyés pour des raisons de protection de la santé ou d&apos;hygiène et qui ont été descellés
              après la livraison (par exemple huile de parfum ou soins ouverts), ni aux produits susceptibles de se
              détériorer ou de se périmer rapidement.
            </p>

            <h2 className={h2}>8. Conformité et garantie légale</h2>
            <p>
              Tous les produits bénéficient de la garantie légale de conformité de deux ans à compter de la livraison
              (articles 1649bis à 1649octies du Code civil). Signalez un défaut le plus rapidement possible, et au plus
              tard dans les deux mois après l&apos;avoir constaté, via {email}.
            </p>

            <h2 className={h2}>9. Sécurité des produits</h2>
            <p>
              Lisez les avertissements et informations de sécurité sur la page produit et sur l&apos;étiquette avant
              utilisation, en particulier pour les bougies, l&apos;encens et les parfums d&apos;intérieur (ne jamais laisser
              une bougie allumée sans surveillance, tenir hors de portée des enfants et des animaux).
            </p>

            <h2 className={h2}>10. Responsabilité</h2>
            <p>
              Notre responsabilité est limitée au montant de la commande concernée, sauf en cas de faute intentionnelle ou
              grave, de dommage corporel ou lorsque la loi l&apos;interdit. Les droits impératifs du consommateur
              restent intacts.
            </p>

            <h2 className={h2}>11. Vie privée</h2>
            <p>
              Nous traitons vos données conformément à notre{" "}
              <Link href="/privacy" className={a}>politique de confidentialité</Link>.
            </p>

            <h2 className={h2}>12. Réclamations et litiges</h2>
            <p>
              Adressez vos réclamations à {email} ; nous répondons dans les meilleurs délais. Si nous ne trouvons pas de
              solution ensemble, vous pouvez vous adresser au Service de Médiation pour le Consommateur
              (www.mediationconsommateur.be). Le droit belge est applicable, sans préjudice de la protection impérative
              dont vous bénéficiez en vertu du droit de votre pays de résidence.
            </p>
          </>
        ) : (
          <>
            <p>Laatst bijgewerkt: oktober 2026</p>

            <h2 className={h2}>1. Verkoper</h2>
            <LegalEntityBlock locale="nl" />

            <h2 className={h2}>2. Toepasselijkheid</h2>
            <p>
              Deze voorwaarden gelden voor elke bestelling die een consument via deze webshop plaatst. Door te bestellen
              aanvaard je deze voorwaarden. Ze staan altijd op deze pagina en je kunt ze opslaan of afdrukken.
            </p>

            <h2 className={h2}>3. Aanbod en prijzen</h2>
            <p>
              Alle prijzen zijn in euro en inclusief btw. Verzendkosten worden vóór de betaling apart getoond en staan op de
              pagina <Link href="/shipping-returns" className={a}>verzending &amp; retour</Link>. Foto&apos;s en
              beschrijvingen zijn zo getrouw mogelijk; kleine verschillen in kleur of structuur zijn geen gebrek.
            </p>

            <h2 className={h2}>4. Bestelling en totstandkoming van de overeenkomst</h2>
            <p>
              Je controleert je winkelmandje, gegevens en verzendwijze voordat je op &quot;Bestellen met
              betalingsverplichting&quot; klikt. De overeenkomst komt tot stand zodra je betaling bevestigd is. Je
              ontvangt dan een bevestiging per e-mail met je bestelnummer. Is een product na je betaling toch niet meer
              leverbaar, dan laten we het je meteen weten en betalen we het bedrag binnen 14 dagen terug.
            </p>

            <h2 className={h2}>5. Betaling</h2>
            <p>
              Betalingen verlopen via Mollie B.V. De beschikbare betaalmethodes zie je bij het afrekenen. Wij krijgen je
              kaart- of bankgegevens nooit te zien.
            </p>

            <h2 className={h2}>6. Levering</h2>
            <p>
              We leveren in België en Nederland. De vermelde levertermijnen zijn indicatief; tenzij anders afgesproken
              leveren we uiterlijk {policy.maxDeliveryDays} dagen na het sluiten van de overeenkomst. Lukt dat niet, dan
              mag je de bestelling annuleren en betalen we je onmiddellijk terug. Het risico van verlies of beschadiging
              gaat op jou over zodra jij (of een door jou aangewezen derde, niet de vervoerder) het pakket in ontvangst
              neemt.
            </p>

            <h2 className={h2}>7. Herroepingsrecht</h2>
            <p>
              Je mag de overeenkomst zonder opgave van redenen herroepen binnen {policy.withdrawalDays} dagen na de dag
              waarop jij (of een door jou aangewezen derde) het product in ontvangst neemt. Bij een bestelling in
              meerdere pakketten loopt de termijn vanaf de ontvangst van het laatste pakket.
            </p>
            <p>
              Herroepen kan rechtstreeks online via{" "}
              <Link href="/withdrawal" className={a}>Hier de overeenkomst herroepen</Link>; je krijgt meteen een
              ontvangstbevestiging per e-mail. Je mag het ons ook op een andere ondubbelzinnige manier laten weten (bv.
              per e-mail naar {email}, eventueel met het modelformulier op dezelfde pagina) met je bestelnummer. Stuur de producten daarna uiterlijk {policy.withdrawalDays} dagen na je melding terug.
            </p>
            <p>
              We betalen alle ontvangen betalingen, inclusief de standaardverzendkosten, terug uiterlijk{" "}
              {policy.withdrawalDays} dagen nadat we je herroeping ontvangen hebben, met hetzelfde betaalmiddel. We mogen
              wachten met terugbetalen tot we de producten terug ontvangen hebben of tot je aantoont dat je ze
              teruggestuurd hebt. Koos je voor expreslevering, dan betalen we de meerprijs ten opzichte van de
              standaardlevering niet terug.
            </p>
            <p>
              {policy.returnCostsPaidBy === "customer"
                ? "De rechtstreekse kosten van het terugzenden zijn voor jouw rekening."
                : "Wij betalen de rechtstreekse kosten van het terugzenden."}{" "}
              Je bent aansprakelijk voor waardevermindering van de producten die het gevolg is van een behandeling die
              verder gaat dan nodig om de aard, de kenmerken en de werking ervan vast te stellen.
            </p>
            <p>
              <strong>Uitzonderingen:</strong> het herroepingsrecht geldt niet voor verzegelde producten die om redenen
              van gezondheidsbescherming of hygiëne niet teruggestuurd kunnen worden en waarvan de verzegeling na de
              levering verbroken is (zoals geopende parfumolie of verzorgingsproducten), en niet voor producten die snel
              bederven of verouderen.
            </p>

            <h2 className={h2}>8. Conformiteit en wettelijke garantie</h2>
            <p>
              Op alle producten geldt de wettelijke conformiteitsgarantie van twee jaar vanaf de levering (artikelen
              1649bis tot 1649octies van het oud Burgerlijk Wetboek). Meld een gebrek zo snel mogelijk en uiterlijk twee
              maanden nadat je het vastgesteld hebt, via {email}.
            </p>

            <h2 className={h2}>9. Productveiligheid</h2>
            <p>
              Lees vóór gebruik de waarschuwingen en veiligheidsinformatie op de productpagina en op het etiket, zeker bij
              kaarsen, wierook en huisparfum (laat een brandende kaars nooit onbewaakt achter, houd buiten bereik van
              kinderen en huisdieren).
            </p>

            <h2 className={h2}>10. Aansprakelijkheid</h2>
            <p>
              Onze aansprakelijkheid is beperkt tot het bedrag van de betrokken bestelling, behalve bij opzet of zware
              fout, bij lichamelijke schade of waar de wet zo&apos;n beperking niet toelaat. Je dwingende rechten als
              consument blijven altijd gelden.
            </p>

            <h2 className={h2}>11. Privacy</h2>
            <p>
              We verwerken je gegevens volgens ons <Link href="/privacy" className={a}>privacybeleid</Link>.
            </p>

            <h2 className={h2}>12. Klachten en geschillen</h2>
            <p>
              Klachten kun je melden via {email}; we antwoorden zo snel mogelijk. Lukt het niet om er samen uit te komen,
              dan kun je terecht bij de Consumentenombudsdienst (www.consumentenombudsdienst.be). Het Belgisch recht is van
              toepassing, onverminderd de dwingende bescherming die je als consument geniet in het land waar je woont.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
