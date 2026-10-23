/**
 * Verboden juridische claims.
 *
 * Zie docs/decisions/0003-bewijswaarde-framing.md. Deze lijst wordt door een
 * unit test toegepast op alle vertaalbestanden en brieftemplates. De build
 * faalt als een van deze termen erin sluipt.
 */

export interface ForbiddenTerm {
  /** Reguliere expressie, case-insensitive toegepast. */
  pattern: RegExp;
  /** Waarom deze formulering niet mag. */
  reason: string;
  /**
   * Contexten waarin de term wél is toegestaan, bv. omdat de tekst uitlegt
   * dat iets géén aangetekende zending is.
   */
  allowedWhen?: RegExp[];
}

export const FORBIDDEN_TERMS: ForbiddenTerm[] = [
  {
    pattern: /juridisch\s+waterdicht|juridiquement\s+(?:inattaquable|blind[ée])/i,
    reason:
      'Suggereert een juridische garantie die niemand kan geven. Gebruik een ' +
      'feitelijke beschrijving van wat het rapport wél aantoont.',
  },
  {
    pattern:
      /\bgegarandeerd\b|\bgarantie\s+(?:op|van)\s+(?:succes|resultaat|terugbetaling)|\bgaranti[e]?\s+de\s+(?:succès|résultat|remboursement)/i,
    reason:
      'Wij garanderen geen uitkomst. Formuleer als "dossier" of "aanspraak".',
  },
  {
    pattern: /rechtsgeldig\s+aangetekend|recommand[ée]\s+juridiquement\s+valable/i,
    reason:
      'Alleen correct bij een gekwalificeerd kanaal én een geslaagde ' +
      'verzending. Gebruik de kanaalspecifieke labels.',
  },
  {
    pattern: /waarborg[- ]?garantie|garantie[- ]?garantie/i,
    reason:
      'Term uit de conceptnota. Vervangen door "volledig waarborg-dossier".',
  },
  {
    pattern:
      /offici[ëe]le\s+plaatsbeschrijving|[ée]tat\s+des\s+lieux\s+officiel/i,
    reason:
      'Onze rapporten zijn eenzijdig tenzij medeondertekend. Gebruik ' +
      '"fotodossier" of "medeondertekend rapport".',
  },
  {
    pattern: /\b100\s*%\s*(?:zeker|sûr|garanti)/i,
    reason: 'Absolute zekerheid bestaat niet in een juridisch dossier.',
  },
  {
    pattern: /\bu\s+wint\b|\bvous\s+gagnerez\b|\bwint\s+u\s+zeker\b/i,
    reason: 'Voorspelling van een procesuitkomst. Niet doen.',
  },
];

export interface ForbiddenTermHit {
  term: string;
  match: string;
  reason: string;
  /** Tekstfragment rond de treffer, om het probleem terug te vinden. */
  context: string;
}

/**
 * Zoekt verboden termen in een tekst. Geeft een lege lijst als de tekst in
 * orde is.
 */
export function findForbiddenTerms(text: string): ForbiddenTermHit[] {
  const hits: ForbiddenTermHit[] = [];

  for (const term of FORBIDDEN_TERMS) {
    const re = new RegExp(term.pattern.source, term.pattern.flags.includes('g')
      ? term.pattern.flags
      : `${term.pattern.flags}g`);

    for (const match of text.matchAll(re)) {
      const index = match.index ?? 0;
      const allowed = term.allowedWhen?.some((ctx) =>
        ctx.test(text.slice(Math.max(0, index - 160), index + 160)),
      );
      if (allowed) continue;

      hits.push({
        term: term.pattern.source,
        match: match[0],
        reason: term.reason,
        context: text
          .slice(Math.max(0, index - 60), index + match[0].length + 60)
          .replace(/\s+/g, ' ')
          .trim(),
      });
    }
  }

  return hits;
}

/**
 * Werpt een fout als de tekst een verboden term bevat. Bedoeld voor gebruik in
 * de brief-pipeline, zodat een handmatig ingevoerd veld niet alsnog een
 * verboden claim in een brief kan brengen.
 */
export function assertNoForbiddenTerms(text: string, label: string): void {
  const hits = findForbiddenTerms(text);
  if (hits.length === 0) return;

  const detail = hits
    .map((h) => `  - "${h.match}" in ${label}: ${h.reason}`)
    .join('\n');
  throw new Error(`Verboden juridische formulering aangetroffen:\n${detail}`);
}
