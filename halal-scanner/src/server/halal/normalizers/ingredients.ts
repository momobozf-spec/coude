/**
 * Parsen van een ruwe ingrediententekst naar losse ingrediënten.
 *
 * Pure functies zonder database. De uitkomst is de input voor de rules engine
 * (fase 3) en wordt als `ProductIngredient` opgeslagen.
 *
 * Twee dingen die minder vanzelfsprekend zijn dan ze lijken:
 *
 * 1. Splitsen op komma's mag alleen op haakjesniveau 0. In
 *    "chocolade (suiker, cacaomassa, emulgator: E471)" zijn de binnenste
 *    komma's onderdeel van één ingrediënt.
 *
 * 2. Sub-ingrediënten moeten wél apart naar boven komen. Juist daar zitten de
 *    twijfelgevallen verstopt: wie alleen "chocolade" analyseert, mist de E471
 *    die erin zit. Daarom worden zowel het samengestelde ingrediënt als zijn
 *    onderdelen als aparte regels uitgeleverd.
 */
import { normalizeIngredientName, normalizeENumberCode } from "./text";
import type { ParsedIngredient } from "@/types/product";

/**
 * Functionele klassen die op etiketten vóór het eigenlijke additief staan
 * ("emulgator: E471"). De klasse zelf is geen ingrediënt en zou als onbekend
 * ingrediënt ruis opleveren.
 */
const FUNCTIONAL_CLASSES = [
  "emulgator",
  "emulgatoren",
  "emulsifier",
  "emulsifiers",
  "emulsifiant",
  "stabilisator",
  "stabilisatoren",
  "stabiliser",
  "stabilizer",
  "verdikkingsmiddel",
  "verdikkingsmiddelen",
  "thickener",
  "kleurstof",
  "kleurstoffen",
  "colour",
  "color",
  "colouring",
  "antioxidant",
  "antioxidanten",
  "conserveermiddel",
  "conserveermiddelen",
  "preservative",
  "voedingszuur",
  "zuurteregelaar",
  "acidity regulator",
  "rijsmiddel",
  "raising agent",
  "smaakversterker",
  "flavour enhancer",
  "flavor enhancer",
  "antiklontermiddel",
  "anticaking agent",
  "geleermiddel",
  "gelling agent",
  "bevochtigingsmiddel",
  "humectant",
  "glansmiddel",
  "glazing agent",
  "meelverbeteraar",
  "flour treatment agent",
  "zoetstof",
  "zoetstoffen",
  "sweetener",
];

/** Maximale nestdiepte die we uitpakken; dieper is op etiketten zeldzaam. */
const MAX_DEPTH = 3;

const OPENING = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);
const CLOSING = new Set([")", "]", "}"]);

/**
 * Splitst op scheidingstekens die op haakjesniveau 0 staan.
 *
 * Behalve komma's tellen ook puntkomma's; die worden op sommige etiketten
 * gebruikt om additiefgroepen te scheiden.
 */
export function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (OPENING.has(char)) {
      depth += 1;
      current += char;
      continue;
    }
    if (CLOSING.has(char)) {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if ((char === "," || char === ";") && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** Haalt de buitenste haakjesinhoud uit een ingrediënt, plus de kop ervoor. */
function splitHeadAndGroups(text: string): { head: string; groups: string[] } {
  let head = "";
  const groups: string[] = [];
  let depth = 0;
  let buffer = "";

  for (const char of text) {
    if (OPENING.has(char)) {
      if (depth === 0) {
        buffer = "";
        depth = 1;
        continue;
      }
      depth += 1;
    } else if (CLOSING.has(char)) {
      depth -= 1;
      if (depth === 0) {
        groups.push(buffer);
        buffer = "";
        continue;
      }
    }

    if (depth === 0) head += char;
    else buffer += char;
  }

  // Niet-gesloten haakje: behandel de rest alsnog als groep.
  if (buffer.trim().length > 0) groups.push(buffer);

  return { head: head.trim(), groups };
}

/** Positie van de eerste dubbele punt buiten haakjes, of -1. */
function topLevelColonIndex(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === undefined) continue;
    if (OPENING.has(char)) depth += 1;
    else if (CLOSING.has(char)) depth = Math.max(0, depth - 1);
    else if (char === ":" && depth === 0) return i;
  }
  return -1;
}

