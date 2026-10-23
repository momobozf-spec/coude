import { describe, expect, it } from 'vitest';

import {
  appliesToContract,
  blockingRulesForLetter,
  buildRuleSnapshot,
  effectiveStatus,
  needsVerification,
  ruleNumber,
} from '@/lib/legal/rules';
import type { LegalRule } from '@/lib/supabase/types';

function rule(overrides: Partial<LegalRule> = {}): LegalRule {
  return {
    rule_key: 'test.rule',
    description_nl: 'Testregel',
    description_fr: 'Règle de test',
    parameters: {},
    source_url: 'https://example.org',
    source_name: 'Test',
    source_is_official: true,
    verified_at: '2026-08-01',
    status: 'VERIFIED',
    applies_from: null,
    applies_to: null,
    notes: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

const NOW = new Date('2026-08-29T12:00:00Z');

describe('effectiveStatus', () => {
  it('houdt een recente VERIFIED-regel op VERIFIED', () => {
    expect(effectiveStatus(rule({ verified_at: '2026-08-01' }), NOW)).toBe(
      'VERIFIED',
    );
  });

  it('zet een VERIFIED-regel ouder dan zes maanden op STALE', () => {
    expect(effectiveStatus(rule({ verified_at: '2026-01-01' }), NOW)).toBe(
      'STALE',
    );
  });

  it('laat UNVERIFIED ongemoeid, ook als hij oud is', () => {
    expect(
      effectiveStatus(
        rule({ status: 'UNVERIFIED', verified_at: '2020-01-01' }),
        NOW,
      ),
    ).toBe('UNVERIFIED');
  });

  it('gebruikt precies zes maanden als grens', () => {
    expect(effectiveStatus(rule({ verified_at: '2026-03-01' }), NOW)).toBe(
      'VERIFIED',
    );
    expect(effectiveStatus(rule({ verified_at: '2026-02-27' }), NOW)).toBe(
      'STALE',
    );
  });
});

describe('appliesToContract', () => {
  const from2024 = rule({ applies_from: '2024-11-01' });

  it('geldt voor een contract van na de ingangsdatum', () => {
    expect(appliesToContract(from2024, '2025-03-01')).toBe(true);
  });

  it('geldt niet voor een ouder contract', () => {
    expect(appliesToContract(from2024, '2019-06-01')).toBe(false);
  });

  it('geldt niet wanneer de contractdatum onbekend is', () => {
    expect(appliesToContract(from2024, null)).toBe(false);
  });

  it('geldt altijd wanneer de regel geen werking in de tijd heeft', () => {
    expect(appliesToContract(rule(), null)).toBe(true);
  });

  it('respecteert een einddatum', () => {
    const window = rule({ applies_from: '2022-10-14', applies_to: '2023-10-13' });
    expect(appliesToContract(window, '2023-01-01')).toBe(true);
    expect(appliesToContract(window, '2024-01-01')).toBe(false);
  });
});

describe('buildRuleSnapshot en needsVerification', () => {
  it('bevriest status en bron per regel', () => {
    const snapshot = buildRuleSnapshot([rule({ rule_key: 'a' })], NOW);
    expect(snapshot.a.status).toBe('VERIFIED');
    expect(snapshot.a.source_url).toBe('https://example.org');
  });

  it('markeert het resultaat zodra één regel niet VERIFIED is', () => {
    const snapshot = buildRuleSnapshot(
      [rule({ rule_key: 'a' }), rule({ rule_key: 'b', status: 'UNVERIFIED' })],
      NOW,
    );
    expect(needsVerification(snapshot)).toBe(true);
  });

  it('markeert niets wanneer alle regels VERIFIED zijn', () => {
    expect(needsVerification(buildRuleSnapshot([rule()], NOW))).toBe(false);
  });
});

describe('blockingRulesForLetter', () => {
  it('blokkeert een UNVERIFIED-regel', () => {
    const snapshot = buildRuleSnapshot(
      [rule({ rule_key: 'x', status: 'UNVERIFIED' })],
      NOW,
    );
    expect(blockingRulesForLetter(snapshot).map((r) => r.rule_key)).toEqual(['x']);
  });

  it('blokkeert een regel die zichzelf ongeschikt verklaart voor brieven', () => {
    const snapshot = buildRuleSnapshot(
      [rule({ rule_key: 'y', parameters: { may_ground_a_letter: false } })],
      NOW,
    );
    expect(blockingRulesForLetter(snapshot).map((r) => r.rule_key)).toEqual(['y']);
  });

  it('laat een gewone VERIFIED-regel door', () => {
    expect(blockingRulesForLetter(buildRuleSnapshot([rule()], NOW))).toEqual([]);
  });
});

describe('ruleNumber', () => {
  it('leest een numerieke parameter', () => {
    expect(ruleNumber(rule({ parameters: { months: 2 } }), 'months')).toBe(2);
  });

  it('werpt een fout in plaats van een aanname te doen', () => {
    expect(() => ruleNumber(rule(), 'months')).toThrow(/mist een numerieke/);
    expect(() =>
      ruleNumber(rule({ parameters: { months: '2' } }), 'months'),
    ).toThrow(/mist een numerieke/);
  });
});
