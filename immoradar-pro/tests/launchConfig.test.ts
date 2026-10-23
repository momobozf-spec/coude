import { afterEach, describe, expect, it, vi } from 'vitest'

import { allowedCollectors, isSourceAllowedByEnv } from '@/collectors/registry'
import { assertProductionSecrets, getEnv, isMarketRadarEnabled, resetEnvCache } from '@/lib/env'

/**
 * Lancering als LeadRevive: de marktradar staat standaard uit in productie, en
 * de productieconfiguratie weigert demo-bronnen en een ontbrekend adres.
 */

const SECRET = 'x'.repeat(48)

function withEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value)
  resetEnvCache()
  return getEnv()
}

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

const PRODUCTION = {
  NODE_ENV: 'production',
  SESSION_SECRET: SECRET,
  APP_BASE_URL: 'https://app.leadrevive.example',
  LEGAL_ENTITY_ADDRESS: 'Straat 1, 1930 Zaventem',
  COLLECTOR_ENABLED_SOURCES: '',
}

describe('marktradar feature-flag', () => {
  it('staat standaard UIT in productie', () => {
    expect(isMarketRadarEnabled(withEnv({ NODE_ENV: 'production' }))).toBe(false)
  })

  it('staat standaard aan buiten productie (demo en tests)', () => {
    expect(isMarketRadarEnabled(withEnv({ NODE_ENV: 'development' }))).toBe(true)
  })

  it('volgt een expliciete waarde', () => {
    expect(isMarketRadarEnabled(withEnv({ NODE_ENV: 'production', FEATURE_MARKET_RADAR: 'true' }))).toBe(true)
    expect(isMarketRadarEnabled(withEnv({ NODE_ENV: 'development', FEATURE_MARKET_RADAR: 'false' }))).toBe(false)
  })

  it('laat zonder marktradar geen enkele bron draaien, ook niet als ze in de allowlist staat', () => {
    withEnv({ FEATURE_MARKET_RADAR: 'false', COLLECTOR_ENABLED_SOURCES: 'fixture-be,demo-be' })
    expect(isSourceAllowedByEnv('fixture-be')).toBe(false)
    expect(allowedCollectors()).toEqual([])
  })

  it('laat met marktradar de allowlist gelden', () => {
    withEnv({ FEATURE_MARKET_RADAR: 'true', COLLECTOR_ENABLED_SOURCES: 'fixture-be' })
    expect(isSourceAllowedByEnv('fixture-be')).toBe(true)
    expect(isSourceAllowedByEnv('demo-be')).toBe(false)
  })
})

describe('productieconfiguratie', () => {
  it('aanvaardt een volledige LeadRevive-configuratie', () => {
    expect(() => assertProductionSecrets(withEnv(PRODUCTION))).not.toThrow()
  })

  it('weigert demo- en fixturebronnen in productie', () => {
    const env = withEnv({ ...PRODUCTION, COLLECTOR_ENABLED_SOURCES: 'demo-be' })
    expect(() => assertProductionSecrets(env)).toThrow(/demo-be/)
  })

  it('laat demo-bronnen alleen toe met ALLOW_DEMO_SOURCES=true', () => {
    const env = withEnv({ ...PRODUCTION, COLLECTOR_ENABLED_SOURCES: 'demo-be', ALLOW_DEMO_SOURCES: 'true' })
    expect(() => assertProductionSecrets(env)).not.toThrow()
  })

  it('eist het adres van de uitbater op een publieke URL', () => {
    const env = withEnv({ ...PRODUCTION, LEGAL_ENTITY_ADDRESS: '' })
    expect(() => assertProductionSecrets(env)).toThrow(/LEGAL_ENTITY_ADDRESS/)
  })

  it('laat een lokale demo zonder adres toe', () => {
    const env = withEnv({ ...PRODUCTION, APP_BASE_URL: 'http://localhost:3000', LEGAL_ENTITY_ADDRESS: '' })
    expect(() => assertProductionSecrets(env)).not.toThrow()
  })

  it('gebruikt de BV-gegevens als standaard', () => {
    const env = withEnv({})
    expect(env.LEGAL_ENTITY_NAME).toBe('Marhaba Data & AI Agent BV')
    expect(env.LEGAL_ENTITY_VAT).toBe('BE 1003.552.102')
    expect(env.LEGAL_ENTITY_MUNICIPALITY).toBe('Zaventem')
    expect(env.LEGAL_CONTACT_EMAIL).toBe('momobozf@gmail.com')
    expect(env.LEGAL_ENTITY_ADDRESS).toBe('')
  })
})

describe('juridische identiteit uit compose', () => {
  it('valt terug op de BV-gegevens bij lege variabelen', () => {
    const env = withEnv({ LEGAL_ENTITY_NAME: '', LEGAL_ENTITY_VAT: '', LEGAL_CONTACT_EMAIL: ' ' })
    expect(env.LEGAL_ENTITY_NAME).toBe('Marhaba Data & AI Agent BV')
    expect(env.LEGAL_ENTITY_VAT).toBe('BE 1003.552.102')
    expect(env.LEGAL_CONTACT_EMAIL).toBe('momobozf@gmail.com')
  })
})
