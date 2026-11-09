/**
 * Het corpus voor etiketteksten.
 *
 * WAAROM DIT BESTAAT IN DEZE VORM. Zodra er een echte OCR-provider hangt,
 * kunnen er twee dingen misgaan die er van buitenaf hetzelfde uitzien:
 *
 *   1. de provider leest het etiket verkeerd  (herkenningsfout)
 *   2. wij verknoeien de tekst daarna         (normalisatie- of parsefout)
 *
 * Als een test alleen "foto in, ingrediënten uit" controleert, weet je bij een
 * rode test niet welke van de twee het was. Daarom staan hier drie lagen los
 * van elkaar:
 *
 *   rawTranscription    wat er letterlijk op de verpakking staat, inclusief
 *                       regeleindes, kopregels en rommel. Bij een echte
 *                       provider is dit de verwachte uitvoer van de provider.
 *   expectedNormalized  wat `normalizeOcrText` daarvan hoort te maken.
 *   expectedIngredients de namen die de parser eruit hoort te halen.
 *
 * Vandaag draaien laag 2 en 3: de `rawTranscription` gaat rechtstreeks de
 * normalisatie in, alsof een perfecte provider hem had gelezen. Dat betekent
 * dat deze suite de NORMALISATIE bewijst en niet de HERKENNING. Zodra er een
 * echte provider is, komt er een vierde veld bij (`imageRef`) en draait
 * dezelfde tabel met echte beelden erdoorheen; wat dan afwijkt op laag 1 is
 * een providerprobleem, wat afwijkt op laag 2 of 3 is van ons.
 *
 * GEEN BEELDMATERIAAL IN DE REPOSITORY. Verpakkingsontwerpen en etiketfoto's
 * zijn werk van anderen. De teksten hieronder zijn met de hand nagetypt naar
 * het patroon van gangbare Belgische etiketten, niet overgenomen van een
 * specifiek product. Echte testfoto's horen in lokale, private testdata.
 */

export interface OcrCorpusEntry {
  readonly id: string;
  /** Taal of talencombinatie van het etiket. */
  readonly language: "nl" | "fr" | "en" | "de" | "ar" | "nl-fr" | "fr-ar";
  /**
   * De omstandigheid die dit geval nabootst. Vandaag documentatie; zodra er
   * echte foto's zijn, is dit waarop je filtert bij een tegenvallende score.
   */
  readonly condition:
    | "flat-label"
    | "multi-column"
    | "uppercase-allergens"
    | "e-numbers"
    | "nested-ingredients"
    | "percentages"
    | "hyphenated-linebreaks"
    | "trailing-nutrition"
    | "front-of-pack";
  /** Laag 1: wat een foutloze OCR zou opleveren. */
  readonly rawTranscription: string;
  /** Laag 2: wat de normalisatie daarvan moet maken. */
  readonly expectedNormalized: string;
  /** Laag 3: de ingrediëntnamen die de parser eruit moet halen. */
  readonly expectedIngredients: readonly string[];
  /** Verwachten we dat de heuristiek hier signalen ziet? */
  readonly expectSignals: boolean;
}

