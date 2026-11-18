import { OS_REFERENCE } from '../data/osReference';
import type { Outcome } from './types';

export function parseMajor(version: string | null | undefined): number | null {
  if (!version) return null;
  const match = /^(\d+)/.exec(version.trim());
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isFinite(major) ? major : null;
}

/** Pure functie: beoordeelt een OS-versie tegen de ingebouwde referentietabel. */
export function evaluateOsVersion(
  platform: 'ios' | 'android',
  version: string | null | undefined,
): { outcome: Outcome; major: number | null } {
  const major = parseMajor(version);
  if (major === null) return { outcome: 'unknown', major };
  const ref = OS_REFERENCE[platform];
  if (major >= ref.goodFrom) return { outcome: 'good', major };
  if (major >= ref.attentionFrom) return { outcome: 'attention', major };
  return { outcome: 'risk', major };
}
