import { nl } from "./nl";
import { en } from "./en";
import { fr } from "./fr";
import { de } from "./de";
import type { LegalDocKey, LegalLocale, LegalTexts } from "./types";
import { LEGAL, legalAddress } from "@/lib/legal-entity";

export const LEGAL_TEXTS: Record<LegalLocale, LegalTexts> = { nl, en, fr, de };

export const DRAFT_BANNER: Record<LegalLocale, string> = {
  nl: "Concept — laten nalezen door een jurist.",
  en: "Draft — to be reviewed by a lawyer.",
  fr: "Projet — à faire relire par un juriste.",
  de: "Entwurf — von einem Juristen prüfen lassen.",
};

export const UPDATED_LABEL: Record<LegalLocale, string> = {
  nl: "Laatst bijgewerkt",
  en: "Last updated",
  fr: "Dernière mise à jour",
  de: "Zuletzt aktualisiert",
};

export function fill(text: string): string {
  return text
    .replaceAll("{NAME}", LEGAL.name)
    .replaceAll("{CBE}", LEGAL.companyNumber)
    .replaceAll("{ADDRESS}", `${legalAddress()}, ${LEGAL.country}`)
    .replaceAll("{EMAIL}", LEGAL.email)
    .replaceAll("{UPDATED}", LEGAL.lastUpdated);
}

export function getLegalDoc(doc: LegalDocKey, locale: string) {
  const loc = (["nl", "en", "fr", "de"].includes(locale) ? locale : "nl") as LegalLocale;
  return { locale: loc, doc: LEGAL_TEXTS[loc][doc] };
}
