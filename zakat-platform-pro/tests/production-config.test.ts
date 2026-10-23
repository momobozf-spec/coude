import { describe, expect, it } from 'vitest'

import { productionProblems, type ServerEnv } from '@/config/env'

const GOOD: ServerEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://x',
  AUTH_SECRET: 'a-real-secret-that-is-at-least-32-chars-long',
  AI_PROVIDER: 'mock',
  AI_MODEL: 'x',
  METAL_PRICE_PROVIDER: 'published',
  FX_PROVIDER: 'published',
  MAX_PRICE_AGE_DAYS: 4,
  FX_SYNC: 'frankfurter',
  DATABASE_POOL_MAX: 10,
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_LOCK_MINUTES: 15,
  LOGIN_MAX_ATTEMPTS_PER_IP: 30,
  TRUSTED_PROXY_HOPS: 1,
  LEGAL_ENTITY_NAME: '',
  LEGAL_ENTITY_VAT: '',
  LEGAL_ENTITY_ADDRESS: '',
  LEGAL_CONTACT_EMAIL: '',
  STORAGE_PROVIDER: 'local',
  STORAGE_LOCAL_DIR: '.storage',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_x',
  EMAIL_FROM: 'Barakah <noreply@example.org>',
  LOG_LEVEL: 'info',
}

describe('productieconfiguratie', () => {
  it('aanvaardt een volledige configuratie', () => {
    expect(productionProblems(GOOD, 'https://barakah.example')).toEqual([])
  })

  it('controleert niets buiten productie', () => {
    expect(productionProblems({ ...GOOD, NODE_ENV: 'development', METAL_PRICE_PROVIDER: 'fixture' }, 'http://x')).toEqual([])
  })

  it('weigert ontwikkelprijzen en niet-bestaande providers', () => {
    for (const provider of ['fixture', 'manual', 'metalprice'] as const) {
      expect(productionProblems({ ...GOOD, METAL_PRICE_PROVIDER: provider }, 'https://x.be').join()).toContain('METAL_PRICE_PROVIDER')
    }
    for (const provider of ['fixture', 'frankfurter'] as const) {
      expect(productionProblems({ ...GOOD, FX_PROVIDER: provider }, 'https://x.be').join()).toContain('FX_PROVIDER')
    }
  })

  it('eist e-mail, een echt geheim en https', () => {
    expect(productionProblems({ ...GOOD, EMAIL_PROVIDER: 'none' }, 'https://x.be')).toHaveLength(1)
    expect(productionProblems({ ...GOOD, AUTH_SECRET: 'replace-me-with-a-32-byte-random-string' }, 'https://x.be')).toHaveLength(1)
    expect(productionProblems(GOOD, 'http://barakah.example')).toHaveLength(1)
    expect(productionProblems(GOOD, 'http://localhost:3000')).toEqual([])
  })

  it('eist een reverse proxy (TRUSTED_PROXY_HOPS ≥ 1)', () => {
    expect(productionProblems({ ...GOOD, TRUSTED_PROXY_HOPS: 0 }, 'https://x.be').join()).toContain('TRUSTED_PROXY_HOPS')
  })

  it('weigert s3-opslag zolang die niet bestaat', () => {
    expect(productionProblems({ ...GOOD, STORAGE_PROVIDER: 's3' }, 'https://x.be')).toHaveLength(1)
  })
})

describe('publieke URL', () => {
  it('leest de waarde bij het draaien, zonder afsluitende slash', async () => {
    const { appBaseUrl } = await import('@/config/env')
    const before = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://barakah.example/'
    try {
      expect(appBaseUrl()).toBe('https://barakah.example')
    } finally {
      if (before === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = before
    }
  })
})

describe('.env.example', () => {
  it('is als .env bruikbaar: lege waarden gelden als niet ingesteld', async () => {
    const { readFileSync } = await import('node:fs')
    const vars: Record<string, string> = Object.fromEntries(
      readFileSync('.env.example', 'utf8')
        .split('\n')
        .map((line) => /^([A-Z_]+)="([^"]*)"/.exec(line))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => [match[1] ?? '', match[2] ?? '']),
    )
    const saved = { ...process.env }
    try {
      for (const [key, value] of Object.entries(vars)) process.env[key] = value
      process.env.AUTH_SECRET = 'a-real-secret-that-is-at-least-32-chars-long'
      const { vi } = await import('vitest')
      vi.resetModules()
      const { serverEnv } = await import('@/config/env')
      expect(() => serverEnv()).not.toThrow()
      expect(serverEnv().CRON_SECRET).toBeUndefined()
    } finally {
      process.env = saved
    }
  })
})
