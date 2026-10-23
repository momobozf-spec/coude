import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import LegalEntityBlock, { ConceptNotice, legalEmail } from "@/components/legal/LegalEntityBlock";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Politique de confidentialité" : "Privacybeleid" };
}

const h2 = "text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8";
const a = "text-emerald underline";

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const email = legalEmail();
  const fr = locale === "fr";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">
        {fr ? "Politique de confidentialité" : "Privacybeleid"}
      </h1>

      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <ConceptNotice locale={locale} />
        {fr ? (
          <>
            <p>Dernière mise à jour : octobre 2026</p>

            <h2 className={h2}>1. Responsable du traitement</h2>
            <LegalEntityBlock locale="fr" />

            <h2 className={h2}>2. Quelles données et pourquoi ?</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Commandes</strong> — nom, e-mail, téléphone (facultatif), adresse de livraison et produits commandés.
                Nécessaires pour exécuter votre commande (exécution du contrat) et pour notre comptabilité (obligation
                légale).
              </li>
              <li>
                <strong>Compte</strong> — nom, e-mail et mot de passe chiffré (ou votre identifiant Google si vous vous
                connectez avec Google), pour suivre vos commandes et votre liste de souhaits (exécution du contrat).
              </li>
              <li>
                <strong>Contact</strong> — les données que vous saisissez dans le formulaire de contact, pour répondre à
                votre question (intérêt légitime).
              </li>
              <li>
                <strong>Newsletter</strong> — votre e-mail et votre langue, uniquement si vous vous inscrivez
                (consentement). Désinscription à tout moment via {email}.
              </li>
              <li>
                <strong>Avis</strong> — votre nom et votre avis, si vous en publiez un (consentement).
              </li>
              <li>
                <strong>Sécurité</strong> — adresse IP et journaux techniques, brièvement, pour protéger le site contre les
                abus (intérêt légitime).
              </li>
              <li>
                <strong>Mesure d&apos;audience et marketing</strong> — uniquement après votre consentement dans la bannière
                cookies (voir la <Link href="/cookies" className={a}>politique de cookies</Link>).
              </li>
            </ul>

            <h2 className={h2}>3. Durée de conservation</h2>
            <p>
              Commandes et factures : sept ans (obligation comptable). Compte : jusqu&apos;à ce que vous demandiez sa
              suppression. Newsletter : jusqu&apos;à votre désinscription. Messages de contact : jusqu&apos;à un an après
              le traitement de votre question.
            </p>

            <h2 className={h2}>4. Destinataires</h2>
            <p>
              Uniquement les sous-traitants nécessaires au service : Mollie (paiements), Resend (e-mails transactionnels),
              notre hébergeur et notre fournisseur de base de données (serveurs dans l&apos;UE) et le transporteur qui
              livre votre colis. Si un prestataire traite des données hors de l&apos;Espace économique européen, ce
              transfert repose sur une décision d&apos;adéquation ou sur les clauses contractuelles types de la Commission
              européenne. Nous ne vendons jamais vos données.
            </p>

            <h2 className={h2}>5. Vos droits</h2>
            <p>
              Vous avez le droit d&apos;accéder à vos données, de les faire rectifier ou effacer, d&apos;en limiter le
              traitement, de vous y opposer, de recevoir vos données (portabilité) et de retirer votre consentement à tout
              moment. Écrivez à {email} ; nous répondons dans un délai d&apos;un mois. Vous pouvez introduire une plainte
              auprès de l&apos;Autorité de protection des données (www.autoriteprotectiondonnees.be).
            </p>

            <h2 className={h2}>6. Sécurité</h2>
            <p>
              Les mots de passe sont stockés chiffrés (bcrypt), toutes les connexions passent par https et seuls les
              administrateurs ont accès aux commandes.
            </p>
          </>
        ) : (
          <>
            <p>Laatst bijgewerkt: oktober 2026</p>

            <h2 className={h2}>1. Wie is verantwoordelijk?</h2>
            <LegalEntityBlock locale="nl" />

            <h2 className={h2}>2. Welke gegevens en waarvoor?</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Bestellingen</strong> — naam, e-mailadres, telefoonnummer (optioneel), verzendadres en de producten
                die je bestelt. Nodig om je bestelling uit te voeren (uitvoering van de overeenkomst) en voor onze
                boekhouding (wettelijke verplichting).
              </li>
              <li>
                <strong>Account</strong> — naam, e-mailadres en een versleuteld wachtwoord (of je Google-ID als je met
                Google inlogt), zodat je je bestellingen en verlanglijst kunt bekijken (uitvoering van de overeenkomst).
              </li>
              <li>
                <strong>Contact</strong> — wat je invult in het contactformulier, om je vraag te beantwoorden
                (gerechtvaardigd belang).
              </li>
              <li>
                <strong>Nieuwsbrief</strong> — je e-mailadres en taal, alleen als je je zelf inschrijft (toestemming). Je
                kunt je altijd uitschrijven via {email}.
              </li>
              <li>
                <strong>Beoordelingen</strong> — je naam en je beoordeling, als je er een plaatst (toestemming).
              </li>
              <li>
                <strong>Beveiliging</strong> — IP-adres en technische logs, kortstondig, om misbruik tegen te gaan
                (gerechtvaardigd belang).
              </li>
              <li>
                <strong>Statistieken en marketing</strong> — alleen na je toestemming in de cookiebanner (zie het{" "}
                <Link href="/cookies" className={a}>cookiebeleid</Link>).
              </li>
            </ul>

            <h2 className={h2}>3. Hoe lang bewaren we ze?</h2>
            <p>
              Bestellingen en facturen: zeven jaar (boekhoudwetgeving). Account: tot je vraagt om het te verwijderen.
              Nieuwsbrief: tot je je uitschrijft. Contactberichten: tot een jaar nadat je vraag afgehandeld is.
            </p>

            <h2 className={h2}>4. Met wie delen we ze?</h2>
            <p>
              Alleen met verwerkers die nodig zijn voor de dienst: Mollie (betalingen), Resend (transactionele e-mails),
              onze hosting- en databasepartner (servers in de EU) en de pakketdienst die je bestelling levert. Verwerkt een
              dienstverlener gegevens buiten de Europese Economische Ruimte, dan gebeurt dat op basis van een
              adequaatheidsbesluit of de standaardcontractbepalingen van de Europese Commissie. We verkopen je gegevens
              nooit.
            </p>

            <h2 className={h2}>5. Je rechten</h2>
            <p>
              Je hebt het recht om je gegevens in te zien, te laten verbeteren of wissen, de verwerking te beperken, je te
              verzetten tegen de verwerking, je gegevens mee te nemen en je toestemming op elk moment in te trekken. Mail
              naar {email}; we antwoorden binnen een maand. Je kunt ook een klacht indienen bij de
              Gegevensbeschermingsautoriteit (www.gegevensbeschermingsautoriteit.be).
            </p>

            <h2 className={h2}>6. Beveiliging</h2>
            <p>
              Wachtwoorden worden versleuteld opgeslagen (bcrypt), alle verbindingen lopen over https en alleen
              beheerders hebben toegang tot bestellingen.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
