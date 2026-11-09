import type {
  ConfidenceLevel,
  HalalStatus,
  IngredientCategory,
  OriginRisk,
} from "@prisma/client";
import { SOURCE_KEYS } from "./sources";

/**
 * Ingredienten-seeddataset - TECHNISCHE DEMO, geen volledige religieuze
 * autoriteit. Zie prisma/seed-data/e-numbers.ts voor dezelfde disclaimer.
 *
 * `aliases` bevat vertalingen en schrijfwijzen; de seed normaliseert ze met
 * normalizeIngredientName() voordat ze worden opgeslagen, zodat de matching in
 * de rules engine exact dezelfde sleutel gebruikt.
 */
export interface SeedIngredient {
  name: string;
  description: string;
  category: IngredientCategory;
  defaultStatus: HalalStatus;
  defaultConfidence: ConfidenceLevel;
  originRisk: OriginRisk;
  aliases: string[];
  /** Koppelt het ingredient aan een E-nummer uit seedENumbers. */
  eNumberCode?: string;
  sourceKeys: string[];
}

const INTERNAL = [SOURCE_KEYS.INTERNAL_RULES];

export const seedIngredients: SeedIngredient[] = [
  // --- Expliciet haram -----------------------------------------------------
  {
    name: "Varkensvlees",
    description: "Vlees van het varken.",
    category: "ANIMAL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["pork", "porc", "schweinefleisch", "varken", "varkensvlees", "porcine"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Reuzel (varkensvet)",
    description: "Uitgesmolten vet van het varken.",
    category: "ANIMAL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["lard", "reuzel", "varkensvet", "saindoux", "schweineschmalz", "pork fat"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Varkensgelatine",
    description: "Gelatine gewonnen uit huid of botten van het varken.",
    category: "ANIMAL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: [
      "porcine gelatin",
      "porcine gelatine",
      "varkensgelatine",
      "gelatine varken",
      "pork gelatin",
      "gelatine de porc",
      "schweinegelatine",
    ],
    sourceKeys: INTERNAL,
  },
  {
    name: "Spek / bacon",
    description: "Gezouten of gerookt buikspek van het varken.",
    category: "ANIMAL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["bacon", "spek", "pancetta", "lardons"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Bloed / bloedplasma",
    description: "Dierlijk bloed of daaruit gewonnen plasma-eiwit.",
    category: "ANIMAL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["blood", "bloed", "bloedplasma", "blood plasma", "blutplasma", "black pudding"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Ethanol (alcohol als ingredient)",
    description:
      "Ethylalcohol die als zelfstandig ingredient of oplosmiddel is toegevoegd.",
    category: "ALCOHOL",
    defaultStatus: "HARAM",
    defaultConfidence: "MEDIUM",
    originRisk: "ALCOHOL_RELATED",
    aliases: ["ethanol", "ethylalcohol", "ethyl alcohol", "alcool ethylique"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Wijn",
    description: "Gegiste druivendrank, ook als kookwijn of in sauzen.",
    category: "ALCOHOL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ALCOHOL_RELATED",
    aliases: ["wijn", "wine", "vin", "wein", "witte wijn", "rode wijn", "kookwijn"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Bier",
    description: "Gegiste graandrank.",
    category: "ALCOHOL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ALCOHOL_RELATED",
    aliases: ["bier", "beer", "biere", "ale"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Rum",
    description: "Gedistilleerde drank uit suikerriet, vaak in banket en vullingen.",
    category: "ALCOHOL",
    defaultStatus: "HARAM",
    defaultConfidence: "HIGH",
    originRisk: "ALCOHOL_RELATED",
    aliases: ["rum", "rhum", "rumaroma"],
    sourceKeys: INTERNAL,
  },

  // --- Twijfelachtig (mushbooh) -------------------------------------------
  {
    name: "Gelatine (bron niet vermeld)",
    description:
      "Geleermiddel uit dierlijk collageen. Zonder bronvermelding is niet vast te stellen van welk dier de gelatine afkomstig is.",
    category: "ANIMAL",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["gelatine", "gelatin", "gelatina", "gelifiant gelatine", "speisegelatine"],
    eNumberCode: "E441",
    sourceKeys: INTERNAL,
  },
  {
    name: "Rundergelatine",
    description: "Gelatine uit huid of botten van het rund.",
    category: "ANIMAL",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "MEDIUM",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["rundergelatine", "bovine gelatin", "beef gelatin", "gelatine rund", "rindergelatine"],
    eNumberCode: "E441",
    sourceKeys: INTERNAL,
  },
  {
    name: "Dierlijk vet (soort niet vermeld)",
    description: "Vet van niet nader genoemde dierlijke oorsprong.",
    category: "ANIMAL",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["dierlijk vet", "animal fat", "graisse animale", "tierisches fett", "dierlijke vetten"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Stremsel",
    description:
      "Enzympreparaat voor kaasbereiding. Kan uit kalfsmagen komen, of microbieel/plantaardig geproduceerd zijn.",
    category: "ANIMAL",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_POSSIBLE",
    aliases: ["stremsel", "rennet", "presure", "lab", "chymosine", "dierlijk stremsel"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Wei / weipoeder",
    description:
      "Bijproduct van kaasbereiding. De halal-vraag zit niet in de wei zelf maar in het gebruikte stremsel.",
    category: "ANIMAL",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "LOW",
    originRisk: "ANIMAL_POSSIBLE",
    aliases: ["wei", "weipoeder", "whey", "whey powder", "lactoserum", "molke"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Enzymen (bron niet vermeld)",
    description:
      "Verzamelnaam voor enzympreparaten. Kunnen dierlijk, plantaardig of microbieel zijn.",
    category: "UNKNOWN",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "MEDIUM",
    originRisk: "ANIMAL_POSSIBLE",
    aliases: ["enzymen", "enzymes", "enzym", "enzyme", "ferment"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Aroma (bron niet vermeld)",
    description:
      "Aroma's kunnen dragers of oplosmiddelen bevatten waarvan de herkomst niet op het etiket staat, waaronder ethanol.",
    category: "UNKNOWN",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "LOW",
    originRisk: "UNKNOWN",
    aliases: ["aroma", "aromas", "natuurlijk aroma", "natural flavouring", "natural flavoring", "arome", "flavouring", "flavoring"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Glycerine",
    description: "Zie E422. Kan plantaardig, dierlijk of synthetisch zijn.",
    category: "ADDITIVE",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_POSSIBLE",
    aliases: ["glycerine", "glycerol", "glycerin", "e422"],
    eNumberCode: "E422",
    sourceKeys: INTERNAL,
  },
  {
    name: "Mono- en diglyceriden van vetzuren",
    description: "Zie E471.",
    category: "ADDITIVE",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_POSSIBLE",
    aliases: [
      "mono en diglyceriden van vetzuren",
      "mono and diglycerides of fatty acids",
      "monoglyceriden",
      "diglyceriden",
      "emulgator e471",
    ],
    eNumberCode: "E471",
    sourceKeys: INTERNAL,
  },
  {
    name: "Cochenille / karmijn",
    description: "Zie E120.",
    category: "INSECT",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["cochenille", "cochineal", "karmijn", "carmine", "karmijnzuur", "carminic acid"],
    eNumberCode: "E120",
    sourceKeys: INTERNAL,
  },

  // --- Waarschijnlijk halal ------------------------------------------------
  {
    name: "Water",
    description: "Drinkwater.",
    category: "MINERAL",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "NONE",
    aliases: ["water", "eau", "wasser", "aqua"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Suiker",
    description: "Sacharose uit suikerbiet of suikerriet.",
    category: "PLANT",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "PLANT_ONLY",
    aliases: ["suiker", "sugar", "sucre", "zucker", "sacharose", "saccharose"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Zout",
    description: "Natriumchloride.",
    category: "MINERAL",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "NONE",
    aliases: ["zout", "salt", "sel", "salz", "natriumchloride", "keukenzout"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Tarwebloem",
    description: "Meel van tarwe.",
    category: "PLANT",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "PLANT_ONLY",
    aliases: ["tarwebloem", "tarwemeel", "wheat flour", "farine de ble", "weizenmehl", "bloem"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Zonnebloemolie",
    description: "Plantaardige olie uit zonnebloempitten.",
    category: "PLANT",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "PLANT_ONLY",
    aliases: ["zonnebloemolie", "sunflower oil", "huile de tournesol", "sonnenblumenol"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Palmolie",
    description: "Plantaardige olie uit de vrucht van de oliepalm.",
    category: "PLANT",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "PLANT_ONLY",
    aliases: ["palmolie", "palm oil", "huile de palme", "palmfett", "palmvet"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Cacaomassa",
    description: "Vermalen cacaobonen.",
    category: "PLANT",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "PLANT_ONLY",
    aliases: ["cacaomassa", "cocoa mass", "cacao", "kakaomasse", "pate de cacao"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Melk",
    description: "Koemelk of daarvan afgeleide melkpoeder.",
    category: "ANIMAL",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["melk", "milk", "lait", "milch", "magere melkpoeder", "volle melkpoeder", "melkpoeder"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Ei",
    description: "Kippenei of eibestanddelen.",
    category: "ANIMAL",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    aliases: ["ei", "eieren", "egg", "oeuf", "eigeel", "eiwit", "heelei"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Gist",
    description: "Bakkersgist (Saccharomyces cerevisiae).",
    category: "MICROBIAL",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "MEDIUM",
    originRisk: "SYNTHETIC_ONLY",
    aliases: ["gist", "yeast", "levure", "hefe", "bakkersgist"],
    sourceKeys: INTERNAL,
  },
  {
    name: "Citroenzuur",
    description: "Zuurteregelaar (E330), industrieel geproduceerd via microbiele fermentatie.",
    category: "ADDITIVE",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "MEDIUM",
    originRisk: "SYNTHETIC_ONLY",
    aliases: ["citroenzuur", "citric acid", "acide citrique", "zitronensaure", "e330"],
    sourceKeys: INTERNAL,
  },
];