/**
 * Verwijdert een leidende functionele klasse ("emulgator: E471" -> "E471").
 *
 * Alleen een dubbele punt op haakjesniveau 0 telt. In
 * "chocolade (suiker, emulgator: E471)" hoort de dubbele punt bij het
 * sub-ingredient; hem hier meenemen zou het hele samengestelde ingredient
 * wegvagen en alleen "E471)" overhouden.
 */
function stripFunctionalClass(text: string): string {
  const colonIndex = topLevelColonIndex(text);
  if (colonIndex === -1) return text;

  const prefix = normalizeIngredientName(text.slice(0, colonIndex));
  if (!prefix) return text;

  const isClass = FUNCTIONAL_CLASSES.some(
    (cls) => prefix === cls || prefix.endsWith(` ${cls}`),
  );
  return isClass ? text.slice(colonIndex + 1).trim() : text;
}

/** Haalt een hoeveelheidsaanduiding uit de tekst ("Cacaomassa 32%" -> "32%"). */
function extractQuantity(text: string): string | null {
  const match = /(\d+(?:[.,]\d+)?\s*%)/.exec(text);
  return match?.[1]?.replace(/\s+/g, "") ?? null;
}

/**
 * Etiketruis die geen ingrediënt is: sporenvermeldingen, "in wisselende
 * verhouding", losse asterisken van bio-keurmerken.
 */
const NOISE_PATTERNS = [
  /^kan sporen bevatten/i,
  /^bevat mogelijk/i,
  /^may contain/i,
  /^peut contenir/i,
  /^kann spuren/i,
  /^in wisselende verhouding/i,
  /^in varying proportions/i,
  /^ingredi[eë]nten$/i,
  /^ingredients$/i,
  /^\*+$/,
];

function isNoise(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

interface Collected {
  rawName: string;
  quantityText: string | null;
}

function collect(text: string, depth: number, out: Collected[]): void {
  if (depth > MAX_DEPTH) return;

  for (const rawPart of splitTopLevel(text)) {
    const part = stripFunctionalClass(rawPart);
    if (isNoise(part)) continue;

    const { head, groups } = splitHeadAndGroups(part);

    // "chocolade (suiker, cacaomassa)": zowel de chocolade als haar onderdelen.
    // "olie (palm)" levert head "olie" en groep "palm" - beide zijn nuttig.
    const headText = stripFunctionalClass(head);
    if (headText && !isNoise(headText)) {
      out.push({ rawName: headText, quantityText: extractQuantity(part) });
    }

    for (const group of groups) {
      collect(group, depth + 1, out);
    }

    // Een deel zonder kop, bv. "(E471)" als losstaand element.
    if (!headText && groups.length === 0 && !isNoise(part)) {
      out.push({ rawName: part, quantityText: extractQuantity(part) });
    }
  }
}

/**
 * Zet een ruwe ingrediëntentekst om in genormaliseerde, genummerde regels.
 *
 * Ontdubbelt op genormaliseerde naam: hetzelfde ingrediënt twee keer noemen
 * (bv. suiker in twee sub-lijsten) mag de analyse niet twee keer belasten. De
 * eerste positie wint, want die staat hoger op het etiket.
 */
export function parseIngredientsText(text: string | null | undefined): ParsedIngredient[] {
  if (!text || text.trim().length === 0) return [];

  const collected: Collected[] = [];
  collect(text, 0, collected);

  const result: ParsedIngredient[] = [];
  const seen = new Set<string>();

  for (const item of collected) {
    const normalizedName = normalizeIngredientName(item.rawName);
    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);

    result.push({
      rawName: item.rawName.trim(),
      normalizedName,
      position: result.length,
      quantityText: item.quantityText,
      eNumberCode: normalizeENumberCode(normalizedName),
    });
  }

  return result;
}
