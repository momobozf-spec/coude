import { describe, expect, it } from 'vitest'

import {
  donationCreateSchema,
  donationFilterSchema,
  positiveMoneyString,
  sadaqahGoalCreateSchema,
  zakatPaymentSchema,
} from '@/modules/donations/schemas'

/**
 * Input validation (§34, §38).
 *
 * The amount rules are what stop a zero or negative "donation" from reaching the
 * money helpers, and the allocation rule is what stops a voluntary gift from
 * silently settling an obligation.
 */

const VALID = {
  type: 'SADAQAH' as const,
  amount: '50.00',
  currency: 'EUR',
  donatedAt: '2026-08-08T00:00:00.000Z',
}

describe('amount validation', () => {
  it('accepts a plain positive decimal', () => {
    expect(positiveMoneyString.safeParse('50.00').success).toBe(true)
    expect(positiveMoneyString.safeParse('0.01').success).toBe(true)
    expect(positiveMoneyString.safeParse('1500').success).toBe(true)
  })

  it('rejects zero', () => {
    expect(positiveMoneyString.safeParse('0').success).toBe(false)
    expect(positiveMoneyString.safeParse('0.00').success).toBe(false)
  })

  it('rejects a negative amount', () => {
    // A negative donation is not a refund model we support; it would silently
    // reduce a Zakat balance.
    expect(positiveMoneyString.safeParse('-10.00').success).toBe(false)
  })

  it('rejects more than two decimals', () => {
    expect(positiveMoneyString.safeParse('10.005').success).toBe(false)
  })

  it('rejects formatted or localised input', () => {
    expect(positiveMoneyString.safeParse('€50').success).toBe(false)
    expect(positiveMoneyString.safeParse('50,00').success).toBe(false)
    expect(positiveMoneyString.safeParse('1 500').success).toBe(false)
  })
})

describe('donationCreateSchema', () => {
  it('accepts a valid donation', () => {
    expect(donationCreateSchema.safeParse(VALID).success).toBe(true)
  })

  it('rejects an unsupported currency', () => {
    expect(donationCreateSchema.safeParse({ ...VALID, currency: 'XYZ' }).success).toBe(false)
  })

  it('rejects an unknown type', () => {
    expect(donationCreateSchema.safeParse({ ...VALID, type: 'TITHE' }).success).toBe(false)
  })

  it('rejects an invalid date', () => {
    expect(
      donationCreateSchema.safeParse({ ...VALID, donatedAt: 'gisteren' }).success,
    ).toBe(false)
  })

  it('allows a Zakat donation to reference a calculation', () => {
    const result = donationCreateSchema.safeParse({
      ...VALID,
      type: 'ZAKAT',
      zakatCalculationId: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.success).toBe(true)
  })

  it('refuses to let a Sadaqah donation settle a Zakat year', () => {
    const result = donationCreateSchema.safeParse({
      ...VALID,
      type: 'SADAQAH',
      zakatCalculationId: '11111111-1111-4111-8111-111111111111',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['zakatCalculationId'])
    }
  })

  it('accepts an idempotency key', () => {
    const result = donationCreateSchema.safeParse({
      ...VALID,
      idempotencyKey: 'b6a1f0c2-1111-4222-8333-444455556666',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a trivially short idempotency key', () => {
    expect(donationCreateSchema.safeParse({ ...VALID, idempotencyKey: 'abc' }).success).toBe(
      false,
    )
  })
})

describe('zakatPaymentSchema', () => {
  it('takes no type or currency — the server fixes both', () => {
    const result = zakatPaymentSchema.safeParse({
      amount: '500.00',
      donatedAt: '2026-08-08T00:00:00.000Z',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect('type' in result.data).toBe(false)
      expect('currency' in result.data).toBe(false)
    }
  })

  it('still rejects a non-positive amount', () => {
    expect(
      zakatPaymentSchema.safeParse({ amount: '0', donatedAt: '2026-08-08T00:00:00.000Z' })
        .success,
    ).toBe(false)
  })
})

describe('donationFilterSchema', () => {
  it('coerces a year from the query string', () => {
    const result = donationFilterSchema.safeParse({ year: '2026' })
    expect(result.success && result.data.year).toBe(2026)
  })

  it('rejects an implausible year', () => {
    expect(donationFilterSchema.safeParse({ year: '1200' }).success).toBe(false)
  })

  it('accepts an empty filter', () => {
    expect(donationFilterSchema.safeParse({}).success).toBe(true)
  })
})

describe('sadaqahGoalCreateSchema', () => {
  it('accepts a monthly goal', () => {
    const result = sadaqahGoalCreateSchema.safeParse({
      amount: '50.00',
      currency: 'EUR',
      period: 'MONTHLY',
      startDate: '2026-01-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a zero target', () => {
    expect(
      sadaqahGoalCreateSchema.safeParse({
        amount: '0',
        currency: 'EUR',
        period: 'MONTHLY',
        startDate: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown period', () => {
    expect(
      sadaqahGoalCreateSchema.safeParse({
        amount: '50.00',
        currency: 'EUR',
        period: 'FORTNIGHTLY',
        startDate: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})
