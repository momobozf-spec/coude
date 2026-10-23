import { describe, expect, it } from 'vitest'

import { PAID_PLANS_AVAILABLE, PLANS } from '@/config/plans'
import { registerSchema } from '@/modules/auth/schemas'

describe('v1 lanceert gratis', () => {
  it('biedt geen betaalde plannen aan zolang er geen betaalprovider is', () => {
    expect(PAID_PLANS_AVAILABLE).toBe(false)
  })

  it('kent geen prijzen toe aan plannen', () => {
    for (const plan of Object.values(PLANS)) {
      expect(Object.keys(plan)).not.toContain('price')
      expect(Object.keys(plan)).not.toContain('priceId')
    }
  })
})

describe('registratie: uitdrukkelijke toestemming (AVG art. 9)', () => {
  const base = { name: 'Test', email: 'test@example.com', password: 'een-lang-wachtwoord' }

  it('weigert zonder toestemming', () => {
    expect(registerSchema.safeParse(base).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, specialDataConsent: false }).success).toBe(false)
  })

  it('aanvaardt met toestemming', () => {
    expect(registerSchema.safeParse({ ...base, specialDataConsent: true }).success).toBe(true)
  })
})
