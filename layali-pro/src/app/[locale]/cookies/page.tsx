import type { Metadata } from "next";
import { ConceptNotice, legalEmail } from "@/components/legal/LegalEntityBlock";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Politique de cookies" : "Cookiebeleid" };
}

const h2 = "text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8";

export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  const fr = locale === "fr";
  const email = legalEmail();

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">
        {fr ? "Politique de cookies" : "Cookiebeleid"}
      </h1>
      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <ConceptNotice locale={locale} />
        {fr ? (
          <>
            <p>Dernière mise à jour : octobre 2026</p>
            <h2 className={h2}>Que sont les cookies ?</h2>
            <p>
              Les cookies sont de petits fichiers texte enregistrés sur votre appareil. Nous utilisons aussi le stockage
              local du navigateur (localStorage), par exemple pour votre panier et votre choix de cookies.
            </p>
            <h2 className={h2}>Quels cookies utilisons-nous ?</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Strictement nécessaires</strong> — session de connexion, protection CSRF, panier, liste de souhaits
                et votre choix de cookies. Sans consentement, car indispensables au fonctionnement de la boutique.
              </li>
              <li>
                <strong>Statistiques</strong> — Google Analytics, uniquement si activé et après votre consentement.
              </li>
              <li>
                <strong>Marketing</strong> — Meta Pixel et TikTok Pixel, uniquement si activés et après votre consentement.
              </li>
            </ul>
            <h2 className={h2}>Gérer votre consentement</h2>
            <p>
              Lors de votre première visite, nous demandons votre consentement pour les cookies non nécessaires. Refuser
              est aussi simple qu&apos;accepter. Vous pouvez retirer votre consentement à tout moment en supprimant les
              cookies et données du site dans votre navigateur : la bannière réapparaît alors.
            </p>
            <h2 className={h2}>Contact</h2>
            <p>Des questions ? Écrivez-nous à {email}.</p>
          </>
        ) : (
          <>
            <p>Laatst bijgewerkt: oktober 2026</p>
            <h2 className={h2}>Wat zijn cookies?</h2>
            <p>
              Cookies zijn kleine tekstbestanden die op je apparaat worden opgeslagen. We gebruiken ook de lokale opslag
              van je browser (localStorage), bijvoorbeeld voor je winkelmandje en je cookiekeuze.
            </p>
            <h2 className={h2}>Welke cookies gebruiken wij?</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Strikt noodzakelijk</strong> — inlogsessie, CSRF-beveiliging, winkelmandje, verlanglijst en je
                cookiekeuze. Zonder toestemming, omdat de webshop anders niet werkt.
              </li>
              <li>
                <strong>Statistieken</strong> — Google Analytics, alleen als dat ingeschakeld is en na jouw toestemming.
              </li>
              <li>
                <strong>Marketing</strong> — Meta Pixel en TikTok Pixel, alleen als die ingeschakeld zijn en na jouw
                toestemming.
              </li>
            </ul>
            <h2 className={h2}>Je toestemming beheren</h2>
            <p>
              Bij je eerste bezoek vragen we toestemming voor niet-noodzakelijke cookies. Weigeren is even eenvoudig als
              aanvaarden. Je kunt je toestemming altijd intrekken door de cookies en sitegegevens in je browser te
              wissen: de banner verschijnt dan opnieuw.
            </p>
            <h2 className={h2}>Contact</h2>
            <p>Vragen over ons cookiebeleid? Mail ons op {email}.</p>
          </>
        )}
      </div>
    </div>
  );
}
