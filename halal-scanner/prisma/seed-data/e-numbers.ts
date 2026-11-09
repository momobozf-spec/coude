import type { ConfidenceLevel, HalalStatus, OriginRisk } from "@prisma/client";
import { SOURCE_KEYS } from "./sources";

/**
 * E-nummer seeddataset - TECHNISCHE DEMO, geen volledige religieuze autoriteit.
 *
 * Wat hier vastligt:
 *  - de feitelijke chemische identiteit en de bekende grondstofroutes
 *    (onderbouwd met EU 1333/2008 en EFSA);
 *  - onze eigen, conservatieve standaardbeoordeling (INTERNAL_RULE).
 *
 * Wat hier NIET vastligt: een uitspraak namens een halal-autoriteit. Die komen
 * via ENumberRuling binnen, per CertificationBody, wanneer een geverifieerde
 * lijst geimporteerd wordt.
 *
 * Vuistregel voor `defaultStatus`: kan het additief uit een dierlijke bron
 * komen zonder dat het etiket de bron vermeldt, dan is de uitkomst MUSHBOOH -
 * niet LIKELY_HALAL. Onzekerheid wordt zichtbaar gemaakt, niet weggepoetst.
 */
export interface SeedENumber {
  code: string;
  name: string;
  description: string;
  defaultStatus: HalalStatus;
  defaultConfidence: ConfidenceLevel;
  originRisk: OriginRisk;
  animalDerivedPossible: boolean;
  plantDerivedPossible: boolean;
  syntheticPossible: boolean;
  microbialPossible: boolean;
  possibleSources: string[];
  notes: string;
  /** Keys uit SOURCE_KEYS die de feitelijke beschrijving onderbouwen. */
  sourceKeys: string[];
}

const FACTUAL_SOURCES = [SOURCE_KEYS.EU_1333_2008, SOURCE_KEYS.EFSA_ADDITIVES];
const WITH_INTERNAL = [...FACTUAL_SOURCES, SOURCE_KEYS.INTERNAL_RULES];

