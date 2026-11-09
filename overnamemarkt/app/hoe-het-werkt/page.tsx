import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Hoe het werkt" };

export default function HowPage() {
  return (
    <article className="longform">
      <p className="eyebrow">Hoe het werkt</p>
      <h1 style={{ fontSize: "clamp(26px,4vw,36px)" }}>Van aanbieding tot gesprek tussen koper en verkoper</h1>

      <h2>Voor verkopers</h2>
      <ol>
        <li>Je meldt je aan met je e-mailadres en dient je aanbieding in.</li>
        <li>Wij controleren of de aanbieding volledig en geloofwaardig is. Pas daarna wordt ze gepubliceerd, zonder je naam of e-mailadres.</li>
        <li>Toont een koper interesse, dan krijg je van ons zijn bericht en e-mailadres, als hij daar toestemming voor gaf.</li>
        <li>Je onderhandelt rechtstreeks met de koper, met je eigen accountant en advocaat.</li>
      </ol>

      <h2>Voor kopers</h2>
      <ol>
        <li>Je bekijkt het aanbod zonder account.</li>
        <li>Wil je meer weten, dan meld je je aan en toon je interesse met een kort bericht.</li>
        <li>Wij geven je bericht door aan de verkoper. Die neemt zelf contact met je op.</li>
      </ol>

      <h2>Wat we niet doen</h2>
      <ul>
        <li>We geven geen waardering, prijsadvies, juridisch of fiscaal advies.</li>
        <li>We onderhandelen niet en we beheren geen betalingen of escrow.</li>
        <li>We controleren de cijfers niet op juistheid. Laat ze verifiëren vóór je een bod doet of aanvaardt.</li>
      </ul>

      <p>Meer details staan in de <Link href="/voorwaarden">voorwaarden</Link> en de <Link href="/privacy">privacyverklaring</Link>.</p>
    </article>
  );
}
