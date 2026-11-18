import type { CheckResult, Outcome } from './types';

const OUTCOME_POINTS: Partial<Record<Outcome, number>> = {
  good: 1,
  attention: 0.5,
  risk: 0,
};

export interface ScoreBreakdown {
  /** Score op basis van alleen de metingen op het toestel. null = geen meetbare controles. */
  measured: number | null;
  /** Score inclusief afgevinkte acties (zelf bevestigd, niet opnieuw gemeten). */
  withActions: number | null;
  /** Aantal controles dat meetelt. */
  countedChecks: number;
  /** Controles die niet meetellen (beperkt, demo, niet gecontroleerd, info). */
  excludedChecks: number;
}

/** Alleen echt op het toestel gemeten controles met een gewicht tellen mee. */
export function isScored(r: CheckResult): boolean {
  return r.source === 'verified' && r.weight > 0 && r.outcome in OUTCOME_POINTS;
}

export function computeScore(results: CheckResult[], confirmedCheckIds: Set<string>): ScoreBreakdown {
  const scored = results.filter(isScored);
  const totalWeight = scored.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) {
    return { measured: null, withActions: null, countedChecks: 0, excludedChecks: results.length };
  }
  const measuredPoints = scored.reduce((s, r) => s + r.weight * (OUTCOME_POINTS[r.outcome] ?? 0), 0);
  const withActionsPoints = scored.reduce(
    (s, r) => s + r.weight * (confirmedCheckIds.has(r.id) ? 1 : (OUTCOME_POINTS[r.outcome] ?? 0)),
    0,
  );
  return {
    measured: Math.round((100 * measuredPoints) / totalWeight),
    withActions: Math.round((100 * withActionsPoints) / totalWeight),
    countedChecks: scored.length,
    excludedChecks: results.length - scored.length,
  };
}

export function scoreLabel(score: number | null): { label: string; tone: 'good' | 'attention' | 'risk' | 'neutral' } {
  if (score === null) return { label: 'Nog geen score', tone: 'neutral' };
  if (score >= 80) return { label: 'Goed op weg', tone: 'good' };
  if (score >= 50) return { label: 'Enkele aandachtspunten', tone: 'attention' };
  return { label: 'Er is werk aan de winkel', tone: 'risk' };
}