export const OCR_CORPUS: readonly OcrCorpusEntry[] = [
  {
    id: "nl-koekje-plat",
    language: "nl",
    condition: "flat-label",
    rawTranscription: "Ingrediënten: tarwebloem, suiker, plantaardige olie, zout.",
    expectedNormalized: "tarwebloem, suiker, plantaardige olie, zout",
    expectedIngredients: ["tarwebloem", "suiker", "plantaardige olie", "zout"],
    expectSignals: true,
  },
  {
    id: "nl-hoofdletters-allergenen",
    language: "nl",
    condition: "uppercase-allergens",
    // Allergenen staan op etiketten in kapitalen; dat mag geen ander ingrediënt
    // worden en de hoofdletters horen bewaard te blijven in de weergave.
    rawTranscription: "INGREDIËNTEN: suiker, TARWEBLOEM, MELKpoeder, cacaomassa",
    expectedNormalized: "suiker, TARWEBLOEM, MELKpoeder, cacaomassa",
    expectedIngredients: ["suiker", "tarwebloem", "melkpoeder", "cacaomassa"],
    expectSignals: true,
  },
  {
    id: "nl-afbreking-over-regels",
    language: "nl",
    condition: "hyphenated-linebreaks",
    rawTranscription: "Ingrediënten: suiker, emul-\ngator (E322), gemodificeerd\nzetmeel, aroma",
    expectedNormalized: "suiker, emulgator (E322), gemodificeerd zetmeel, aroma",
    // De parser trekt het E-nummer uit de haakjes als eigen item. Dat is
    // gewenst: E322 moet als E-nummer tegen de referentietabel gelegd kunnen
    // worden, niet als deel van een langere naam blijven plakken.
    expectedIngredients: ["suiker", "emulgator", "e322", "gemodificeerd zetmeel", "aroma"],
    expectSignals: true,
  },
  {
    id: "nl-voedingswaarde-erachter",
    language: "nl",
    condition: "trailing-nutrition",
    rawTranscription:
      "Ingrediënten: suiker, cacaoboter, melkpoeder.\nVoedingswaarde per 100 g: energie 2200 kJ",
    expectedNormalized: "suiker, cacaoboter, melkpoeder",
    expectedIngredients: ["suiker", "cacaoboter", "melkpoeder"],
    expectSignals: true,
  },
  {
    id: "fr-percentages",
    language: "fr",
    condition: "percentages",
    rawTranscription: "Ingrédients : sucre, beurre de cacao 24%, lait en poudre 12%, lécithine",
    expectedNormalized: "sucre, beurre de cacao 24%, lait en poudre 12%, lécithine",
    // Percentages verdwijnen uit de naam (ze gaan naar quantityText) en
    // diakrieten worden afgevlakt, zodat "lécithine" en "lecithine" hetzelfde
    // referentie-item raken.
    expectedIngredients: ["sucre", "beurre de cacao", "lait en poudre", "lecithine"],
    expectSignals: true,
  },
  {
    id: "en-genest",
    language: "en",
    condition: "nested-ingredients",
    // Geneste haakjes: "chocolate (sugar, cocoa)" is één ingrediënt met
    // subingrediënten, geen drie losse.
    rawTranscription:
      "INGREDIENTS: Wheat flour, chocolate chips (sugar, cocoa mass, emulsifier: soy lecithin), butter",
    expectedNormalized:
      "Wheat flour, chocolate chips (sugar, cocoa mass, emulsifier: soy lecithin), butter",
    // Subingrediënten worden als eigen items meegenomen in plaats van
    // weggelaten. Voor halal is dat precies goed: de lecithine in de vulling
    // is even relevant als de vulling zelf.
    expectedIngredients: [
      "wheat flour",
      "chocolate chips",
      "sugar",
      "cocoa mass",
      "soy lecithin",
      "butter",
    ],
    expectSignals: true,
  },
  {
    id: "de-e-nummers",
    language: "de",
    condition: "e-numbers",
    rawTranscription: "Zutaten: Zucker, Emulgator E471, Farbstoff E120, Aroma",
    expectedNormalized: "Zucker, Emulgator E471, Farbstoff E120, Aroma",
    expectedIngredients: ["zucker", "emulgator e471", "farbstoff e120", "aroma"],
    expectSignals: true,
  },
  {
    id: "nl-fr-tweetalig",
    language: "nl-fr",
    condition: "multi-column",
    // Belgische verpakkingen zetten twee talen naast elkaar; OCR levert ze na
    // elkaar aan. Er wordt niet geprobeerd één taal weg te filteren: dat zou
    // raden zijn, en de gebruiker ziet in het controlescherm wat er staat.
    rawTranscription:
      "Ingrediënten: suiker, cacaoboter, melkpoeder\nIngrédients : sucre, beurre de cacao, lait en poudre",
    expectedNormalized:
      "suiker, cacaoboter, melkpoeder Ingrédients : sucre, beurre de cacao, lait en poudre",
    // BEKENDE ONVOLKOMENHEID. De tweede kopregel staat midden in de tekst en
    // wordt niet weggehaald (alleen een kopregel aan het begin gaat eraf), dus
    // "melkpoeder Ingrédients : sucre" wordt één ingrediënt. Onschuldig — het
    // levert een onbekend item op, geen verkeerd oordeel — maar wel rommelig.
    // Hier vastgelegd zodat het niet ongemerkt blijft; zie het Fase 5.1-rapport.
    expectedIngredients: [
      "suiker",
      "cacaoboter",
      "melkpoeder ingredients sucre",
      "beurre de cacao",
      "lait en poudre",
    ],
    expectSignals: true,
  },
  {
    id: "fr-ar-tweetalig",
    language: "fr-ar",
    condition: "multi-column",
    // Arabisch schrift van rechts naar links, in dezelfde tekst als Frans.
    // Getest wordt dat het niet verminkt raakt, niet dat we het begrijpen.
    rawTranscription: "Ingrédients : sucre, huile végétale\nالمكونات: سكر، زيت نباتي",
    expectedNormalized: "sucre, huile végétale المكونات: سكر، زيت نباتي",
    // BELANGRIJKSTE BEVINDING VAN DIT CORPUS. Het Arabische deel verdwijnt
    // volledig: `normalizeIngredientName` houdt alleen Latijns schrift over.
    // Er blijven twee Franse ingrediënten over en de analyse loopt gewoon door.
    // Op een tweetalig halal-etiket betekent dat een oordeel over de helft van
    // de lijst. Opgelost door het te MELDEN (`unsupportedScriptWarning`); het
    // écht verwerken vraagt een uitbreiding van de parser uit fase 3.
    expectedIngredients: ["sucre", "huile vegetale"],
    expectSignals: true,
  },
  {
    id: "ar-alleen",
    language: "ar",
    condition: "flat-label",
    rawTranscription: "المكونات: سكر، زبدة الكاكاو، حليب مجفف، ليسيثين الصويا",
    expectedNormalized: "المكونات: سكر، زبدة الكاكاو، حليب مجفف، ليسيثين الصويا",
    // Niets bruikbaars. Dat is hier de veilige uitkomst: `analyzeIngredientText`
    // weigert een lege lijst met NO_INGREDIENTS_PARSED in plaats van "geen
    // aandachtspunt gevonden" te melden over een tekst die niet gelezen is.
    expectedIngredients: [],
    // Arabische komma (U+060C) is geen ASCII-komma. De heuristiek ziet hier
    // dus geen scheidingsteken en de parser splitst niet. Dat is een BEKENDE
    // BEPERKING, hier vastgelegd zodat hij niet ongemerkt blijft bestaan; zie
    // het rapport bij Fase 5.1.
    expectSignals: false,
  },
  {
    id: "nl-voorkant",
    language: "nl",
    condition: "front-of-pack",
    // De klassieke vergissing: een foto van de voorkant.
    rawTranscription: "Chocolade Deluxe\nExtra melk",
    expectedNormalized: "Chocolade Deluxe Extra melk",
    expectedIngredients: ["chocolade deluxe extra melk"],
    expectSignals: false,
  },
];
