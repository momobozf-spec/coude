import { describe, expect, it } from 'vitest'

import {
  decryptSensitive,
  encryptSensitive,
  isValidIban,
  maskIban,
  maskMobib,
  normaliseIban,
} from '@/lib/crypto'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const IBAN = 'BE68539007547034'

describe('envelope encryption', () => {
  it('round-trips a value', () => {
    const envelope = encryptSensitive(IBAN, USER_A, 'iban')
    expect(decryptSensitive(envelope, USER_A, 'iban')).toBe(IBAN)
  })

  it('never stores the plaintext in the envelope', () => {
    const envelope = encryptSensitive(IBAN, USER_A, 'iban')
    expect(envelope).not.toContain(IBAN)
    expect(envelope).not.toContain('539007547034')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSensitive(IBAN, USER_A, 'iban')
    const b = encryptSensitive(IBAN, USER_A, 'iban')
    expect(a).not.toBe(b)
    expect(decryptSensitive(b, USER_A, 'iban')).toBe(IBAN)
  })

  it('carries a version prefix so keys and algorithms can be rotated', () => {
    expect(encryptSensitive(IBAN, USER_A, 'iban').startsWith('v1:')).toBe(true)
  })

  it("refuses to decrypt another user's row (AAD binding)", () => {
    const envelope = encryptSensitive(IBAN, USER_A, 'iban')
    expect(() => decryptSensitive(envelope, USER_B, 'iban')).toThrow()
  })

  it('refuses to decrypt under a different field name', () => {
    const envelope = encryptSensitive(IBAN, USER_A, 'iban')
    expect(() => decryptSensitive(envelope, USER_A, 'mobib_number')).toThrow()
  })

  it('detects tampering with the ciphertext', () => {
    const [v, iv, ct, tag] = encryptSensitive(IBAN, USER_A, 'iban').split(':')
    const flipped = Buffer.from(ct, 'base64')
    flipped[0] ^= 0xff
    const tampered = [v, iv, flipped.toString('base64'), tag].join(':')
    expect(() => decryptSensitive(tampered, USER_A, 'iban')).toThrow()
  })

  it('rejects a malformed envelope instead of returning garbage', () => {
    expect(() => decryptSensitive('not-an-envelope', USER_A, 'iban')).toThrow()
    expect(() => decryptSensitive('v9:a:b:c', USER_A, 'iban')).toThrow()
  })

  it('refuses to encrypt an empty value', () => {
    expect(() => encryptSensitive('', USER_A, 'iban')).toThrow()
  })
})

describe('masking', () => {
  it('reveals at most the last four digits of an IBAN', () => {
    const masked = maskIban(IBAN)
    expect(masked).toContain('7034')
    expect(masked).not.toContain('5390')
    expect(masked.startsWith('BE**')).toBe(true)
  })

  it('reveals at most the last four digits of a MoBIB number', () => {
    const masked = maskMobib('1234567890123456')
    expect(masked).toContain('3456')
    expect(masked).not.toContain('1234567')
  })

  it('does not leak short values', () => {
    expect(maskMobib('12')).toBe('••••')
    expect(maskIban('BE68')).toBe('••••')
  })
})

describe('IBAN validation', () => {
  it('accepts a valid Belgian IBAN, spaced or not', () => {
    expect(isValidIban(IBAN)).toBe(true)
    expect(isValidIban('BE68 5390 0754 7034')).toBe(true)
    expect(isValidIban('be68 5390 0754 7034')).toBe(true)
  })

  it('rejects a mistyped IBAN (checksum failure)', () => {
    expect(isValidIban('BE68539007547035')).toBe(false)
    expect(isValidIban('BE69539007547034')).toBe(false)
  })

  it('rejects structurally invalid input', () => {
    expect(isValidIban('')).toBe(false)
    expect(isValidIban('12345')).toBe(false)
    expect(isValidIban('NOTANIBAN')).toBe(false)
  })

  it('normalises to uppercase without spaces', () => {
    expect(normaliseIban(' be68 5390 0754 7034 ')).toBe(IBAN)
  })
})
