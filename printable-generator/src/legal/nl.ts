import type { LegalTexts } from "./types";

// Authoritative version. Concept — laten nalezen door een jurist.
export const nl: LegalTexts = {
  privacy: {
    title: "Privacyverklaring",
    sections: [
      {
        h: "1. Wie is verantwoordelijk?",
        p: [
          "Noor Printables wordt uitgebaat door {NAME}, ondernemingsnummer {CBE}, met maatschappelijke zetel te {ADDRESS} (hierna \"wij\"). Wij zijn de verwerkingsverantwoordelijke voor de persoonsgegevens die via Noor Printables worden verwerkt. Contact: {EMAIL}.",
        ],
      },
      {
        h: "2. Voor wie is Noor Printables bedoeld? (kinderen)",
        p: [
          "Noor Printables maakt werkbladen voor kinderen van 4 tot 8 jaar, maar de dienst is bedoeld voor volwassenen: ouders, voogden, leerkrachten en scholen. Alleen personen van 18 jaar of ouder mogen een account aanmaken; dat bevestig je bij de registratie.",
          "Kinderen maken geen account aan en wij vragen geen persoonsgegevens van kinderen. Kinderen jonger dan 13 jaar kunnen in België niet zelf toestemming geven voor de verwerking van hun gegevens bij online diensten (art. 8 AVG en art. 7 van de Belgische wet van 30 juli 2018); zij gebruiken de werkbladen of het digitaal kleuren enkel via het account en onder toezicht van een ouder, voogd of leerkracht.",
          "Vul in vrije tekstvelden (bv. het thema van een werkblad) geen namen of andere gegevens van kinderen in. Als je vermoedt dat een kind toch een account heeft aangemaakt of gegevens van een kind heeft ingegeven, contacteer ons: we verwijderen die gegevens.",
          "Optionele modules die gegevens over een kind kunnen vragen (bv. een voornaam en leeftijd voor een certificaat) staan standaard uit. Worden ze later geactiveerd, dan vult enkel de ouder of voogd die gegevens in, met diens toestemming, beperkt tot wat nodig is, en kunnen ze op elk moment verwijderd worden.",
        ],
      },
      {
        h: "3. Welke gegevens verwerken we?",
        ul: [
          "Accountgegevens: naam, e-mailadres, wachtwoord (enkel als versleutelde hash) of — bij inloggen via Google, Microsoft of Apple — de unieke ID van die provider en je profielfoto als die wordt doorgegeven.",
          "Gebruiksgegevens: welke werkbladen je maakt (type, thema, datum) en hoeveel, je plan, je referral-code en wie je eventueel heeft uitgenodigd.",
          "Betaalgegevens: betalingen verlopen via Stripe. Wij ontvangen geen kaart- of rekeningnummers; we bewaren je Stripe-klant-ID, abonnements-ID en abonnementsstatus.",
          "Facturatiegegevens van scholen: naam van de school, contactpersoon, e-mail, facturatieadres en btw-nummer als je een factuur aanvraagt.",
          "Communicatie: e-mails die je ons stuurt en de transactionele e-mails die we je sturen (bv. welkom, bevestiging van een upgrade).",
          "Technische gegevens: IP-adres en technische logs bij onze hostingprovider, en de cookies die nodig zijn om ingelogd te blijven (zie ons cookiebeleid).",
          "Enkel met je toestemming: analytische gegevens via Google Analytics (zie cookiebeleid).",
        ],
      },
      {
        h: "4. Waarom en op welke rechtsgrond?",
        ul: [
          "Om je account en de dienst te leveren (werkbladen genereren, je abonnement beheren, support) — uitvoering van de overeenkomst (art. 6.1.b AVG).",
          "Om betalingen te verwerken en onze boekhouding te voeren — uitvoering van de overeenkomst en wettelijke verplichting (art. 6.1.b en 6.1.c AVG).",
          "Om de dienst te beveiligen en misbruik te voorkomen (bv. limieten, fraudepreventie bij referrals) — ons gerechtvaardigd belang (art. 6.1.f AVG).",
          "Om de website te analyseren en te verbeteren via analytische cookies — enkel met je toestemming (art. 6.1.a AVG), die je altijd kunt intrekken.",
          "We sturen geen marketingmails zonder je voorafgaande toestemming. We verkopen je gegevens niet en doen niet aan profilering of geautomatiseerde besluitvorming met rechtsgevolgen.",
        ],
      },
      {
        h: "5. Met wie delen we gegevens?",
        p: [
          "We werken met de volgende verwerkers, die je gegevens enkel in onze opdracht gebruiken: onze hostingprovider (bv. Vercel) en databankprovider (bv. Turso), bij voorkeur in een EU-regio; Stripe Payments Europe Ltd. (Ierland) voor betalingen; Resend voor het versturen van e-mails; en Google, Microsoft of Apple enkel als je via hen inlogt. Google Analytics wordt enkel gebruikt na je toestemming.",
          "Sommige van deze partijen zijn gevestigd in de Verenigde Staten of hebben daar toegang tot gegevens. Zo'n doorgifte buiten de Europese Economische Ruimte gebeurt op basis van het EU-VS Data Privacy Framework (voor gecertificeerde bedrijven) of de standaardcontractbepalingen van de Europese Commissie.",
          "We geven gegevens aan overheden enkel als de wet ons daartoe verplicht.",
        ],
      },
      {
        h: "6. Hoe lang bewaren we je gegevens?",
        ul: [
          "Accountgegevens en gebruiksgegevens: zolang je account bestaat. Na verwijdering van je account wissen we ze binnen 30 dagen, behalve wat we wettelijk moeten bewaren.",
          "Facturen en boekhoudkundige stukken: gedurende de wettelijke bewaartermijn voor boekhoudkundige stukken.",
          "Technische logs: zo kort mogelijk, doorgaans maximaal 30 dagen (afhankelijk van de hostingprovider).",
          "Je cookiekeuze: tot je ze wijzigt of je browsergegevens wist.",
        ],
      },
      {
        h: "7. Beveiliging",
        p: [
          "Wachtwoorden worden enkel als bcrypt-hash opgeslagen, alle verbindingen verlopen via HTTPS, en toegang tot beheerfuncties is beperkt tot beheerders met een persoonlijk account.",
        ],
      },
      {
        h: "8. Jouw rechten",
        p: [
          "Je hebt het recht op inzage, verbetering, wissing, beperking van de verwerking, overdraagbaarheid van je gegevens en bezwaar tegen verwerking op basis van ons gerechtvaardigd belang. Een gegeven toestemming kun je altijd intrekken. Stuur je verzoek naar {EMAIL}; we antwoorden binnen één maand.",
          "Ben je niet tevreden, dan kun je een klacht indienen bij de Gegevensbeschermingsautoriteit, Drukpersstraat 35, 1000 Brussel, contact@apd-gba.be, www.gegevensbeschermingsautoriteit.be.",
        ],
      },
      {
        h: "9. Wijzigingen",
        p: ["We kunnen deze verklaring aanpassen. De datum van de laatste versie staat bovenaan. Bij belangrijke wijzigingen verwittigen we geregistreerde gebruikers per e-mail."],
      },
    ],
  },

  terms: {
    title: "Algemene voorwaarden",
    sections: [
      {
        h: "1. Wie zijn wij?",
        p: [
          "Noor Printables wordt aangeboden door {NAME}, ondernemingsnummer en btw-nummer {CBE}, maatschappelijke zetel: {ADDRESS}, e-mail: {EMAIL}.",
          "Deze voorwaarden gelden voor elk gebruik van Noor Printables en voor elk gratis of betaald abonnement.",
        ],
      },
      {
        h: "2. Account",
        ul: [
          "Je moet 18 jaar of ouder zijn om een account aan te maken. Kinderen gebruiken de dienst enkel onder toezicht van een ouder, voogd of leerkracht.",
          "Je geeft correcte gegevens op en houdt je wachtwoord geheim. Je bent verantwoordelijk voor het gebruik van je account.",
          "Je kunt je account op elk moment laten verwijderen via {EMAIL}.",
        ],
      },
      {
        h: "3. De dienst",
        p: [
          "Met Noor Printables maak je islamitische werkbladen (kleurplaten, doolhoven, woordzoekers) als PDF en kun je digitaal kleuren. Met het gratis plan maak je een beperkt aantal werkbladen; Pro en School geven onbeperkt werkbladen.",
          "We doen ons best om religieuze teksten, Arabische letters en vertalingen correct weer te geven. Merk je een fout op, meld het ons dan zodat we die kunnen verbeteren.",
          "We streven naar een goede beschikbaarheid, maar kunnen geen ononderbroken werking garanderen. We kunnen functies wijzigen of toevoegen; wezenlijke wijzigingen aan een betaald abonnement melden we vooraf.",
        ],
      },
      {
        h: "4. Prijzen, betaling en verlenging",
        ul: [
          "De actuele prijzen staan op de website en zijn voor consumenten inclusief btw. Het bedrag dat je betaalt, zie je altijd vóór je bevestigt in de betaalpagina van Stripe.",
          "Pro- en School-abonnementen lopen per maand of per jaar en worden automatisch verlengd voor dezelfde periode, tot je opzegt.",
          "Je kunt op elk moment opzeggen via je account (Stripe-klantenportaal). De opzegging gaat in aan het einde van de lopende betaalde periode; voor die periode krijg je geen terugbetaling, behalve bij herroeping (art. 5) of als de wet dat oplegt.",
          "Bij een prijswijziging verwittigen we je minstens 30 dagen vooraf. Ga je niet akkoord, dan kun je opzeggen vóór de nieuwe prijs ingaat.",
          "Mislukt een betaling, dan behouden we je toegang tijdelijk; na herhaaldelijk mislukte betalingen wordt je account omgezet naar het gratis plan.",
        ],
      },
      {
        h: "5. Herroepingsrecht (consumenten)",
        p: [
          "Als consument heb je het recht om binnen 14 dagen na het afsluiten van een betaald abonnement zonder opgave van redenen af te zien van de overeenkomst.",
          "Vraag je uitdrukkelijk dat de dienst meteen start (door het abonnement direct te activeren), dan betaal je bij herroeping een bedrag dat in verhouding staat tot wat al geleverd is tot het moment van herroeping.",
          "Voor werkbladen die je als digitale inhoud downloadt, vervalt het herroepingsrecht zodra de download start, als je daar vooraf uitdrukkelijk mee hebt ingestemd en hebt erkend dat je daardoor je herroepingsrecht verliest (art. VI.53, 13° WER).",
          "Om je herroepingsrecht uit te oefenen stuur je een duidelijke verklaring naar {EMAIL}, bijvoorbeeld met dit modelformulier: \"Aan {NAME}, {ADDRESS}, {EMAIL}: Ik deel u hierbij mee dat ik mijn overeenkomst betreffende het abonnement [Pro/School] herroep. Besteld op: [datum]. Naam: [naam]. E-mailadres van het account: [e-mail]. Datum: [datum].\" We betalen het verschuldigde bedrag terug binnen 14 dagen via hetzelfde betaalmiddel.",
        ],
      },
      {
        h: "6. Gebruik van de werkbladen (licentie)",
        ul: [
          "Je mag werkbladen die je met Noor Printables maakt afdrukken en gebruiken in je eigen gezin en — met een Pro- of School-abonnement — in je eigen klassen en lessen, ook als je voor die lessen betaald wordt.",
          "Met een School-abonnement mag de school de werkbladen gebruiken in haar eigen klassen.",
          "Niet toegestaan: werkbladen (digitaal of gedrukt) als zodanig doorverkopen, publiek online verspreiden of aanbieden in een concurrerende dienst, en de dienst automatisch of massaal uitlezen.",
          "De software, ontwerpen en templates blijven eigendom van {NAME} of haar licentiegevers.",
        ],
      },
      {
        h: "7. Fair use en misbruik",
        p: [
          "Je gebruikt de dienst niet voor onwettige doeleinden, probeert geen limieten of beveiliging te omzeilen en maakt geen valse accounts aan (bv. om referral-bonussen te verkrijgen). Bij misbruik kunnen we bonussen intrekken, de toegang beperken of het account beëindigen, na voorafgaande verwittiging tenzij dat niet redelijk is.",
        ],
      },
      {
        h: "8. Aansprakelijkheid",
        p: [
          "We leveren de dienst met de nodige zorg. Voor zover de wet het toelaat, zijn we niet aansprakelijk voor indirecte schade (zoals gederfde winst). Onze aansprakelijkheid is in elk geval beperkt tot het bedrag dat je in de 12 maanden vóór het schadegeval hebt betaald. Deze beperkingen gelden niet bij opzet, zware fout, overlijden of lichamelijk letsel, en doen geen afbreuk aan je dwingende rechten als consument.",
        ],
      },
      {
        h: "9. Klachten en geschillen",
        p: [
          "Heb je een klacht, stuur dan een e-mail naar {EMAIL}; we antwoorden binnen 14 dagen. Consumenten kunnen zich ook wenden tot de Consumentenombudsdienst (www.consumentenombudsdienst.be).",
          "Op deze voorwaarden is het Belgisch recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechtbanken; als consument behoud je de bescherming van de dwingende regels van je woonplaats.",
        ],
      },
      {
        h: "10. Wijzigingen",
        p: ["We kunnen deze voorwaarden aanpassen. Wezenlijke wijzigingen melden we minstens 30 dagen vooraf per e-mail; je kunt dan opzeggen vóór ze ingaan."],
      },
    ],
  },

  cookies: {
    title: "Cookiebeleid",
    sections: [
      {
        h: "1. Wat zijn cookies?",
        p: ["Cookies zijn kleine tekstbestanden die een website op je toestel plaatst. Gelijkaardige technieken, zoals lokale opslag (localStorage) in je browser, vallen ook onder dit beleid."],
      },
      {
        h: "2. Strikt noodzakelijke cookies (geen toestemming nodig)",
        ul: [
          "authjs.session-token / __Secure-authjs.session-token — houdt je ingelogd; tot 30 dagen.",
          "authjs.csrf-token / __Host-authjs.csrf-token — beveiliging tegen vervalste verzoeken; sessie.",
          "authjs.callback-url / __Secure-authjs.callback-url — onthoudt waar je na het inloggen naartoe gaat; sessie.",
          "Lokale opslag \"noor-locale\" — je taalkeuze; tot je ze wist.",
          "Lokale opslag \"noor-cookie-consent\" — je cookiekeuze; tot je ze wijzigt of wist.",
        ],
      },
      {
        h: "3. Analytische cookies (enkel met toestemming)",
        p: [
          "Als je toestemming geeft, gebruiken we Google Analytics (Google Ireland Ltd.) om het gebruik van de website te meten, met ingekort IP-adres. Cookies: _ga en _ga_<ID>, bewaartermijn tot 2 jaar. Zonder toestemming wordt Google Analytics niet geladen.",
        ],
      },
      {
        h: "4. Cookies van derden bij betaling",
        p: ["Bij het betalen word je doorgestuurd naar Stripe. Stripe plaatst daar eigen cookies (o.a. voor fraudepreventie) volgens zijn eigen cookiebeleid."],
      },
      {
        h: "5. Je keuze beheren",
        p: ["Je kunt je keuze altijd wijzigen via \"Cookie-instellingen\" onderaan elke pagina, of cookies verwijderen via je browserinstellingen. Vragen: {EMAIL}."],
      },
    ],
  },

  legal: {
    title: "Juridische informatie",
    sections: [
      {
        h: "Uitbater",
        ul: [
          "{NAME}",
          "Maatschappelijke zetel: {ADDRESS}",
          "Ondernemingsnummer (KBO) en btw-nummer: {CBE}",
          "E-mail: {EMAIL}",
        ],
      },
      {
        h: "Documenten",
        p: ["Zie ook onze privacyverklaring, algemene voorwaarden en ons cookiebeleid (links onderaan elke pagina)."],
      },
    ],
  },
};
