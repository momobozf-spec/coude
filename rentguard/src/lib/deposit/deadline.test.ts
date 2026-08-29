import { describe, expect, it } from 'vitest';

import {
  DEADLINE_RULE_KEY,
  MissingLegalRuleError,
  PENALTY_RULE_KEY,
  calculateDepositDeadline,
  planReminders,
} from '@/lib/deposit/deadline';
import type { LegalRule } from '@/lib/supabase/types';

function rule(overrides: Partial<LegalRule>): LegalRule {
  return {
    rule_key: 'x',
    description_nl: '',
    description_fr: '',
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

const DEADLINE_RULE = rule({
  rule_key: DEADLINE_RULE_KEY,
  parameters: { months: 2, starts_from: 'KEYS_RETURNED' },
  applies_from: '2024-11-01',
});

const PENALTY_RULE = rule({
  rule_key: PENALTY_RULE_KEY,
  parameters: { pct_per_month: 10, claimable_without_confirmation: false },
  applies_from: '2024-11-01',
});

const RULES = [DEADLINE_RULE, PENALTY_RULE];

describe('calculateDepositDeadline', () => {
  it('berekent de termijn als twee maanden na de sleuteloverdracht', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-03-15T00:00:00Z'),
        leaseSignedOn: new Date('2025-01-10T00:00:00Z'),
        depositAmount: 1600,
        amountRefunded: 0,
        now: new Date('2026-04-01T00:00:00Z'),
      },
      RULES,
    );

    expect(result.deadlineDate.toISOString().slice(0, 10)).toBe('2026-05-15');
    expect(result.isOverdue).toBe(false);
    expect(result.daysRemaining).toBe(44);
  });

  it('vangt maandoverloop op: 31 december plus twee maanden is 28 februari', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2025-12-31T00:00:00Z'),
        leaseSignedOn: new Date('2025-01-10T00:00:00Z'),
        depositAmount: 1000,
        amountRefunded: 0,
        now: new Date('2026-01-05T00:00:00Z'),
      },
      RULES,
    );

    expect(result.deadlineDate.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('berekent het openstaande bedrag na een gedeeltelijke terugbetaling', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-01-10T00:00:00Z'),
        leaseSignedOn: new Date('2025-01-10T00:00:00Z'),
        depositAmount: 1600,
        amountRefunded: 900.5,
        now: new Date('2026-03-20T00:00:00Z'),
      },
      RULES,
    );

    expect(result.outstandingAmount).toBe(699.5);
  });

  it('geeft nooit een negatief openstaand bedrag', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-01-10T00:00:00Z'),
        leaseSignedOn: new Date('2025-01-10T00:00:00Z'),
        depositAmount: 1000,
        amountRefunded: 1200,
        now: new Date('2026-03-20T00:00:00Z'),
      },
      RULES,
    );

    expect(result.outstandingAmount).toBe(0);
  });
});

describe('vertraging en vergoeding', () => {
  it('rekent de vergoeding per begonnen maand vertraging', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-01-10T00:00:00Z'),
        leaseSignedOn: new Date('2025-06-01T00:00:00Z'),
        depositAmount: 1600,
        amountRefunded: 0,
        // Deadline 10/03; op 12/05 zijn twee volle maanden verstreken plus een
        // begonnen derde.
        now: new Date('2026-05-12T00:00:00Z'),
      },
      RULES,
    );

    expect(result.isOverdue).toBe(true);
    expect(result.monthsOverdue).toBe(3);
    expect(result.latePenaltyAmount).toBe(480); // 1600 x 10% x 3
  });

  it('presenteert de vergoeding als aanspraak onder voorbehoud', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-01-10T00:00:00Z'),
        leaseSignedOn: new Date('2025-06-01T00:00:00Z'),
        depositAmount: 1000,
        amountRefunded: 0,
        now: new Date('2026-04-01T00:00:00Z'),
      },
      RULES,
    );

    expect(result.latePenaltyIsProvisional).toBe(true);
  });

  it('rekent geen vergoeding zolang de termijn loopt', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-03-15T00:00:00Z'),
        leaseSignedOn: new Date('2025-06-01T00:00:00Z'),
        depositAmount: 1600,
        amountRefunded: 0,
        now: new Date('2026-04-01T00:00:00Z'),
      },
      RULES,
    );

    expect(result.latePenaltyAmount).toBeNull();
    expect(result.monthsOverdue).toBe(0);
  });
});

