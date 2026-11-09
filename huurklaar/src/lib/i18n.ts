export const LOCALES = ["nl", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

const nl = {
  meta: {
    title: "Huurklaar · Sterker huurdossier, sneller een woning",
    desc: "Check je huurbudget, zie wat je dossier mist, laat AI elke huuradvertentie nakijken en verstuur één complete PDF. Voor huurders in België.",
  },
  nav: { dossier: "Mijn dossier", check: "Advertentie checken", matches: "Mijn matches", apps: "Kandidaturen", pricing: "Prijzen", account: "Account", login: "Inloggen", logout: "Uitloggen" },
  home: {
    eyebrow: "Voor huurders in Vlaanderen, Brussel en Wallonië",
    h1: "Win de woning met het",
    h1em: "sterkste dossier.",
    checks: ["Weet in 10 seconden of je binnen budget zit", "Laat elke advertentie nakijken op rode vlaggen", "Eén PDF met brief en bijlagen, klaar om te mailen"],
    searchPh: "Plak hier de tekst van een huuradvertentie…",
    searchBtn: "Check",
    banner: "Je papieren blijven op je eigen toestel. Geen uploads van je loonfiches of identiteitskaart.",
    featuresH: "Alles voor je zoektocht",
    howH: "Zo werkt het",
    steps: ["Vul je dossier in", "Check elke advertentie", "Solliciteer als eerste"],
    lead: "Per huurwoning dingen vaak tientallen kandidaten mee. Huurklaar zet je dossier klaar vóór het bezoek, checkt elke advertentie op rode vlaggen en schrijft je brief op maat van het pand.",
    ctaDossier: "Start je dossier, gratis",
    ctaCheck: "Check een advertentie",
    f1h: "Weet of je in budget zit",
    f1: "Makelaars vragen meestal een netto-inkomen van 3 keer huur plus kosten. Je ziet meteen of je erin zit en hoeveel huur je maximaal aankan.",
    f2h: "Plak een advertentie, krijg een oordeel",
    f2: "AI leest de advertentie en toont wat ontbreekt, wat verdacht is en welke vragen je stelt bij het bezoek.",
    f3h: "Weet wat een verhuurder niet mag vragen",
    f3: "Afkomst, geboorteplaats, de bron van je inkomen of een cash waarborg: de waakhond waarschuwt je.",
    f4h: "Eén PDF, klaar om te mailen",
    f4: "Huurders-cv, motivatiebrief en al je bijlagen in één bestand. Je documenten blijven op je eigen toestel.",
    privacyH: "Je papieren blijven bij jou",
    privacy: "Loonfiches en identiteitskaart worden niet naar onze servers gestuurd. Het dossier en de PDF worden op je eigen toestel gemaakt.",
  },
  pricing: {
    h: "Prijzen",
    free: "Gratis", freeP: "€0", freeL: ["Dossierscore en budgetcheck", "Waakhond verboden vragen", "3 advertentie-checks", "Motivatiebrief om te kopiëren"],
    dossier: "Dossier Klaar", dossierP: "€19", dossierU: "eenmalig", dossierL: ["Alles van Gratis", "Complete dossier-PDF met al je bijlagen", "Onbeperkt opnieuw exporteren"],
    zoek: "Zoekpas", zoekP: "€14,99", zoekU: "per maand, maandelijks opzegbaar", zoekL: ["Alles van Dossier Klaar", "Matches uit je eigen zoekmeldingen, gesorteerd op wat past", "Onbeperkt advertenties checken*", "Brief op maat per pand", "Opvolging van je kandidaturen"],
    fair: "* Redelijk gebruik: tot {n} checks per dag.",
    vat: "Prijzen inclusief btw.",
    buy: "Kopen", subscribe: "Neem de Zoekpas", current: "Je huidige plan", loginFirst: "Log eerst in om te betalen.",
  },
  d: {
    example: "Voorbeelddossier ingevuld. Pas alles aan naar je eigen situatie. Je gegevens worden alleen op dit toestel bewaard.",
    reset: "Wis alles",
    s1: "Het pand", fRegion: "Gewest", fRent: "Huurprijs per maand (€)", fCosts: "Gemeenschappelijke kosten (€)", fGarage: "Garage of parking (€)", fStreet: "Adres van het pand",
    s2: "Jij en je huishouden", fName: "Naam hoofdhuurder", fEmail: "E-mail", fPhone: "Telefoon", fPeople: "Aantal bewoners", fStart: "Gewenste startdatum",
    fIncome1: "Netto-inkomen huurder 1 (€)", fIncome2: "Netto-inkomen huurder 2 (€)", fIncomeOther: "Andere inkomsten (€)", fIncomeOtherH: "Bv. alimentatie, groeipakket",
    fJob: "Soort inkomen hoofdhuurder", jVast: "Vast contract", jTijd: "Tijdelijk contract / interim", jZelf: "Zelfstandige", jUitk: "Uitkering of pensioen", jStud: "Student",
    fMonths: "Maanden bij huidige werkgever", fAbout: "Over jullie (de basis van je brief)",
    s3: "Documenten",
    s3h: "Voeg je bijlagen toe (PDF, JPG of PNG). Ze worden niet geüpload: ze gaan alleen mee in je eigen PDF.",
    addFile: "Bestand toevoegen", remove: "Verwijder", tooBig: "Bestand te groot (max. 10 MB).", badType: "Alleen PDF, JPG of PNG.",
    d_id: "Kopie identiteitskaart (voorkant, rijksregisternummer afgedekt)", d_pay: "Laatste 3 loonfiches of bewijs van inkomen", d_job: "Werkgeversattest of arbeidscontract",
    d_ref: "Referentie van huidige of vorige verhuurder", d_rent: "Bewijs van stipte huurbetaling", d_ins: "Offerte brandverzekering huurder", d_guar: "Bewijs huurwaarborg klaar (geblokkeerde rekening of bankgarantie)",
    s4: "Waakhond: wat vroeg de verhuurder?", s4h: "Vink aan wat de verhuurder of het kantoor vroeg. We tonen wat mag en wat niet.",
    q_pay: "Loonfiches of bewijs van inkomen", q_id: "Naam, adres, contactgegevens", q_ref: "Referenties vorige verhuurder", q_bank: "Rekeninguittreksels",
    q_origin: "Nationaliteit of afkomst", q_birthplace: "Geboorteplaats", q_health: "Gezondheid of zwangerschap", q_rr: "Volledig rijksregisternummer vóór selectie",
    q_source: "Weigeren op bron van inkomen (bv. 'geen OCMW')", q_cash: "Waarborg cash of op rekening verhuurder",
    wBad: "Dit mag een verhuurder niet vragen of eisen", wOk: "Alles wat je aanvinkte mag gevraagd worden.", wNone: "Nog niets aangevinkt.",
    w_origin: "Afkomst en nationaliteit mogen niet meespelen in de selectie.",
    w_birthplace: "Geboorteplaats hoort niet op een kandidatuurformulier.",
    w_health: "Gezondheid of zwangerschap is geen selectiecriterium.",
    w_rr: "Je rijksregisternummer hoort pas bij het tekenen van het contract.",
    w_source: "Een verhuurder mag geen rekening houden met de bron of aard van je inkomen.",
    w_cash: "De waarborg hoort op een geblokkeerde rekening op jouw naam of via bankgarantie, niet cash of op de rekening van de verhuurder.",
    wWal: "In Wallonië mag een verhuurder uitzonderlijk extra info vragen, maar alleen met een legitiem doel en ernstige reden.",
    wAction: "Wat nu? Weiger beleefd, of meld het bij Unia (discriminatie) of je huurdersbond.",
    s5: "Je motivatiebrief", copy: "Kopieer brief", copied: "Gekopieerd.", copyFail: "Kopiëren lukte niet. Selecteer de tekst en kopieer zelf.",
    s6: "Je dossier-PDF", s6h: "Huurders-cv, brief en al je bijlagen in één bestand, op je eigen toestel gemaakt.",
    makePdf: "Maak mijn dossier-PDF", making: "PDF wordt gemaakt…", pdfDone: "Je PDF staat klaar.", downloadPdf: "Download PDF", pdfFail: "De PDF kon niet gemaakt worden. Een bijlage is mogelijk beschadigd of beveiligd met een wachtwoord.",
    locked: "De dossier-PDF hoort bij Dossier Klaar (€19 eenmalig) of de Zoekpas.", unlock: "Ontgrendel voor €19",
    scoreK: "Dossierscore", budgetK: "Budgetcheck (3x-regel)", todoK: "Nog te doen",
    bTotal: "Totale maandlast", bNeed: "Nodig netto-inkomen (3x)", bHave: "Jullie netto-inkomen", bRatio: "Verhouding", bMax: "Maximale maandlast voor jou",
    bOk: "Ruim binnen budget", bTight: "Krap, versterk je dossier", bNo: "Onder de 3x-norm",
    vTop: "Sterk dossier, je staat vooraan.", vGood: "Goed, nog een paar punten.", vMid: "Gemiddeld, je valt niet op.", vLow: "Zwak, werk eerst de lijst af.",
    t_budgetNo: "Je inkomen haalt de 3x-norm niet. Voeg een referentie, extra waarborg of borgsteller toe.",
    t_budgetTight: "Krap budget: leg een referentie van je huidige verhuurder bij.",
    t_months: "Korter dan 6 maanden in dienst: voeg je arbeidscontract toe.",
    t_about: "Schrijf minstens twee zinnen over jullie.",
    t_ok: "Alles staat klaar. Verstuur je dossier binnen het uur na het bezoek.",
    cvTitle: "Huurders-cv", cvHh: "Huishouden", cvPersons: "bewoner(s)", cvIncome: "Netto-inkomen", cvRatio: "Inkomen / maandlast", cvStart: "Beschikbaar vanaf", cvJob: "Inkomen", cvDocs: "Bijlagen", cvContact: "Contact", cvFor: "Kandidatuur voor",
    kind: "woning",
    jobLines: {
      vast: "De hoofdhuurder werkt met een vast contract, al {m} maanden bij dezelfde werkgever.",
      tijd: "De hoofdhuurder werkt met een tijdelijk contract, sinds {m} maanden.",
      zelf: "De hoofdhuurder is zelfstandige; recente aanslagbiljetten zijn beschikbaar.",
      uitk: "Ons inkomen bestaat uit een vaste uitkering of pensioen.",
      stud: "De hoofdhuurder is student.",
    },
    letter: `Beste verhuurder,

Met veel interesse heb ik uw {kind} aan {address} bekeken. Graag stel ik mij kandidaat als huurder vanaf {start}.

{about}

Wij zijn met {people} {peopleWord}. Ons gezamenlijk netto-inkomen bedraagt €{income} per maand, dat is {ratio} keer de totale maandlast van €{total}. {jobLine}

{docsLine}

Ik bezorg u graag bijkomende informatie en kom op elk moment langs voor een gesprek.

Met vriendelijke groeten,
{name}`,
    person: "persoon", persons: "personen",
    docsYes: "In bijlage vindt u: {list}.", docsNo: "De nodige documenten bezorg ik u op eenvoudige vraag.",
  },
  c: {
    h: "Advertentie checken",
    lead: "Plak de tekst van een huuradvertentie (Immoweb, Zimmo, Facebook, …). Je krijgt binnen enkele seconden een oordeel.",
    paste: "Tekst van de advertentie",
    pastePh: "Plak hier de volledige advertentietekst: prijs, kosten, beschrijving, voorwaarden…",
    useDossier: "Gebruik mijn budget uit het dossier",
    run: "Check deze advertentie", running: "Bezig met lezen…",
    left: "Nog {n} gratis checks.", unlimited: "Zoekpas actief.",
    needLogin: "Log in om advertenties te checken. Je eerste {n} checks zijn gratis.",
    outOfFree: "Je gratis checks zijn op. Met de Zoekpas check je onbeperkt.",
    dayLimit: "Je hebt vandaag je limiet bereikt. Morgen kan je verder.",
    tooShort: "Plak minstens een paar zinnen uit de advertentie.",
    fail: "De check lukte niet. Probeer het over een minuut opnieuw.",
    summary: "Samenvatting", price: "Prijs volgens de advertentie", rent: "Huur", costs: "Kosten", total: "Totaal per maand", unknown: "niet vermeld",
    budget: "Jouw budget", flags: "Rode vlaggen", noFlags: "Geen rode vlaggen gevonden in de tekst.", missing: "Ontbreekt in de advertentie", questions: "Vraag dit bij het bezoek",
    scam: "Risico op oplichting", scamLow: "Laag", scamMed: "Gemiddeld", scamHigh: "Hoog",
    letterH: "Opening voor je brief", letterHint: "Plak deze alinea bovenaan je motivatiebrief.",
    sev: { high: "Ernstig", medium: "Let op", low: "Klein" },
    disclaimer: "Dit is een automatische analyse van de tekst, geen juridisch advies. Controleer belangrijke punten altijd zelf bij de verhuurder.",
  },
  m: {
    h: "Mijn matches",
    lead: "Stuur je zoekmeldingen van Immoweb, Zimmo of Immovlan door naar je persoonlijke Huurklaar-adres. Wij tonen alleen de panden die bij jou passen, met de beste bovenaan.",
    locked: "Matches horen bij de Zoekpas.",
    addrH: "Jouw doorstuuradres", addrHint: "Houd dit adres voor jezelf. Wie het kent, kan je meldingen sturen.", copyAddr: "Kopieer adres", copied: "Gekopieerd.",
    howH: "Zo stel je het in (5 minuten)",
    how: [
      "Maak op Immoweb, Zimmo of Immovlan een zoekopdracht met e-mailmeldingen. Zet die iets ruimer dan je zoekprofiel hieronder.",
      "Gmail: Instellingen › Alle instellingen › Doorsturen en POP/IMAP › Een doorstuuradres toevoegen. Plak je Huurklaar-adres.",
      "Gmail stuurt een bevestigingscode naar dat adres. Die verschijnt hieronder op deze pagina. Vul ze in bij Gmail.",
      "Maak een filter (bv. afzender bevat immoweb.be) dat alleen deze meldingen doorstuurt. Zo komt de rest van je mail nooit bij ons.",
      "Outlook: Instellingen › E-mail › Regels › Nieuwe regel: afzender bevat immoweb.be › Doorsturen naar je Huurklaar-adres.",
    ],
    verifyH: "Bevestigingsmail ontvangen", verifyHint: "Gebruik de code of link hieronder om het doorsturen te bevestigen.",
    lastMail: "Laatste melding ontvangen: {d}", noMail: "Nog geen meldingen ontvangen.",
    profileH: "Wat zoek je?", maxMonthly: "Maximale maandlast (huur + kosten, €)", maxHint: "Tip: je maximum uit de budgetcheck is € {n}.",
    places: "Gemeenten of postcodes", placesHint: "Gescheiden door komma's, bv. Berchem, 2600, Mortsel", bedrooms: "Minimaal aantal slaapkamers", pets: "Ik heb een huisdier",
    save: "Bewaar en herbereken", saved: "Bewaard. Je matches zijn herberekend.",
    listH: "Panden die passen", empty: "Nog geen matches. Zodra er een melding binnenkomt, verschijnen de passende panden hier.",
    showAll: "Toon ook panden die niet passen", hideAll: "Verberg panden die niet passen",
    open: "Bekijk zoekertje", check: "Check advertentie", applied: "Ik heb gesolliciteerd", dismiss: "Niet interessant", undo: "Terugzetten",
    perMonth: "/ maand", rooms: "slpk", score: "Match",
    r: {
      budget_ok: "Binnen je budget", budget_tight: "Net binnen je budget", budget_over: "Boven je budget", budget_unknown: "Prijs onbekend",
      area_ok: "In je zoekgebied", area_other: "Buiten je zoekgebied", area_unknown: "Ligging onduidelijk",
      bedrooms_ok: "Genoeg slaapkamers", bedrooms_low: "Te weinig slaapkamers", bedrooms_unknown: "Slaapkamers onbekend",
      pets_no: "Geen huisdieren toegelaten", pets_unknown: "Huisdieren: navragen",
    },
  },
  k: {
    h: "Kandidaturen",
    lead: "Houd bij waar je solliciteerde en wanneer je opnieuw moet aankloppen.",
    locked: "De opvolging van kandidaturen hoort bij de Zoekpas.",
    add: "Kandidatuur toevoegen", title: "Pand (adres of titel)", url: "Link (optioneel)", note: "Notitie", status: "Status", appliedOn: "Gesolliciteerd op", next: "Opvolgen op",
    save: "Toevoegen", del: "Verwijder", confirmDel: "Zeker verwijderen?", yes: "Ja, verwijder", no: "Annuleer",
    empty: "Nog geen kandidaturen. Voeg er een toe, of klik bij een match op 'Ik heb gesolliciteerd'.",
    due: "Tijd om op te volgen", dueHint: "Geen antwoord gekregen? Stuur een korte, vriendelijke herinnering en bevestig dat je nog interesse hebt.",
    s: { visit: "Bezoek gepland", sent: "Dossier verstuurd", waiting: "Wacht op antwoord", accepted: "Aanvaard", rejected: "Afgewezen", withdrawn: "Ingetrokken" },
    countOpen: "{n} lopend", countDue: "{n} op te volgen",
  },
  a: {
    h: "Account", plan: "Plan", planFree: "Gratis", planDossier: "Dossier Klaar", planZoek: "Zoekpas", renew: "Verlengt op {d}", ends: "Loopt af op {d}",
    manage: "Beheer abonnement en facturen", checksUsed: "Advertentie-checks gebruikt", thanks: "Bedankt! Je betaling is ontvangen. Het kan een paar seconden duren voor je plan zichtbaar is.",
    deleteH: "Account verwijderen", deleteP: "Stuur een mail naar privacy@huurklaar.be vanaf dit adres. We verwijderen je account en gegevens binnen 30 dagen.",
  },
  l: {
    h: "Inloggen", lead: "Geen wachtwoord nodig. Je krijgt een link in je mailbox.", email: "E-mailadres", send: "Stuur me een inloglink",
    sent: "Check je mailbox. Klik op de link om in te loggen.", fail: "Versturen lukte niet. Controleer je e-mailadres en probeer opnieuw.",
    consent: "Door in te loggen ga je akkoord met de voorwaarden en het privacybeleid.",
  },
  f: { privacy: "Privacy", terms: "Voorwaarden", company: "Huurklaar is een dienst van Marhaba Cooperation BV · BE 1037.222.285", noLegal: "Huurklaar geeft geen juridisch advies." },
  err: { generic: "Er ging iets mis. Probeer het opnieuw.", notFound: "Deze pagina bestaat niet." },
  regions: { VL: "Vlaanderen", BXL: "Brussel", WAL: "Wallonië" },
};

export type Dict = typeof nl;

const fr: Dict = {
  meta: {
    title: "Huurklaar · Un dossier de location plus fort, un logement plus vite",
    desc: "Vérifiez votre budget, voyez ce qui manque à votre dossier, faites analyser chaque annonce par l'IA et envoyez un seul PDF complet. Pour les locataires en Belgique.",
  },
  nav: { dossier: "Mon dossier", check: "Vérifier une annonce", matches: "Mes matches", apps: "Candidatures", pricing: "Tarifs", account: "Compte", login: "Connexion", logout: "Déconnexion" },
  home: {
    eyebrow: "Pour les locataires en Flandre, à Bruxelles et en Wallonie",
    h1: "Décrochez le logement avec le",
    h1em: "meilleur dossier.",
    checks: ["Sachez en 10 secondes si vous êtes dans le budget", "Faites vérifier chaque annonce", "Un seul PDF avec lettre et annexes, prêt à envoyer"],
    searchPh: "Collez ici le texte d'une annonce de location…",
    searchBtn: "Vérifier",
    banner: "Vos papiers restent sur votre appareil. Pas d'envoi de vos fiches de paie ni de votre carte d'identité.",
    featuresH: "Tout pour votre recherche",
    howH: "Comment ça marche",
    steps: ["Remplissez votre dossier", "Vérifiez chaque annonce", "Postulez en premier"],
    lead: "Pour un logement à louer, les candidats se comptent souvent par dizaines. Huurklaar prépare votre dossier avant la visite, vérifie chaque annonce et rédige votre lettre sur mesure.",
    ctaDossier: "Commencer mon dossier, gratuit",
    ctaCheck: "Vérifier une annonce",
    f1h: "Sachez si vous êtes dans le budget",
    f1: "Les agences demandent généralement un revenu net de 3 fois le loyer et les charges. Vous voyez immédiatement où vous en êtes et quel loyer maximum vous pouvez viser.",
    f2h: "Collez une annonce, obtenez un avis",
    f2: "L'IA lit l'annonce et montre ce qui manque, ce qui est suspect et quelles questions poser à la visite.",
    f3h: "Sachez ce qu'un bailleur ne peut pas demander",
    f3: "Origine, lieu de naissance, source de vos revenus ou garantie en liquide : le vigile vous avertit.",
    f4h: "Un seul PDF, prêt à envoyer",
    f4: "CV de locataire, lettre de motivation et toutes vos annexes en un fichier. Vos documents restent sur votre appareil.",
    privacyH: "Vos papiers restent chez vous",
    privacy: "Fiches de paie et carte d'identité ne sont pas envoyées à nos serveurs. Le dossier et le PDF sont créés sur votre propre appareil.",
  },
  pricing: {
    h: "Tarifs",
    free: "Gratuit", freeP: "0 €", freeL: ["Score du dossier et contrôle du budget", "Vigile questions interdites", "3 vérifications d'annonces", "Lettre de motivation à copier"],
    dossier: "Dossier Prêt", dossierP: "19 €", dossierU: "paiement unique", dossierL: ["Tout le plan Gratuit", "PDF complet du dossier avec toutes vos annexes", "Exports illimités"],
    zoek: "Pass Recherche", zoekP: "14,99 €", zoekU: "par mois, résiliable chaque mois", zoekL: ["Tout Dossier Prêt", "Matches issus de vos propres alertes, triés selon ce qui vous convient", "Vérifications d'annonces illimitées*", "Lettre sur mesure par bien", "Suivi de vos candidatures"],
    fair: "* Usage raisonnable : jusqu'à {n} vérifications par jour.",
    vat: "Prix TVA comprise.",
    buy: "Acheter", subscribe: "Prendre le Pass Recherche", current: "Votre plan actuel", loginFirst: "Connectez-vous d'abord pour payer.",
  },
  d: {
    example: "Dossier d'exemple pré-rempli. Adaptez tout à votre situation. Vos données sont conservées uniquement sur cet appareil.",
    reset: "Tout effacer",
    s1: "Le bien", fRegion: "Région", fRent: "Loyer mensuel (€)", fCosts: "Charges communes (€)", fGarage: "Garage ou parking (€)", fStreet: "Adresse du bien",
    s2: "Vous et votre ménage", fName: "Nom du locataire principal", fEmail: "E-mail", fPhone: "Téléphone", fPeople: "Nombre d'occupants", fStart: "Date d'entrée souhaitée",
    fIncome1: "Revenu net locataire 1 (€)", fIncome2: "Revenu net locataire 2 (€)", fIncomeOther: "Autres revenus (€)", fIncomeOtherH: "P. ex. pension alimentaire, allocations familiales",
    fJob: "Type de revenu du locataire principal", jVast: "CDI", jTijd: "CDD / intérim", jZelf: "Indépendant", jUitk: "Allocation ou pension", jStud: "Étudiant",
    fMonths: "Mois chez l'employeur actuel", fAbout: "À propos de vous (base de votre lettre)",
    s3: "Documents",
    s3h: "Ajoutez vos annexes (PDF, JPG ou PNG). Elles ne sont pas envoyées en ligne : elles sont seulement intégrées à votre propre PDF.",
    addFile: "Ajouter un fichier", remove: "Retirer", tooBig: "Fichier trop volumineux (max. 10 Mo).", badType: "Uniquement PDF, JPG ou PNG.",
    d_id: "Copie de la carte d'identité (recto, numéro national masqué)", d_pay: "3 dernières fiches de paie ou preuve de revenus", d_job: "Attestation d'employeur ou contrat de travail",
    d_ref: "Référence du bailleur actuel ou précédent", d_rent: "Preuve de paiement ponctuel du loyer", d_ins: "Offre d'assurance incendie locataire", d_guar: "Garantie locative prête (compte bloqué ou garantie bancaire)",
    s4: "Vigilance : qu'a demandé le bailleur ?", s4h: "Cochez ce que le bailleur ou l'agence a demandé. Nous indiquons ce qui est permis ou non.",
    q_pay: "Fiches de paie ou preuve de revenus", q_id: "Nom, adresse, coordonnées", q_ref: "Références de l'ancien bailleur", q_bank: "Extraits de compte",
    q_origin: "Nationalité ou origine", q_birthplace: "Lieu de naissance", q_health: "Santé ou grossesse", q_rr: "Numéro national complet avant sélection",
    q_source: "Refus selon la source du revenu (p. ex. « pas de CPAS »)", q_cash: "Garantie en liquide ou sur le compte du bailleur",
    wBad: "Un bailleur ne peut pas demander ou exiger ceci", wOk: "Tout ce que vous avez coché peut être demandé.", wNone: "Rien coché pour l'instant.",
    w_origin: "L'origine et la nationalité ne peuvent pas jouer dans la sélection.",
    w_birthplace: "Le lieu de naissance n'a pas sa place sur un formulaire de candidature.",
    w_health: "La santé ou la grossesse n'est pas un critère de sélection.",
    w_rr: "Le numéro national n'est demandé qu'à la signature du bail.",
    w_source: "Le bailleur ne peut pas tenir compte de la source ou de la nature de vos revenus.",
    w_cash: "La garantie se place sur un compte bloqué à votre nom ou via garantie bancaire, pas en liquide ni sur le compte du bailleur.",
    wWal: "En Wallonie, le bailleur peut exceptionnellement demander d'autres informations, uniquement avec un but légitime et des raisons sérieuses.",
    wAction: "Et maintenant ? Refusez poliment, ou signalez-le à Unia (discrimination) ou à votre syndicat de locataires.",
    s5: "Votre lettre de motivation", copy: "Copier la lettre", copied: "Copié.", copyFail: "La copie a échoué. Sélectionnez le texte et copiez-le vous-même.",
    s6: "Votre PDF de dossier", s6h: "CV de locataire, lettre et toutes vos annexes en un fichier, créé sur votre appareil.",
    makePdf: "Créer mon PDF de dossier", making: "Création du PDF…", pdfDone: "Votre PDF est prêt.", downloadPdf: "Télécharger le PDF", pdfFail: "Le PDF n'a pas pu être créé. Une annexe est peut-être endommagée ou protégée par un mot de passe.",
    locked: "Le PDF du dossier fait partie de Dossier Prêt (19 € une fois) ou du Pass Recherche.", unlock: "Débloquer pour 19 €",
    scoreK: "Score du dossier", budgetK: "Contrôle budget (règle 3x)", todoK: "Encore à faire",
    bTotal: "Charge mensuelle totale", bNeed: "Revenu net requis (3x)", bHave: "Votre revenu net", bRatio: "Rapport", bMax: "Charge mensuelle maximale pour vous",
    bOk: "Largement dans le budget", bTight: "Juste, renforcez votre dossier", bNo: "Sous la norme 3x",
    vTop: "Dossier solide, vous êtes en tête.", vGood: "Bien, encore quelques points.", vMid: "Moyen, vous ne vous démarquez pas.", vLow: "Faible, complétez d'abord la liste.",
    t_budgetNo: "Votre revenu n'atteint pas la norme 3x. Ajoutez une référence, une garantie supplémentaire ou un garant.",
    t_budgetTight: "Budget serré : joignez une référence de votre bailleur actuel.",
    t_months: "Moins de 6 mois en poste : ajoutez votre contrat de travail.",
    t_about: "Écrivez au moins deux phrases sur vous.",
    t_ok: "Tout est prêt. Envoyez votre dossier dans l'heure qui suit la visite.",
    cvTitle: "CV de locataire", cvHh: "Ménage", cvPersons: "occupant(s)", cvIncome: "Revenu net", cvRatio: "Revenu / charge mensuelle", cvStart: "Disponible à partir de", cvJob: "Revenu", cvDocs: "Annexes", cvContact: "Contact", cvFor: "Candidature pour",
    kind: "logement",
    jobLines: {
      vast: "Le locataire principal travaille en CDI, depuis {m} mois chez le même employeur.",
      tijd: "Le locataire principal travaille sous contrat temporaire depuis {m} mois.",
      zelf: "Le locataire principal est indépendant ; les derniers avertissements-extraits de rôle sont disponibles.",
      uitk: "Nos revenus proviennent d'une allocation ou d'une pension fixe.",
      stud: "Le locataire principal est étudiant.",
    },
    letter: `Madame, Monsieur,

C'est avec grand intérêt que j'ai visité votre {kind} situé {address}. Je souhaite poser ma candidature comme locataire à partir de {start}.

{about}

Nous sommes {people} {peopleWord}. Notre revenu net commun s'élève à {income} € par mois, soit {ratio} fois la charge mensuelle totale de {total} €. {jobLine}

{docsLine}

Je vous fournis volontiers toute information complémentaire et reste disponible pour un entretien.

Veuillez agréer mes salutations distinguées,
{name}`,
    person: "personne", persons: "personnes",
    docsYes: "Vous trouverez en annexe : {list}.", docsNo: "Je vous transmets les documents nécessaires sur simple demande.",
  },
  c: {
    h: "Vérifier une annonce",
    lead: "Collez le texte d'une annonce de location (Immoweb, Zimmo, Facebook, …). Vous obtenez un avis en quelques secondes.",
    paste: "Texte de l'annonce",
    pastePh: "Collez ici le texte complet de l'annonce : prix, charges, description, conditions…",
    useDossier: "Utiliser le budget de mon dossier",
    run: "Vérifier cette annonce", running: "Lecture en cours…",
    left: "Encore {n} vérifications gratuites.", unlimited: "Pass Recherche actif.",
    needLogin: "Connectez-vous pour vérifier des annonces. Vos {n} premières vérifications sont gratuites.",
    outOfFree: "Vos vérifications gratuites sont épuisées. Avec le Pass Recherche, c'est illimité.",
    dayLimit: "Vous avez atteint la limite du jour. Vous pourrez continuer demain.",
    tooShort: "Collez au moins quelques phrases de l'annonce.",
    fail: "La vérification a échoué. Réessayez dans une minute.",
    summary: "Résumé", price: "Prix selon l'annonce", rent: "Loyer", costs: "Charges", total: "Total par mois", unknown: "non mentionné",
    budget: "Votre budget", flags: "Signaux d'alerte", noFlags: "Aucun signal d'alerte trouvé dans le texte.", missing: "Manque dans l'annonce", questions: "À demander à la visite",
    scam: "Risque d'arnaque", scamLow: "Faible", scamMed: "Moyen", scamHigh: "Élevé",
    letterH: "Ouverture pour votre lettre", letterHint: "Collez ce paragraphe en haut de votre lettre de motivation.",
    sev: { high: "Grave", medium: "Attention", low: "Mineur" },
    disclaimer: "Ceci est une analyse automatique du texte, pas un avis juridique. Vérifiez toujours les points importants auprès du bailleur.",
  },
  m: {
    h: "Mes matches",
    lead: "Transférez vos alertes Immoweb, Zimmo ou Immovlan vers votre adresse Huurklaar personnelle. Nous n'affichons que les biens qui vous conviennent, les meilleurs en premier.",
    locked: "Les matches font partie du Pass Recherche.",
    addrH: "Votre adresse de transfert", addrHint: "Gardez cette adresse pour vous. Quiconque la connaît peut vous envoyer des alertes.", copyAddr: "Copier l'adresse", copied: "Copié.",
    howH: "Configuration (5 minutes)",
    how: [
      "Sur Immoweb, Zimmo ou Immovlan, créez une recherche avec alertes e-mail. Faites-la un peu plus large que votre profil ci-dessous.",
      "Gmail : Paramètres › Voir tous les paramètres › Transfert et POP/IMAP › Ajouter une adresse de transfert. Collez votre adresse Huurklaar.",
      "Gmail envoie un code de confirmation à cette adresse. Il apparaît ci-dessous sur cette page. Saisissez-le dans Gmail.",
      "Créez un filtre (p. ex. expéditeur contient immoweb.be) qui ne transfère que ces alertes. Le reste de votre courrier ne nous parvient jamais.",
      "Outlook : Paramètres › Courrier › Règles › Nouvelle règle : expéditeur contient immoweb.be › Transférer à votre adresse Huurklaar.",
    ],
    verifyH: "E-mail de confirmation reçu", verifyHint: "Utilisez le code ou le lien ci-dessous pour confirmer le transfert.",
    lastMail: "Dernière alerte reçue : {d}", noMail: "Aucune alerte reçue pour l'instant.",
    profileH: "Que cherchez-vous ?", maxMonthly: "Charge mensuelle maximale (loyer + charges, €)", maxHint: "Astuce : votre maximum selon le contrôle budget est de {n} €.",
    places: "Communes ou codes postaux", placesHint: "Séparés par des virgules, p. ex. Ixelles, 1050, Etterbeek", bedrooms: "Nombre minimum de chambres", pets: "J'ai un animal",
    save: "Enregistrer et recalculer", saved: "Enregistré. Vos matches ont été recalculés.",
    listH: "Biens qui correspondent", empty: "Pas encore de matches. Dès qu'une alerte arrive, les biens qui vous conviennent apparaissent ici.",
    showAll: "Afficher aussi les biens qui ne correspondent pas", hideAll: "Masquer les biens qui ne correspondent pas",
    open: "Voir l'annonce", check: "Vérifier l'annonce", applied: "J'ai postulé", dismiss: "Pas intéressant", undo: "Rétablir",
    perMonth: "/ mois", rooms: "ch.", score: "Match",
    r: {
      budget_ok: "Dans votre budget", budget_tight: "Juste dans votre budget", budget_over: "Au-dessus de votre budget", budget_unknown: "Prix inconnu",
      area_ok: "Dans votre zone", area_other: "Hors de votre zone", area_unknown: "Localisation floue",
      bedrooms_ok: "Assez de chambres", bedrooms_low: "Pas assez de chambres", bedrooms_unknown: "Chambres inconnues",
      pets_no: "Animaux non admis", pets_unknown: "Animaux : à demander",
    },
  },
  k: {
    h: "Candidatures",
    lead: "Suivez où vous avez postulé et quand relancer.",
    locked: "Le suivi des candidatures fait partie du Pass Recherche.",
    add: "Ajouter une candidature", title: "Bien (adresse ou titre)", url: "Lien (facultatif)", note: "Note", status: "Statut", appliedOn: "Postulé le", next: "Relancer le",
    save: "Ajouter", del: "Supprimer", confirmDel: "Vraiment supprimer ?", yes: "Oui, supprimer", no: "Annuler",
    empty: "Aucune candidature. Ajoutez-en une, ou cliquez sur « J'ai postulé » sur un match.",
    due: "À relancer", dueHint: "Pas de réponse ? Envoyez un court rappel aimable et confirmez votre intérêt.",
    s: { visit: "Visite prévue", sent: "Dossier envoyé", waiting: "En attente", accepted: "Accepté", rejected: "Refusé", withdrawn: "Retiré" },
    countOpen: "{n} en cours", countDue: "{n} à relancer",
  },
  a: {
    h: "Compte", plan: "Plan", planFree: "Gratuit", planDossier: "Dossier Prêt", planZoek: "Pass Recherche", renew: "Renouvellement le {d}", ends: "Se termine le {d}",
    manage: "Gérer l'abonnement et les factures", checksUsed: "Vérifications d'annonces utilisées", thanks: "Merci ! Votre paiement est reçu. Votre plan peut mettre quelques secondes à apparaître.",
    deleteH: "Supprimer le compte", deleteP: "Envoyez un e-mail à privacy@huurklaar.be depuis cette adresse. Nous supprimons votre compte et vos données dans les 30 jours.",
  },
  l: {
    h: "Connexion", lead: "Pas de mot de passe. Vous recevez un lien par e-mail.", email: "Adresse e-mail", send: "Envoyez-moi un lien de connexion",
    sent: "Consultez votre boîte mail et cliquez sur le lien pour vous connecter.", fail: "L'envoi a échoué. Vérifiez votre adresse et réessayez.",
    consent: "En vous connectant, vous acceptez les conditions et la politique de confidentialité.",
  },
  f: { privacy: "Confidentialité", terms: "Conditions", company: "Huurklaar est un service de Marhaba Cooperation BV · BE 1037.222.285", noLegal: "Huurklaar ne donne pas d'avis juridique." },
  err: { generic: "Une erreur est survenue. Réessayez.", notFound: "Cette page n'existe pas." },
  regions: { VL: "Flandre", BXL: "Bruxelles", WAL: "Wallonie" },
};

export const dicts: Record<Locale, Dict> = { nl, fr };
export function getDict(l: Locale): Dict {
  return dicts[l];
}

/** Vult {sleutel}-plaatshouders in. */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function money(n: number, l: Locale): string {
  return new Intl.NumberFormat(l === "fr" ? "fr-BE" : "nl-BE", { maximumFractionDigits: 0 }).format(n);
}
export function decimal(n: number, l: Locale, digits = 1): string {
  return new Intl.NumberFormat(l === "fr" ? "fr-BE" : "nl-BE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}
