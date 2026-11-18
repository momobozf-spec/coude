export type ModuleId = 'system' | 'apps' | 'network' | 'scam';

/**
 * Waar komt een resultaat vandaan? Dit wordt bij elke controle zichtbaar getoond.
 * - verified:  echt op dit toestel uitgelezen via een ondersteunde API
 * - limited:   niet (betrouwbaar) beschikbaar door iOS/Android of door Expo
 * - demo:      voorbeeld- of simulatiegegevens, geen echte toestelscan
 * - heuristic: lokale inschatting op basis van herkenbare signalen
 * - unchecked: niet gecontroleerd (bv. API faalde of is niet betrouwbaar genoeg)
 */
export type Source = 'verified' | 'limited' | 'demo' | 'heuristic' | 'unchecked';

/**
 * - good / attention / risk: telt mee in de score (alleen bij source 'verified')
 * - info: feitelijke informatie die niets zegt over veiligheid
 * - unknown: geen uitspraak mogelijk
 */
export type Outcome = 'good' | 'attention' | 'risk' | 'info' | 'unknown';

export type SettingsTarget = 'general' | 'security' | 'privacy' | 'wifi' | 'appSettings';

export interface CheckResult {
  id: string;
  module: ModuleId;
  title: string;
  source: Source;
  outcome: Outcome;
  /** Korte, kalme samenvatting van wat er gevonden is. */
  summary: string;
  /** Extra uitleg: hoe is dit vastgesteld en wat zijn de grenzen. */
  detail?: string;
  /** Gewicht in de score. 0 = telt niet mee. */
  weight: number;
  /** Systeeminstellingen die bij deze controle horen (indien te openen). */
  settings?: SettingsTarget;
  /** Instructie voor de gebruiker wanneer een knop niet mogelijk is (bv. iOS). */
  manualSteps?: string;
}

export interface ScanReport {
  startedAt: number;
  finishedAt: number;
  platform: 'ios' | 'android' | 'other';
  results: CheckResult[];
}
