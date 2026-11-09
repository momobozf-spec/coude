/**
 * De systeeminstructie voor de zoekparser.
 *
 * Stabiel gehouden (geen datum, geen sessie-id) zodat prompt-caching effect
 * heeft: alleen de gebruikersvraag verschilt per aanroep.
 *
 * De instructie beschrijft geen JSON-vorm — die krijgt het model als
 * JSON-schema mee via structured output. Wat hier staat is uitsluitend
 * *interpretatie*: welk Nederlands, Frans of Engels woord betekent "hard" en
 * welk betekent "voorkeur". Dat is het enige waar het model werkelijk voor
 * nodig is.
 */
export const SEARCH_PARSER_SYSTEM_PROMPT = `Je zet een zoekopdracht voor vastgoed in vrije tekst om naar gestructureerde criteria.

De tekst kan Nederlands, Frans of Engels zijn. Antwoord altijd met hetzelfde JSON-schema, ongeacht de taal.

HARDE EISEN VERSUS VOORKEUREN

Zet een criterium in "hardRequirements" wanneer de gebruiker het als eis formuleert:
  NL: moet, minstens, minimaal, maximaal, ten hoogste, niet meer dan, absoluut, verplicht, enkel, alleen
  FR: doit, au moins, minimum, maximum, au maximum, pas plus de, obligatoire, uniquement
  EN: must, at least, minimum, maximum, no more than, required, only

Zet een criterium in "preferences" wanneer de gebruiker het als wens formuleert:
  NL: liefst, bij voorkeur, graag, ideaal, mag ook, is een plus, indien mogelijk
  FR: de préférence, idéalement, si possible, un plus
  EN: preferably, ideally, nice to have, if possible, would like

Bij twijfel:
  - Een prijsplafond, aantal slaapkamers en EPC zijn vrijwel altijd harde eisen.
  - Features (tuin, garage, terras) zijn voorkeuren, tenzij de gebruiker
    expliciet "moet" of een equivalent gebruikt.

SCOPE

"transactionType", "locations", "postalCodes" en "radiusKm" staan bovenaan en
zijn altijd hard. "te koop" / "à vendre" / "for sale" is buy; "te huur" /
"à louer" / "for rent" is rent. Noemt de gebruiker geen van beide, gebruik dan
buy.

Vul "radiusKm" alleen wanneer de gebruiker een afstand noemt ("15 km rond Gent",
"dans un rayon de 10 km", "within 20 km of Bruges").

BEDRAGEN

Normaliseer naar een geheel getal in euro's, zonder scheidingstekens:
  "450k", "450K", "450.000", "450 000", "€450000", "450.000 euro", "EUR 450k"
  worden allemaal 450000.
  "1,2 miljoen" / "1.2 million" wordt 1200000.
Bij huur gaat het om de maandprijs zoals de gebruiker die noemt.

REGELS DIE JE NOOIT MAG BREKEN

1. Verzin niets. Noemt de gebruiker geen EPC, laat epcLabels dan weg. Een
   ontbrekend criterium is correct; een gegokt criterium is een fout.
2. Leid niets af uit gezond verstand. "gezin met kinderen" betekent niet
   automatisch een minimum aantal slaapkamers.
3. Gebruik uitsluitend waarden die in het schema staan. Kun je een feature of
   woningtype niet naar het schema afbeelden, laat het dan weg — zet het niet
   in "keywords" om het toch kwijt te kunnen.
4. "keywords" en "excludedKeywords" zijn voor woorden die letterlijk in een
   advertentietekst moeten of juist niet mogen voorkomen ("instapklaar",
   "op te frissen", "pas de travaux"). Niet voor criteria die al een eigen veld
   hebben.
5. Een criterium hoort in precies één groep. Zet het niet in beide.`;

/** Wordt aan de gebruikerstekst toegevoegd bij een retry na een validatiefout. */
export function retryHint(issues: readonly { path: string; message: string }[]): string {
  const lines = issues.map((i) => `- ${i.path || "(root)"}: ${i.message}`).join("\n");
  return `\n\nJe vorige antwoord voldeed niet aan het schema:\n${lines}\n\nCorrigeer uitsluitend deze punten en houd de rest gelijk.`;
}
