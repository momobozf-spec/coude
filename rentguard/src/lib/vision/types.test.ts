import { describe, expect, it } from 'vitest';

import { applyConfidenceThreshold } from '@/lib/vision/types';

describe('applyConfidenceThreshold', () => {
  it('laat een zekere schadeclassificatie staan', () => {
    expect(applyConfidenceThreshold('DAMAGE', 0.9, 0.7)).toEqual({
      classification: 'DAMAGE',
      forcedUnclear: false,
    });
  });

  it('duwt een onzekere schadeclassificatie naar UNCLEAR', () => {
    expect(applyConfidenceThreshold('DAMAGE', 0.5, 0.7)).toEqual({
      classification: 'UNCLEAR',
      forcedUnclear: true,
    });
  });

  it('duwt ook een onzekere slijtageclassificatie naar UNCLEAR', () => {
    expect(applyConfidenceThreshold('WEAR_AND_TEAR', 0.69, 0.7)).toEqual({
      classification: 'UNCLEAR',
      forcedUnclear: true,
    });
  });

  it('laat UNCLEAR ongemoeid en markeert het niet als geforceerd', () => {
    expect(applyConfidenceThreshold('UNCLEAR', 0.1, 0.7)).toEqual({
      classification: 'UNCLEAR',
      forcedUnclear: false,
    });
  });

  it('behandelt de drempel als inclusief', () => {
    expect(applyConfidenceThreshold('DAMAGE', 0.7, 0.7).classification).toBe(
      'DAMAGE',
    );
  });

  it('laat een drempel van nul alles door', () => {
    expect(applyConfidenceThreshold('DAMAGE', 0, 0).classification).toBe('DAMAGE');
  });
});
