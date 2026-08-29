import { describe, expect, it } from 'vitest'

import fr from '@/i18n/messages/fr.json'
import nl from '@/i18n/messages/nl.json'
import { findHonestyViolations, findKeyMismatches } from '@/lib/honesty-guard'

const ALL = { nl, fr }

describe('the shipped copy never promises automatic filing (ADR 0001)', () => {
  it('has no banned marketing claims in any locale', () => {
    const violations = findHonestyViolations(ALL)
    expect(
      violations,
      violations.map((v) => `${v.locale}.${v.key}: ${v.phrase} — "${v.text}"`).join('\n'),
    ).toEqual([])
  })

  it('states plainly that we do not file on the user behalf', () => {
    expect(nl.landing.honestyDont1).toMatch(/niet in jouw plaats/i)
    expect(fr.landing.honestyDont1).toMatch(/pas la demande à votre place/i)
  })

  it('marks every compensation amount as indicative', () => {
    expect(nl.compensation.amountIndicative).toMatch(/indicatief/i)
    expect(fr.compensation.amountIndicative).toMatch(/indicatif/i)
  })

  it('carries the not-affiliated-with-NMBS disclaimer', () => {
    expect(nl.app.disclaimer).toMatch(/niet verbonden aan/i)
    expect(fr.app.disclaimer).toMatch(/indépendant/i)
  })

  it('warns the user that claiming an untaken trip is fraud in their name', () => {
    expect(nl.claim.confirmWarning).toMatch(/fraude/i)
    expect(fr.claim.confirmWarning).toMatch(/fraude/i)
  })
})

describe('the guard actually catches violations', () => {
  it('flags a promise of automatic money', () => {
    const violations = findHonestyViolations({
      nl: { hero: { title: 'Automatisch geld terug bij elke vertraging' } },
    })
    expect(violations).toHaveLength(1)
    expect(violations[0].key).toBe('hero.title')
  })

  it('flags a claim that we file on the user behalf', () => {
    const violations = findHonestyViolations({
      nl: { a: 'Wij dienen je dossier in bij NMBS.' },
    })
    expect(violations.length).toBeGreaterThan(0)
  })

  it('flags the French equivalents', () => {
    const violations = findHonestyViolations({
      fr: { a: 'Compensation automatique après chaque retard.' },
    })
    expect(violations.length).toBeGreaterThan(0)
  })

  it('does NOT flag a sentence that denies doing it', () => {
    const violations = findHonestyViolations({
      nl: { a: 'Wij dienen niet in jouw plaats in bij NMBS.' },
      fr: { b: "Nous n'introduisons pas la demande à votre place." },
    })
    expect(violations).toEqual([])
  })
})

describe('locale parity', () => {
  it('nl and fr define exactly the same keys', () => {
    const problems = findKeyMismatches(ALL)
    expect(problems, problems.join('\n')).toEqual([])
  })
})
