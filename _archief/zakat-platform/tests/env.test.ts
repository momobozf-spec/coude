import { describe, expect, it } from 'vitest'

import { parseServerEnv } from '@/config/env'

const VALID = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  AUTH_SECRET: 'a'.repeat(32),
}

describe('server environment validation', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const result = parseServerEnv(VALID)
    expect(result.success).toBe(true)
    if (!result.success) return

    // Defaults must be the safe, offline ones — a missing variable should never
    // silently enable a live provider that costs money or leaks data.
    expect(result.data.AI_PROVIDER).toBe('mock')
    expect(result.data.METAL_PRICE_PROVIDER).toBe('fixture')
    expect(result.data.FX_PROVIDER).toBe('fixture')
    expect(result.data.STORAGE_PROVIDER).toBe('local')
    expect(result.data.EMAIL_PROVIDER).toBe('none')
  })

  it('rejects a short AUTH_SECRET', () => {
    const result = parseServerEnv({ ...VALID, AUTH_SECRET: 'too-short' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = VALID
    expect(parseServerEnv(rest).success).toBe(false)
  })

  it('rejects an unknown provider rather than falling back silently', () => {
    expect(parseServerEnv({ ...VALID, AI_PROVIDER: 'gemini' }).success).toBe(false)
    expect(parseServerEnv({ ...VALID, STORAGE_PROVIDER: 'ftp' }).success).toBe(false)
  })
})