export const seedENumbers: SeedENumber[] = [
  {
    code: "E100",
    name: "Curcumine",
    description: "Gele kleurstof, gewonnen uit de wortelstok van kurkuma (Curcuma longa).",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "MEDIUM",
    originRisk: "PLANT_ONLY",
    animalDerivedPossible: false,
    plantDerivedPossible: true,
    syntheticPossible: true,
    microbialPossible: false,
    possibleSources: ["kurkumawortel", "synthetische productie"],
    notes:
      "Plantaardig of synthetisch. Aandachtspunt: het draagmiddel waarin de kleurstof verwerkt is, kan wel dierlijk zijn (bv. gelatine als drager).",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E120",
    name: "Cochenille, karmijnzuur, karmijn",
    description:
      "Rode kleurstof gewonnen uit de gedroogde vrouwtjes van de cochenilleschildluis (Dactylopius coccus).",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    animalDerivedPossible: true,
    plantDerivedPossible: false,
    syntheticPossible: false,
    microbialPossible: false,
    possibleSources: ["cochenilleschildluis"],
    notes:
      "Insectenkleurstof. Over de toelaatbaarheid van insecten bestaan verschillende standpunten tussen halal-autoriteiten; deze applicatie doet daar geen uitspraak over en markeert E120 daarom als twijfelachtig.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E322",
    name: "Lecithinen",
    description:
      "Emulgator. Meestal gewonnen uit sojabonen of zonnebloempitten, maar eigeel is eveneens een bekende bron.",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "MEDIUM",
    originRisk: "ANIMAL_POSSIBLE",
    animalDerivedPossible: true,
    plantDerivedPossible: true,
    syntheticPossible: false,
    microbialPossible: false,
    possibleSources: ["soja", "zonnebloem", "koolzaad", "eigeel"],
    notes:
      "In de praktijk overwegend sojalecithine. Wanneer het etiket 'sojalecithine' of 'zonnebloemlecithine' vermeldt, is de plantaardige herkomst wel bekend en volgt een gunstiger beoordeling.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E406",
    name: "Agar",
    description: "Geleermiddel gewonnen uit rode zeewieren.",
    defaultStatus: "LIKELY_HALAL",
    defaultConfidence: "MEDIUM",
    originRisk: "PLANT_ONLY",
    animalDerivedPossible: false,
    plantDerivedPossible: true,
    syntheticPossible: false,
    microbialPossible: false,
    possibleSources: ["rode zeewieren"],
    notes: "Plantaardig alternatief voor gelatine.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E422",
    name: "Glycerol (glycerine)",
    description:
      "Bevochtigingsmiddel en oplosmiddel. Wordt gewonnen uit plantaardige of dierlijke vetten, of synthetisch geproduceerd uit petrochemische grondstoffen.",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_POSSIBLE",
    animalDerivedPossible: true,
    plantDerivedPossible: true,
    syntheticPossible: true,
    microbialPossible: false,
    possibleSources: ["palmolie", "kokosolie", "koolzaadolie", "dierlijk vet", "petrochemische synthese"],
    notes:
      "De bron staat vrijwel nooit op de verpakking. Zonder verklaring van de fabrikant is de herkomst niet vast te stellen.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E441",
    name: "Gelatine (historisch E-nummer)",
    description:
      "Geleermiddel uit collageen van dierlijk bind- en botweefsel. E441 wordt in de EU niet meer als additief-E-nummer gebruikt; gelatine wordt daar als levensmiddel-ingredient behandeld en onder de naam 'gelatine' vermeld.",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_CERTAIN",
    animalDerivedPossible: true,
    plantDerivedPossible: false,
    syntheticPossible: false,
    microbialPossible: false,
    possibleSources: ["varkenshuid", "runderhuid", "runderbot", "vis"],
    notes:
      "Altijd dierlijk. Varkensgelatine is haram; rundergelatine hangt af van de slachtmethode; visgelatine wordt algemeen als onproblematisch gezien. Zonder bronvermelding blijft de uitkomst twijfelachtig.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E471",
    name: "Mono- en diglyceriden van vetzuren",
    description:
      "Emulgator, gemaakt door glycerol te verestreren met vetzuren. De vetzuren komen uit plantaardige olien of uit dierlijke vetten.",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_POSSIBLE",
    animalDerivedPossible: true,
    plantDerivedPossible: true,
    syntheticPossible: false,
    microbialPossible: false,
    possibleSources: ["palmolie", "sojaolie", "zonnebloemolie", "rundvet", "varkensvet"],
    notes:
      "Een van de meest voorkomende twijfelgevallen op etiketten. De verpakking vermeldt de vetbron zelden. Vermelding als 'plantaardige mono- en diglyceriden' maakt de herkomst wel duidelijk.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E472",
    name: "Esters van mono- en diglyceriden van vetzuren",
    description:
      "Groep emulgatoren (E472a t/m E472f) afgeleid van E471, veresterd met onder meer azijnzuur, melkzuur, citroenzuur of wijnsteenzuur.",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "HIGH",
    originRisk: "ANIMAL_POSSIBLE",
    animalDerivedPossible: true,
    plantDerivedPossible: true,
    syntheticPossible: false,
    microbialPossible: false,
    possibleSources: ["palmolie", "sojaolie", "zonnebloemolie", "dierlijk vet"],
    notes:
      "Erft het herkomstprobleem van E471. Let bij E472a-f ook op het gebruikte zuur: bij wijnsteenzuur (E472d/e) speelt daarnaast de vraag of het uit wijnproductie afkomstig is.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E631",
    name: "Dinatrium-inosinaat",
    description:
      "Smaakversterker. Kan worden gewonnen uit vlees of vis, of geproduceerd worden door microbiele fermentatie van suikers.",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "MEDIUM",
    originRisk: "ANIMAL_POSSIBLE",
    animalDerivedPossible: true,
    plantDerivedPossible: false,
    syntheticPossible: false,
    microbialPossible: true,
    possibleSources: ["vlees", "vis", "microbiele fermentatie"],
    notes: "Herkomst staat vrijwel nooit op de verpakking.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E904",
    name: "Schellak",
    description:
      "Glansmiddel op basis van hars, uitgescheiden door de lakschildluis (Kerria lacca).",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "MEDIUM",
    originRisk: "ANIMAL_CERTAIN",
    animalDerivedPossible: true,
    plantDerivedPossible: false,
    syntheticPossible: false,
    microbialPossible: false,
    possibleSources: ["lakschildluis"],
    notes:
      "Insectenproduct; net als bij E120 lopen de standpunten van halal-autoriteiten uiteen.",
    sourceKeys: WITH_INTERNAL,
  },
  {
    code: "E920",
    name: "L-cysteine",
    description:
      "Meelverbeteraar. Wordt geproduceerd via microbiele fermentatie, synthetisch, of gewonnen uit keratinerijk materiaal zoals veren of haar.",
    defaultStatus: "MUSHBOOH",
    defaultConfidence: "MEDIUM",
    originRisk: "ANIMAL_POSSIBLE",
    animalDerivedPossible: true,
    plantDerivedPossible: false,
    syntheticPossible: true,
    microbialPossible: true,
    possibleSources: ["microbiele fermentatie", "chemische synthese", "veren", "dierlijk haar"],
    notes: "Zonder productieverklaring van de fabrikant is de route niet vast te stellen.",
    sourceKeys: WITH_INTERNAL,
  },
];
