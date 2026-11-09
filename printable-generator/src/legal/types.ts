export type LegalLocale = "nl" | "en" | "fr" | "de";
export type LegalDocKey = "privacy" | "terms" | "cookies" | "legal";

export interface LegalSection {
  h: string;
  p?: string[];
  ul?: string[];
}

export interface LegalDoc {
  title: string;
  sections: LegalSection[];
}

// Placeholders replaced at render time:
//   {NAME} {CBE} {ADDRESS} {EMAIL} {UPDATED}
export type LegalTexts = Record<LegalDocKey, LegalDoc>;
