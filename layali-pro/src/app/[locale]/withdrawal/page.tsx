import type { Metadata } from "next";
import { ConceptNotice } from "@/components/legal/LegalEntityBlock";
import { legalEntity, shopPolicy } from "@/lib/legal";
import WithdrawalForm from "./WithdrawalForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Rétractation" : "Herroepen" };
}

/**
 * Herroepen:
 * 1. de online herroepingsfunctie (Richtlijn (EU) 2023/2673, sinds 19 juni 2026
 *    verplicht bij online gesloten overeenkomsten) — WithdrawalForm;
 * 2. het modelformulier voor herroeping (WER boek VI, bijlage 2 bij art. VI.45),
 *    dat de klant mag gebruiken maar niet moet.
 */
export default async function WithdrawalPage({ params }: Props) {
  const { locale } = await params;
  const e = legalEntity();
  const policy = shopPolicy();
  const fr = locale === "fr";
  const line = "border-b border-dashed border-border pb-2";

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">
        {fr ? "Se rétracter" : "Herroepen"}
      </h1>
      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <ConceptNotice locale={locale} />
        <p>
          {fr
            ? `Vous pouvez vous rétracter de votre achat dans les ${policy.withdrawalDays} jours suivant la réception, sans motif, directement ici.`
            : `Je kunt je aankoop binnen ${policy.withdrawalDays} dagen na ontvangst zonder opgave van reden herroepen, rechtstreeks hier.`}
        </p>
        <WithdrawalForm locale={locale} />
        <h2 className="pt-6 text-lg font-semibold text-foreground font-[family-name:var(--font-heading)]">
          {fr ? "Formulaire type de rétractation" : "Modelformulier voor herroeping"}
        </h2>
        <p>
          {fr
            ? `Vous disposez de ${policy.withdrawalDays} jours après réception pour vous rétracter. Complétez et renvoyez ce formulaire uniquement si vous souhaitez vous rétracter du contrat (par e-mail à ${e.email}). Un simple e-mail clair avec votre numéro de commande suffit également.`
            : `Je hebt ${policy.withdrawalDays} dagen na ontvangst om te herroepen. Vul dit formulier alleen in en stuur het terug als je de overeenkomst wilt herroepen (per e-mail naar ${e.email}). Een duidelijke e-mail met je bestelnummer volstaat ook.`}
        </p>
        <div className="space-y-4 rounded-2xl border border-border bg-white p-6 text-foreground">
          <p>
            {fr ? "À l'attention de" : "Aan"}: {e.name}, {e.displayAddress}, {e.email}
          </p>
          <p className={line}>
            {fr
              ? "Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*)/pour la prestation de services (*) ci-dessous :"
              : "Ik/Wij (*) deel/delen (*) u hierbij mede dat ik/wij (*) onze overeenkomst betreffende de verkoop van de volgende goederen/levering van de volgende dienst (*) herroep/herroepen (*):"}
          </p>
          <p className={line}>{fr ? "Numéro de commande :" : "Bestelnummer:"}</p>
          <p className={line}>{fr ? "Commandé le (*) / reçu le (*) :" : "Besteld op (*) / ontvangen op (*):"}</p>
          <p className={line}>{fr ? "Nom du/des consommateur(s) :" : "Naam/Namen consument(en):"}</p>
          <p className={line}>{fr ? "Adresse du/des consommateur(s) :" : "Adres consument(en):"}</p>
          <p className={line}>
            {fr
              ? "Signature du/des consommateur(s) (uniquement en cas de notification sur papier) :"
              : "Handtekening van consument(en) (alleen wanneer dit formulier op papier wordt ingediend):"}
          </p>
          <p className={line}>{fr ? "Date :" : "Datum:"}</p>
          <p className="text-xs text-muted-foreground">{fr ? "(*) Rayez la mention inutile." : "(*) Doorhalen wat niet van toepassing is."}</p>
        </div>
      </div>
    </div>
  );
}
