import type { Metadata } from 'next'
import Link from 'next/link'

import { PRICING } from '@/config/plans'
import { legalEntity } from '@/config/legal'
import { getRequestLocale } from '@/i18n/server'
import { ConceptNotice, LegalEntityBlock, legalLang, type LegalLang } from '../legal-entity-block'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The agreement between you and the operator of Muslim Life.',
}

const TITLE: Record<LegalLang, string> = {
  en: 'Terms of use',
  nl: 'Gebruiksvoorwaarden',
  fr: "Conditions d'utilisation",
}

/**
 * Terms of use in English, Dutch and French (Arabic readers get English).
 * Prices come from src/config/plans.ts so this page cannot drift from the
 * pricing page. Marked as a draft until a lawyer has reviewed it.
 */
export default async function TermsPage() {
  const lang = legalLang(await getRequestLocale())
  const monthly = `${PRICING.symbol}${PRICING.monthly.display}`
  const yearly = `${PRICING.symbol}${PRICING.yearly.display}`
  const trial = PRICING.trialDays
  const email = legalEntity().email

  return (
    <article lang={lang} dir="ltr" className="mx-auto max-w-3xl space-y-8 px-5 py-16 text-sm leading-relaxed">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{TITLE[lang]}</h1>
        <ConceptNotice lang={lang} />
      </header>

      {lang === 'nl' ? (
        <>
          <Section title="1. Wie zijn wij">
            <p>Muslim Life wordt uitgebaat door:</p>
            <LegalEntityBlock lang="nl" />
          </Section>
          <Section title="2. De dienst">
            <p>
              Muslim Life is een lifestyle- en productiviteitsapp: gebedstijden en -tracking, een planner,
              gewoontes, het ontdekken van plaatsen en aanbiedingen, en een assistent die helpt plannen. De app
              geeft geen religieuze uitspraken (fatwa&apos;s) en geen medisch, juridisch of financieel advies. De
              assistent is geen geleerde.
            </p>
            <p>
              Gebedstijden worden astronomisch berekend op basis van je stad en de gekozen methode. Ze kunnen
              afwijken van het rooster van je moskee; controleer ze altijd. Religieuze teksten in de app (verzen,
              hadith, dua&apos;s) worden nog nagelezen door iemand met religieuze kennis; controleer ze bij een
              bevoegde bron.
            </p>
            <p>
              Vermeldingen met het label <em>Demo</em> zijn fictief en tonen alleen hoe de functie werkt.
              Aanbiedingen van echte partnerzaken worden door die zaken nagekomen volgens de voorwaarden bij elke
              aanbieding.
            </p>
          </Section>
          <Section title="3. Je account">
            <p>
              Je geeft juiste gegevens op en houdt je wachtwoord voor jezelf. Je bent verantwoordelijk voor wat er
              met je account gebeurt. Je bent minstens 16 jaar, of je hebt de toestemming van je ouder of voogd.
            </p>
          </Section>
          <Section title="4. Gratis plan en Premium">
            <p>
              Het gratis plan kost niets. Premium kost {monthly} per maand of {yearly} per jaar, btw inbegrepen,
              vooraf betaald via onze betaaldienst (Stripe). Nieuwe leden krijgen bij het jaarplan een gratis
              proefperiode van {trial} dagen; je betaalt pas na de proefperiode, tenzij je vóór het einde opzegt.
            </p>
            <p>
              Premium wordt automatisch verlengd voor dezelfde periode tot je opzegt. Opzeggen kan altijd via
              Instellingen → Abonnement; Premium blijft dan actief tot het einde van de betaalde periode en wordt
              niet verlengd.
            </p>
          </Section>
          <Section title="5. Herroepingsrecht (consumenten in de EU)">
            <p>
              Je mag een Premium-aankoop binnen 14 dagen na het afsluiten herroepen zonder opgave van redenen, via{' '}
              <Link href="/legal/withdrawal" className="text-primary hover:underline">
                Hier de overeenkomst herroepen
              </Link>{' '}
              of met een ondubbelzinnige e-mail aan {email} vanaf het e-mailadres van je account. Omdat je bij het
              afrekenen uitdrukkelijk vraagt om Premium meteen te laten starten, betaal je alleen voor het deel van
              de periode dat al geleverd werd vóór je herroeping; het saldo betalen we binnen 14 dagen terug met
              hetzelfde betaalmiddel. Herroep je tijdens de gratis proefperiode, dan betaal je niets.
            </p>
          </Section>
          <Section title="6. Aanvaardbaar gebruik">
            <p>
              Misbruik de dienst niet: geen pogingen om gegevens van andere leden in te zien, geen geautomatiseerd
              scrapen, geen onwettige inhoud in de assistent. We kunnen accounts die dat doen opschorten.
            </p>
          </Section>
          <Section title="7. Aansprakelijkheid">
            <p>
              We leveren de dienst met zorg, maar kunnen niet garanderen dat ze altijd beschikbaar of foutloos is.
              Niets in deze voorwaarden beperkt aansprakelijkheid die volgens de wet niet beperkt mag worden.
            </p>
          </Section>
          <Section title="8. Einde van de overeenkomst">
            <p>
              Je kunt je account altijd verwijderen via Instellingen → Privacy. Je gegevens worden dan behandeld
              zoals beschreven in het privacybeleid.
            </p>
          </Section>
          <Section title="9. Klachten en geschillen">
            <p>
              Klachten kun je melden via {email}. Lukt het niet om er samen uit te komen, dan kun je terecht bij de
              Consumentenombudsdienst (www.consumentenombudsdienst.be).
            </p>
          </Section>
          <Section title="10. Wijzigingen en toepasselijk recht">
            <p>
              Over belangrijke wijzigingen van deze voorwaarden laten we het je vooraf weten. Het Belgisch recht is
              van toepassing, zonder dat je de bescherming verliest van het dwingend recht van het land waar je
              woont.
            </p>
          </Section>
        </>
      ) : lang === 'fr' ? (
        <>
          <Section title="1. Qui sommes-nous">
            <p>Muslim Life est exploité par :</p>
            <LegalEntityBlock lang="fr" />
          </Section>
          <Section title="2. Le service">
            <p>
              Muslim Life est une application de style de vie et de productivité : horaires et suivi des prières,
              agenda, habitudes, découverte de lieux et d&apos;offres, et un assistant qui aide à planifier. Elle ne
              rend pas d&apos;avis religieux (fatwas) et ne donne pas de conseil médical, juridique ou financier.
              L&apos;assistant n&apos;est pas un savant.
            </p>
            <p>
              Les horaires de prière sont calculés astronomiquement à partir de votre ville et de la méthode choisie.
              Ils peuvent différer de l&apos;horaire de votre mosquée ; vérifiez-les toujours. Les textes religieux de
              l&apos;application (versets, hadiths, invocations) sont encore en cours de relecture par une personne
              ayant des connaissances religieuses ; vérifiez-les auprès d&apos;une source qualifiée.
            </p>
            <p>
              Les fiches marquées <em>Demo</em> sont fictives et illustrent seulement la fonctionnalité. Les offres
              de vrais commerces partenaires sont honorées par ces commerces selon les conditions de chaque offre.
            </p>
          </Section>
          <Section title="3. Votre compte">
            <p>
              Vous fournissez des données exactes et gardez votre mot de passe pour vous. Vous êtes responsable de ce
              qui se passe avec votre compte. Vous avez au moins 16 ans, ou l&apos;autorisation d&apos;un parent ou
              tuteur.
            </p>
          </Section>
          <Section title="4. Plan gratuit et Premium">
            <p>
              Le plan gratuit ne coûte rien. Premium coûte {monthly} par mois ou {yearly} par an, TVA comprise,
              payé à l&apos;avance via notre prestataire de paiement (Stripe). Les nouveaux membres bénéficient
              d&apos;un essai gratuit de {trial} jours sur le plan annuel ; vous êtes débité à la fin de l&apos;essai,
              sauf si vous résiliez avant.
            </p>
            <p>
              Premium est renouvelé automatiquement pour la même période jusqu&apos;à résiliation. Vous pouvez
              résilier à tout moment via Paramètres → Abonnement ; Premium reste actif jusqu&apos;à la fin de la
              période payée et n&apos;est pas renouvelé.
            </p>
          </Section>
          <Section title="5. Droit de rétractation (consommateurs de l'UE)">
            <p>
              Vous pouvez vous rétracter d&apos;un achat Premium dans les 14 jours suivant sa conclusion, sans motif,
              via{' '}
              <Link href="/legal/withdrawal" className="text-primary hover:underline">
                Se rétracter du contrat ici
              </Link>{' '}
              ou par une déclaration claire par e-mail à {email}, depuis l&apos;adresse e-mail de votre compte. Comme vous demandez expressément, lors du paiement, que Premium commence immédiatement, vous
              ne payez que la partie de la période déjà fournie avant votre rétractation ; nous remboursons le solde
              dans les 14 jours avec le même moyen de paiement. Si vous vous rétractez pendant l&apos;essai gratuit,
              vous ne payez rien.
            </p>
          </Section>
          <Section title="6. Utilisation acceptable">
            <p>
              N&apos;abusez pas du service : aucune tentative d&apos;accéder aux données d&apos;autres membres, pas
              d&apos;extraction automatisée, pas de contenu illicite dans l&apos;assistant. Nous pouvons suspendre les
              comptes concernés.
            </p>
          </Section>
          <Section title="7. Responsabilité">
            <p>
              Nous fournissons le service avec soin, mais ne pouvons garantir qu&apos;il soit toujours disponible ou
              sans erreur. Rien dans ces conditions ne limite une responsabilité que la loi interdit de limiter.
            </p>
          </Section>
          <Section title="8. Fin du contrat">
            <p>
              Vous pouvez supprimer votre compte à tout moment via Paramètres → Confidentialité. Vos données sont
              alors traitées comme décrit dans la politique de confidentialité.
            </p>
          </Section>
          <Section title="9. Réclamations et litiges">
            <p>
              Adressez vos réclamations à {email}. À défaut de solution, vous pouvez vous adresser au Service de
              Médiation pour le Consommateur (www.mediationconsommateur.be).
            </p>
          </Section>
          <Section title="10. Modifications et droit applicable">
            <p>
              Nous vous informons à l&apos;avance de toute modification importante. Le droit belge est applicable,
              sans vous priver de la protection du droit impératif du pays où vous résidez.
            </p>
          </Section>
        </>
      ) : (
        <>
          <Section title="1. Who we are">
            <p>Muslim Life is operated by:</p>
            <LegalEntityBlock lang="en" />
          </Section>
          <Section title="2. The service">
            <p>
              Muslim Life is a lifestyle and productivity app: prayer times and tracking, a planner, habits,
              discovery of places and deals, and an assistant that helps you plan. It does not issue religious
              rulings and does not give medical, legal or financial advice. The assistant is not a scholar.
            </p>
            <p>
              Prayer times are calculated astronomically from your city and the method you choose. They can differ
              from your local mosque&apos;s timetable; always verify them. Religious texts in the app (verses, hadith,
              du&apos;as) are still being reviewed by someone with religious knowledge; verify them with a qualified
              source.
            </p>
            <p>
              Listings marked <em>Demo</em> are fictional and shown to illustrate the feature. Deals from real
              partner businesses are honoured by those businesses under the terms shown with each deal.
            </p>
          </Section>
          <Section title="3. Your account">
            <p>
              You must give accurate details and keep your password to yourself. You are responsible for what
              happens under your account. You must be at least 16 years old, or have your parent&apos;s or
              guardian&apos;s permission.
            </p>
          </Section>
          <Section title="4. Free plan and Premium">
            <p>
              The free plan costs nothing. Premium costs {monthly} per month or {yearly} per year, VAT included,
              billed in advance through our payment provider (Stripe). New members get a {trial}-day free trial on
              the yearly plan; you are charged when the trial ends unless you cancel before.
            </p>
            <p>
              Premium renews automatically for the same period until you cancel. You can cancel at any time from
              Settings → Billing; Premium then stays active until the end of the period you paid for, and is not
              renewed.
            </p>
          </Section>
          <Section title="5. Right of withdrawal (EU consumers)">
            <p>
              You may withdraw from a Premium purchase within 14 days of concluding it, without giving a reason, via{' '}
              <Link href="/legal/withdrawal" className="text-primary hover:underline">
                Withdraw from contract here
              </Link>{' '}
              or by sending a clear statement to {email} from your account&apos;s e-mail address. Because you expressly
              ask at checkout for Premium to start immediately, you pay only for the part of the period already
              provided before you withdrew; we refund the rest within 14 days using the same payment method. If you
              withdraw during the free trial, you pay nothing.
            </p>
          </Section>
          <Section title="6. Acceptable use">
            <p>
              Do not misuse the service: no attempts to access other members&apos; data, no automated scraping, no
              unlawful content in the assistant. We may suspend accounts that do.
            </p>
          </Section>
          <Section title="7. Liability">
            <p>
              We provide the service with care but cannot guarantee it is always available or error-free. Nothing in
              these terms limits liability that cannot be limited by law.
            </p>
          </Section>
          <Section title="8. Ending the agreement">
            <p>
              You can delete your account at any time from Settings → Privacy. Your data is then handled as
              described in the privacy policy.
            </p>
          </Section>
          <Section title="9. Complaints and disputes">
            <p>
              Send complaints to {email}. If we cannot resolve it together, you can contact the Belgian Consumer
              Mediation Service (www.consumentenombudsdienst.be / www.mediationconsommateur.be).
            </p>
          </Section>
          <Section title="10. Changes and law">
            <p>
              We will tell you in advance about material changes to these terms. Belgian law applies, without
              depriving you of the protection of the mandatory law of the country where you live.
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
