import type { Metadata } from 'next'
import Link from 'next/link'

import { PRIVACY_VERSION } from '@/config/legal'
import { getRequestLocale } from '@/i18n/server'
import { ConceptNotice, LegalEntityBlock, legalLang, type LegalLang } from '../legal-entity-block'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Muslim Life handles your personal data.',
}

const TITLE: Record<LegalLang, string> = {
  en: 'Privacy policy',
  nl: 'Privacybeleid',
  fr: 'Politique de confidentialité',
}
const VERSION: Record<LegalLang, string> = { en: 'Version', nl: 'Versie', fr: 'Version' }

/**
 * Privacy notice (GDPR art. 13) in English, Dutch and French (Arabic readers get
 * English). Written against what the code actually does — see
 * src/server/modules/privacy/retention-policy.ts and assistant/context.ts.
 * Marked as a draft until a lawyer has reviewed it; update it when a processor changes.
 */
export default async function PrivacyPage() {
  const lang = legalLang(await getRequestLocale())
  const settingsLink = (label: string) => (
    <Link href="/app/settings/privacy" className="text-primary hover:underline">
      {label}
    </Link>
  )

  return (
    <article lang={lang} dir="ltr" className="mx-auto max-w-3xl space-y-8 px-5 py-16 text-sm leading-relaxed">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{TITLE[lang]}</h1>
        <p className="text-muted-foreground">
          {VERSION[lang]} {PRIVACY_VERSION}
        </p>
        <ConceptNotice lang={lang} />
      </header>

      {lang === 'nl' ? (
        <>
          <Section title="1. Wie is verantwoordelijk">
            <p>De verwerkingsverantwoordelijke voor je persoonsgegevens is:</p>
            <LegalEntityBlock lang="nl" />
          </Section>
          <Section title="2. Wat we verwerken en waarom">
            <ul className="list-disc space-y-2 ps-5">
              <li>
                <strong>Account</strong> — naam, e-mailadres en een gehasht wachtwoord. Nodig voor je account
                (overeenkomst, art. 6(1)(b) AVG).
              </li>
              <li>
                <strong>Instellingen</strong> — je stad (nooit je live locatie), land, berekeningsmethode voor
                gebedstijden, madhab, interesses, doelen, taal en thema. Om gebedstijden te berekenen en de app
                persoonlijk te maken (overeenkomst).
              </li>
              <li>
                <strong>Gebed, aanbidding en gewoontes</strong> — wat je registreert, plant en overdenkt. Gegevens
                over gebed en aanbidding kunnen je religie onthullen: een bijzondere categorie van gegevens. We
                verwerken ze alleen met je <strong>uitdrukkelijke toestemming</strong> (art. 9(2)(a) AVG), die je
                geeft bij het aanmaken van je account. Je kunt die toestemming altijd intrekken door deze gegevens of
                je account te verwijderen (zie punt 6); dat raakt de verwerking van daarvoor niet.
              </li>
              <li>
                <strong>Taken, planner, reflecties, bewaarde plaatsen en gebruikte aanbiedingen</strong> — inhoud die
                je zelf maakt (overeenkomst).
              </li>
              <li>
                <strong>Gesprekken met de assistent</strong> — je berichten en de antwoorden, zodat je een gesprek
                kunt voortzetten (overeenkomst).
              </li>
              <li>
                <strong>Abonnement</strong> — plan, status, betaalperiode en de klant- en abonnementsreferenties van
                de betaaldienst. Je kaartgegevens krijgen we nooit (overeenkomst; boekhoudplicht, art. 6(1)(c)).
              </li>
              <li>
                <strong>Beveiliging en gebruik</strong> — een auditlog van beveiligingsrelevante acties, kortlevende
                tellers voor rate limiting per IP-adres of e-mail (binnen een dag gewist) en productstatistieken met
                alleen gebeurtenisnamen, getallen en ja/nee-waarden — nooit inhoud (gerechtvaardigd belang bij een
                veilige, werkende dienst, art. 6(1)(f)).
              </li>
            </ul>
            <p>
              Er is geen publiek profiel, geen feed en geen ranglijst. Je gebeds- en gewoontegegevens worden nooit
              aan andere leden getoond, nooit verkocht en nooit voor reclame gebruikt.
            </p>
          </Section>
          <Section title="3. De assistent">
            <p>
              Als een echte AI-aanbieder gekoppeld is, stuurt de assistent je bericht naar die aanbieder met een
              beperkte, niet-gevoelige context: de datum, je tijdzone en stad, de gebedstijden van vandaag, de namen
              van je actieve gewoontes, titels van komende taken, plannerblokken en je doelen. Nooit je reflecties,
              taakbeschrijvingen of notities, en nooit of je gebeden hebt. Typ niets in de assistent wat je niet met
              die aanbieder wilt delen. De assistent is geen geleerde en geeft geen religieuze uitspraken.
            </p>
          </Section>
          <Section title="4. Wie verwerkt gegevens voor ons">
            <ul className="list-disc space-y-2 ps-5">
              <li>Hosting- en databasepartners (servers in de EU), die de app en de gegevens opslaan.</li>
              <li>Stripe (betalingen), alleen als je Premium koopt.</li>
              <li>Resend (e-mail), alleen om e-mails voor wachtwoordherstel te versturen.</li>
              <li>PostHog (EU), alleen als productstatistieken daarheen gestuurd worden; zonder inhoud of naam.</li>
              <li>
                Een AI-aanbieder (Anthropic of OpenAI), alleen als de assistent daaraan gekoppeld is. Deze aanbieders
                zijn gevestigd in de Verenigde Staten; de doorgifte steunt op het EU-VS Data Privacy Framework of
                standaardcontractbepalingen.
              </li>
            </ul>
            <p>Elk van hen verwerkt gegevens alleen op onze instructie, onder een verwerkersovereenkomst.</p>
          </Section>
          <Section title="5. Hoe lang we gegevens bewaren">
            <p>
              Je inhoud blijft bewaard zolang je een account hebt. Verwijder je je account, dan wordt je inhoud
              gewist; gebedsgegevens worden volledig gewist en nooit geanonimiseerd. Een beperkte set gegevens blijft
              geanonimiseerd bestaan (abonnements- en gebruikstellers, gebruik van aanbiedingen voor partnerzaken)
              of ongewijzigd waar de wet dat vereist (beveiligingslog, boekhouding). De precieze lijst staat op de
              privacypagina in de app.
            </p>
          </Section>
          <Section title="6. Je rechten">
            <p>
              Je kunt al je gegevens inzien en downloaden, verbeteren, wat je bijhield verwijderen of je account
              op elk moment verwijderen via {settingsLink('Instellingen → Privacy')}. Je hebt ook het recht om
              bezwaar te maken, de verwerking te beperken en op overdraagbaarheid. Neem contact op via het adres in
              punt 1. Je kunt een klacht indienen bij de Gegevensbeschermingsautoriteit
              (www.gegevensbeschermingsautoriteit.be).
            </p>
          </Section>
          <Section title="7. Cookies">
            <p>
              We gebruiken één strikt noodzakelijke cookie om je aangemeld te houden, en bewaren je keuze voor thema
              en taal. Er worden geen advertentie- of trackingcookies van derden gebruikt.
            </p>
          </Section>
        </>
      ) : lang === 'fr' ? (
        <>
          <Section title="1. Responsable du traitement">
            <p>Le responsable du traitement de vos données personnelles est :</p>
            <LegalEntityBlock lang="fr" />
          </Section>
          <Section title="2. Ce que nous traitons et pourquoi">
            <ul className="list-disc space-y-2 ps-5">
              <li>
                <strong>Compte</strong> — nom, adresse e-mail et mot de passe haché. Nécessaires à votre compte
                (contrat, art. 6(1)(b) RGPD).
              </li>
              <li>
                <strong>Paramètres</strong> — votre ville (jamais votre position en direct), pays, méthode de calcul
                des prières, madhab, intérêts, objectifs, langue et thème. Pour calculer les horaires de prière et
                personnaliser l&apos;application (contrat).
              </li>
              <li>
                <strong>Prière, adoration et habitudes</strong> — ce que vous enregistrez, planifiez et méditez. Les
                données de prière et d&apos;adoration peuvent révéler votre religion, une catégorie particulière de
                données. Nous les traitons uniquement avec votre <strong>consentement explicite</strong> (art. 9(2)(a)
                RGPD), donné lors de la création du compte. Vous pouvez le retirer à tout moment en supprimant ces
                données ou votre compte (voir point 6), sans effet sur le traitement antérieur.
              </li>
              <li>
                <strong>Tâches, agenda, réflexions, lieux enregistrés et offres utilisées</strong> — contenu que vous
                créez (contrat).
              </li>
              <li>
                <strong>Conversations avec l&apos;assistant</strong> — vos messages et les réponses, pour poursuivre
                une conversation (contrat).
              </li>
              <li>
                <strong>Abonnement</strong> — plan, statut, période de facturation et références client et
                abonnement du prestataire de paiement. Nous ne recevons jamais vos données de carte (contrat ;
                obligations comptables, art. 6(1)(c)).
              </li>
              <li>
                <strong>Sécurité et utilisation</strong> — un journal d&apos;audit des actions liées à la sécurité,
                des compteurs de limitation éphémères par adresse IP ou e-mail (supprimés en un jour) et des
                statistiques produit ne contenant que des noms d&apos;événements, des nombres et des oui/non —
                jamais de contenu (intérêt légitime à un service sûr et fonctionnel, art. 6(1)(f)).
              </li>
            </ul>
            <p>
              Il n&apos;y a ni profil public, ni fil, ni classement. Vos données de prière et d&apos;habitudes ne sont
              jamais montrées à d&apos;autres membres, jamais vendues et jamais utilisées pour la publicité.
            </p>
          </Section>
          <Section title="3. L'assistant">
            <p>
              Lorsqu&apos;un véritable fournisseur d&apos;IA est connecté, l&apos;assistant lui envoie votre message
              avec un contexte limité et non sensible : la date, votre fuseau horaire et votre ville, les horaires de
              prière du jour, les noms de vos habitudes actives, les titres des tâches à venir, les blocs
              d&apos;agenda et vos objectifs. Jamais vos réflexions, descriptions de tâches ou notes, ni si vous avez
              prié. Ne saisissez rien que vous ne voulez pas partager avec ce fournisseur. L&apos;assistant n&apos;est
              pas un savant et ne rend pas d&apos;avis religieux.
            </p>
          </Section>
          <Section title="4. Qui traite des données pour nous">
            <ul className="list-disc space-y-2 ps-5">
              <li>Les hébergeurs et fournisseurs de base de données (serveurs dans l&apos;UE).</li>
              <li>Stripe (paiements), uniquement si vous achetez Premium.</li>
              <li>Resend (e-mail), uniquement pour les e-mails de réinitialisation du mot de passe.</li>
              <li>PostHog (UE), uniquement si des statistiques produit y sont envoyées ; sans contenu ni nom.</li>
              <li>
                Un fournisseur d&apos;IA (Anthropic ou OpenAI), uniquement si l&apos;assistant y est connecté. Ces
                fournisseurs sont établis aux États-Unis ; le transfert repose sur le Data Privacy Framework UE-États-Unis
                ou sur des clauses contractuelles types.
              </li>
            </ul>
            <p>Chacun traite les données uniquement sur nos instructions, sous un accord de sous-traitance.</p>
          </Section>
          <Section title="5. Durée de conservation">
            <p>
              Votre contenu est conservé tant que vous avez un compte. Si vous supprimez votre compte, votre contenu
              est supprimé ; les données de prière sont supprimées entièrement et jamais anonymisées. Un ensemble
              limité subsiste sous forme anonymisée (compteurs d&apos;abonnement et d&apos;utilisation, utilisation des
              offres pour les partenaires) ou intacte lorsque la loi l&apos;exige (journal de sécurité, comptabilité).
              La liste exacte figure sur la page de confidentialité dans l&apos;application.
            </p>
          </Section>
          <Section title="6. Vos droits">
            <p>
              Vous pouvez consulter et télécharger toutes vos données, les corriger, supprimer ce que vous avez suivi
              ou supprimer votre compte à tout moment via {settingsLink('Paramètres → Confidentialité')}. Vous avez
              aussi le droit de vous opposer, de limiter le traitement et à la portabilité. Contactez-nous via
              l&apos;adresse du point 1. Vous pouvez introduire une plainte auprès de l&apos;Autorité de protection
              des données (www.autoriteprotectiondonnees.be).
            </p>
          </Section>
          <Section title="7. Cookies">
            <p>
              Nous utilisons un seul cookie strictement nécessaire pour vous garder connecté et enregistrons votre
              choix de thème et de langue. Aucun cookie publicitaire ou de suivi tiers n&apos;est utilisé.
            </p>
          </Section>
        </>
      ) : (
        <>
          <Section title="1. Who is responsible">
            <p>The controller of your personal data is:</p>
            <LegalEntityBlock lang="en" />
          </Section>
          <Section title="2. What we process, and why">
            <ul className="list-disc space-y-2 ps-5">
              <li>
                <strong>Account</strong> — name, e-mail address and a hashed password. Needed to provide your account
                (contract, art. 6(1)(b) GDPR).
              </li>
              <li>
                <strong>Settings</strong> — your city (never your live location), country, prayer-calculation method,
                madhab, interests, goals, language and theme. Used to calculate prayer times and personalise the app
                (contract).
              </li>
              <li>
                <strong>Prayer, worship and habit records</strong> — what you log, plan and reflect on. Records of
                prayer and worship can reveal your religion, which is a special category of data. We process it only
                with your <strong>explicit consent</strong> (art. 9(2)(a) GDPR), given when you create your account.
                You can withdraw consent at any time by deleting this data or your account (see section 6); this does
                not affect processing before withdrawal.
              </li>
              <li>
                <strong>Tasks, planner, reflections, saved places and redeemed deals</strong> — content you create
                (contract).
              </li>
              <li>
                <strong>Assistant conversations</strong> — your messages and the replies, stored so you can continue a
                conversation (contract).
              </li>
              <li>
                <strong>Subscription</strong> — plan, status, billing period and the payment provider&apos;s customer
                and subscription references. We never receive your card details (contract; accounting obligations,
                art. 6(1)(c)).
              </li>
              <li>
                <strong>Security and usage</strong> — an audit log of security-relevant actions, short-lived
                rate-limit counters keyed by IP address or e-mail (deleted within a day), and product analytics that
                contain only event names, numbers and yes/no values — never content (legitimate interest in a secure,
                working service, art. 6(1)(f)).
              </li>
            </ul>
            <p>
              There is no public profile, feed or leaderboard. Your prayer and habit records are never shown to other
              members, never sold and never used for advertising.
            </p>
          </Section>
          <Section title="3. The assistant">
            <p>
              When a real AI provider is connected, the assistant sends your message to that provider together with a
              limited, non-sensitive context: today&apos;s date, your timezone and city, today&apos;s prayer times, the
              names of your active habits, upcoming task titles, planner blocks and your stated goals. It never sends
              your reflections, task descriptions or notes, or whether you prayed. Do not type anything into the
              assistant that you do not want to share with that provider. The assistant is not a scholar and gives no
              religious rulings.
            </p>
          </Section>
          <Section title="4. Who processes data for us">
            <ul className="list-disc space-y-2 ps-5">
              <li>Hosting and database providers (servers in the EU), which store the application and its data.</li>
              <li>Stripe (payments), only if you buy Premium.</li>
              <li>Resend (e-mail), only to send password-reset messages.</li>
              <li>PostHog (EU), only if product analytics are sent there; never content or names.</li>
              <li>
                An AI provider (Anthropic or OpenAI), only if the assistant is connected to one. These providers are
                based in the United States; transfers rely on the EU–US Data Privacy Framework or standard
                contractual clauses.
              </li>
            </ul>
            <p>Each processes data only on our instructions, under a data-processing agreement.</p>
          </Section>
          <Section title="5. How long we keep it">
            <p>
              Your content is kept while you have an account. When you delete your account, your content is deleted;
              prayer records are deleted outright and never anonymised. A small set of records survives in anonymised
              form (subscription and usage counters, redemption records for partner businesses) or intact where the
              law requires it (security audit log, accounting records). The exact list is shown on the privacy page
              inside the app.
            </p>
          </Section>
          <Section title="6. Your rights">
            <p>
              You can access and download all your data, correct it, delete what you have tracked, or delete your
              account at any time from {settingsLink('Settings → Privacy')}. You also have the right to object, to
              restrict processing and to data portability. Contact us using the address in section 1. You may lodge
              a complaint with your data protection authority — in Belgium the Gegevensbeschermingsautoriteit /
              Autorité de protection des données (www.dataprotectionauthority.be).
            </p>
          </Section>
          <Section title="7. Cookies">
            <p>
              We use one strictly necessary cookie to keep you signed in, and store your theme and language choice. No
              advertising or third-party tracking cookies are used.
            </p>
          </Section>
        </>
      )}
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  )
}