describe('werking in de tijd', () => {
  it('waarschuwt wanneer de regel niet op dit contract van toepassing is', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-03-15T00:00:00Z'),
        leaseSignedOn: new Date('2019-05-01T00:00:00Z'),
        depositAmount: 1600,
        amountRefunded: 0,
        now: new Date('2026-04-01T00:00:00Z'),
      },
      RULES,
    );

    expect(result.warnings).toContainEqual({
      kind: 'RULE_NOT_APPLICABLE_TO_CONTRACT',
      ruleKey: DEADLINE_RULE_KEY,
    });
  });

  it('waarschuwt wanneer de contractdatum onbekend is', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-03-15T00:00:00Z'),
        leaseSignedOn: null,
        depositAmount: 1600,
        amountRefunded: 0,
        now: new Date('2026-04-01T00:00:00Z'),
      },
      RULES,
    );

    expect(result.warnings).toContainEqual({ kind: 'LEASE_DATE_UNKNOWN' });
  });
});

describe('regels en verificatiestatus', () => {
  it('breekt af in plaats van een termijn aan te nemen', () => {
    expect(() =>
      calculateDepositDeadline(
        {
          keysReturnedOn: new Date('2026-03-15T00:00:00Z'),
          leaseSignedOn: new Date('2025-01-01T00:00:00Z'),
          depositAmount: 1000,
          amountRefunded: 0,
        },
        [],
      ),
    ).toThrow(MissingLegalRuleError);
  });

  it('markeert het resultaat wanneer een gebruikte regel verouderd is', () => {
    const stale = [
      { ...DEADLINE_RULE, verified_at: '2025-01-01' },
      PENALTY_RULE,
    ];

    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-03-15T00:00:00Z'),
        leaseSignedOn: new Date('2025-01-01T00:00:00Z'),
        depositAmount: 1000,
        amountRefunded: 0,
        now: new Date('2026-04-01T00:00:00Z'),
      },
      stale,
    );

    expect(result.needsVerification).toBe(true);
    expect(result.warnings.some((w) => w.kind === 'RULE_STALE')).toBe(true);
  });

  it('bevriest de gebruikte regels met hun bron', () => {
    const result = calculateDepositDeadline(
      {
        keysReturnedOn: new Date('2026-03-15T00:00:00Z'),
        leaseSignedOn: new Date('2025-01-01T00:00:00Z'),
        depositAmount: 1000,
        amountRefunded: 0,
        now: new Date('2026-04-01T00:00:00Z'),
      },
      RULES,
    );

    expect(result.ruleSnapshot[DEADLINE_RULE_KEY].source_url).toBe(
      'https://example.org',
    );
    expect(result.needsVerification).toBe(false);
  });
});

describe('planReminders', () => {
  it('plant herinneringen rond de deadline', () => {
    const reminders = planReminders(new Date('2026-05-15T00:00:00Z'));
    const kinds = reminders.map((r) => r.kind);

    expect(kinds).toEqual([
      'BEFORE_30D',
      'BEFORE_7D',
      'ON_DEADLINE',
      'AFTER_14D',
    ]);
    expect(reminders[0].remindAt.toISOString().slice(0, 10)).toBe('2026-04-15');
    expect(reminders[3].remindAt.toISOString().slice(0, 10)).toBe('2026-05-29');
  });
});
