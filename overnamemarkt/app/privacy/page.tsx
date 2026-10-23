import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacyverklaring" };

export default function PrivacyPage() {
  return (
    <article className="longform">
      <p className="eyebrow">Privacyverklaring · versie 1</p>
      <h1 style={{ fontSize: "clamp(26px,4vw,36px)" }}>Hoe we met je gegevens omgaan</h1>
      <p className="msg info"><strong>Concept — laten nalezen door een jurist.</strong></p>

      <h2>Wie is verantwoordelijk</h2>
      <p>{site.company}, {site.legalForm}, ondernemingsnummer/btw {site.vat}, zetel: {site.address}. Contact: {site.email}.</p>

      <h2>Welke gegevens en waarom</h2>
      <ul>
        <li><strong>E-mailadres van je account</strong>: om je aan te melden. Grondslag: uitvoering van de overeenkomst.</li>
        <li><strong>Aanbiedingen</strong> (omschrijving, cijfers, contactadres): om ze te controleren en te publiceren. Je contactadres wordt nooit publiek getoond. Grondslag: uitvoering van de overeenkomst en je toestemming.</li>
        <li><strong>Interesse van kopers</strong> (bericht, e-mailadres, budget): om het door te geven aan de verkoper van die ene aanbieding. Grondslag: je toestemming, die je bij het versturen geeft.</li>
        <li><strong>Technische logs</strong> bij onze hostingpartners: voor beveiliging en foutopsporing.</li>
      </ul>

      <h2>Met wie we gegevens delen</h2>
      <ul>
        <li>De verkoper van een aanbieding, alleen het bericht en e-mailadres van een koper die daarvoor toestemming gaf.</li>
        <li>Verwerkers die de site laten draaien: Supabase (database en aanmelding, regio Frankfurt in de EU), Vercel (hosting, serverfuncties in de regio Frankfurt) en onze e-maildienst voor aanmeldlinks. Supabase en Vercel zijn Amerikaanse bedrijven; doorgifte buiten de EER gebeurt op basis van het EU-VS Data Privacy Framework en/of de standaardcontractbepalingen van de Europese Commissie.</li>
      </ul>
      <p>We verkopen geen gegevens en gebruiken ze niet voor reclame.</p>

      <h2>Cookies</h2>
      <p>We gebruiken alleen cookies die nodig zijn om je aangemeld te houden. Er zijn geen analyse- of reclamecookies.</p>

      <h2>Bewaartermijn</h2>
      <p>We bewaren gegevens zolang je account bestaat en maximaal 24 maanden na je laatste activiteit. Daarna verwijderen we ze.</p>

      <h2>Je rechten</h2>
      <p>Je kunt je gegevens inkijken, laten verbeteren of verwijderen, je toestemming intrekken en bezwaar maken. Mail naar {site.email}; we antwoorden binnen één maand. Je kunt ook klacht indienen bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel (gegevensbeschermingsautoriteit.be).</p>
    </article>
  );
}
