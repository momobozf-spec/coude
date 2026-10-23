import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Voorwaarden" };

export default function TermsPage() {
  return (
    <article className="longform">
      <p className="eyebrow">Gebruiksvoorwaarden · versie 1</p>
      <h1 style={{ fontSize: "clamp(26px,4vw,36px)" }}>Voorwaarden voor het gebruik van {site.name}</h1>
      <p className="msg info">Ontwerptekst. Laat deze voorwaarden nakijken door een jurist vóór de site publiek gaat, ook voor de vraag of de dienst onder financiële regelgeving valt.</p>

      <h2>1. Wat de dienst is</h2>
      <p>{site.name} is een online prikbord waar eigenaars van online bedrijven hun bedrijf aanbieden en kopers interesse kunnen tonen. De dienst wordt aangeboden door {site.company} (BTW {site.vat}).</p>

      <h2>2. Wat de dienst niet is</h2>
      <p>We treden niet op als makelaar, adviseur of vertegenwoordiger van koper of verkoper. We geven geen waardering, prijs-, beleggings-, juridisch of fiscaal advies, onderhandelen niet en beheren geen betalingen. Een overeenkomst tussen koper en verkoper komt rechtstreeks tussen hen tot stand.</p>

      <h2>3. Aanbiedingen</h2>
      <ul>
        <li>De verkoper is verantwoordelijk voor de juistheid van de gegevens. Wij controleren aanbiedingen op volledigheid en geloofwaardigheid, niet op juistheid.</li>
        <li>We mogen een aanbieding weigeren, aanpassen in vorm, of verwijderen, zonder opgave van reden.</li>
        <li>Een aanbieding mag geen persoonsgegevens van klanten, vertrouwelijke contracten of inloggegevens bevatten.</li>
      </ul>

      <h2>4. Kopers</h2>
      <ul>
        <li>Wie interesse toont, behandelt de informatie die hij krijgt vertrouwelijk en gebruikt ze alleen om de aankoop te beoordelen.</li>
        <li>Doe je eigen onderzoek en laat je bijstaan door een accountant en advocaat vóór je een bod doet.</li>
      </ul>

      <h2>5. Kosten</h2>
      <p>Het gebruik van de dienst is momenteel gratis. Komt er een vergoeding, dan maken we die vooraf bekend en geldt ze niet met terugwerkende kracht.</p>

      <h2>6. Aansprakelijkheid</h2>
      <p>We zijn niet aansprakelijk voor de juistheid van aanbiedingen, voor de afloop van onderhandelingen of voor schade uit een transactie tussen gebruikers, behalve bij opzet of grove fout.</p>

      <h2>7. Misbruik</h2>
      <p>We mogen een account blokkeren bij misbruik, spam, misleidende aanbiedingen of het benaderen van gebruikers buiten het doel van de dienst.</p>

      <h2>8. Toepasselijk recht</h2>
      <p>Belgisch recht is van toepassing. Geschillen worden voorgelegd aan de bevoegde rechtbanken van het gerechtelijk arrondissement van de maatschappelijke zetel van {site.company}.</p>

      <p className="hint">Vragen: {site.email}</p>
    </article>
  );
}
