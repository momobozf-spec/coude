import { describe, expect, it, vi } from 'vitest'

import { isLocked, lockMinutesForCount } from '@/server/modules/account/lockout'
import { clientIp } from '@/server/http/client-ip'
import { NoEmailSender, RESEND_ENDPOINT, ResendEmailSender } from '@/server/integrations/email/core'

const POLICY = { maxAttempts: 5, lockMinutes: 15 }

describe('inlogvergrendeling', () => {
  it('vergrendelt alleen op een veelvoud van de drempel, met verdubbeling', () => {
    expect(lockMinutesForCount(4, POLICY)).toBeNull()
    expect(lockMinutesForCount(5, POLICY)).toBe(15)
    expect(lockMinutesForCount(6, POLICY)).toBeNull()
    expect(lockMinutesForCount(10, POLICY)).toBe(30)
    expect(lockMinutesForCount(15, POLICY)).toBe(60)
  })

  it('stijgt nooit boven een dag', () => {
    expect(lockMinutesForCount(500, POLICY)).toBe(24 * 60)
  })

  it('beschouwt een verlopen slot als open', () => {
    const now = new Date('2026-10-04T10:00:00Z')
    expect(isLocked(null, now)).toBe(false)
    expect(isLocked(new Date(now.getTime() + 1), now)).toBe(true)
    expect(isLocked(new Date(now.getTime()), now)).toBe(false)
  })
})

describe('client-IP achter een proxy', () => {
  const headers = (xff: string) => new Headers({ 'x-forwarded-for': xff })

  it('neemt het adres dat de eigen proxy toevoegde, niet wat de bezoeker meestuurt', () => {
    // De bezoeker zette zelf "1.1.1.1" in de header; de proxy voegde 9.9.9.9 toe.
    expect(clientIp(headers('1.1.1.1, 9.9.9.9'), 1)).toBe('9.9.9.9')
  })

  it('telt bij twee proxies twee plaatsen van rechts', () => {
    expect(clientIp(headers('1.1.1.1, 9.9.9.9, 10.0.0.1'), 2)).toBe('9.9.9.9')
  })

  it('negeert de header zonder proxy', () => {
    expect(clientIp(headers('1.1.1.1'), 0)).toBe('direct')
  })

  it('vertrouwt X-Real-IP niet (die zet een bezoeker die de proxy omzeilt zelf)', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '6.6.6.6' }), 1)).toBe('unknown')
  })

  it('valt terug op het linkste adres als de keten korter is dan verwacht', () => {
    expect(clientIp(headers('9.9.9.9'), 3)).toBe('9.9.9.9')
  })
})

describe('e-mail', () => {
  it('stuurt via de Resend-API en geeft het id terug', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 }),
    )
    const sender = new ResendEmailSender('re_key', 'Barakah <noreply@example.org>', fetchImpl as unknown as typeof fetch)

    const result = await sender.send({ to: 'a@example.org', subject: 'Onderwerp', text: 'Tekst' })

    expect(result).toEqual({ delivered: true, providerId: 'msg_123' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(RESEND_ENDPOINT)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_key')
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Barakah <noreply@example.org>',
      to: ['a@example.org'],
      subject: 'Onderwerp',
      text: 'Tekst',
    })
  })

  it('meldt een fout van de provider in plaats van succes te veinzen', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 422 }))
    const sender = new ResendEmailSender('k', 'f@example.org', fetchImpl as unknown as typeof fetch)
    const result = await sender.send({ to: 'a@example.org', subject: 's', text: 't' })
    expect(result.delivered).toBe(false)
    expect(result.error).toContain('422')
  })

  it('meldt een netwerkfout', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET')
    })
    const sender = new ResendEmailSender('k', 'f@example.org', fetchImpl as unknown as typeof fetch)
    expect((await sender.send({ to: 'a@example.org', subject: 's', text: 't' })).delivered).toBe(false)
  })

  it('zonder provider wordt niets als verzonden gemeld', async () => {
    const seen: string[] = []
    const sender = new NoEmailSender((message) => seen.push(message.to))
    const result = await sender.send({ to: 'a@example.org', subject: 's', text: 't' })
    expect(result.delivered).toBe(false)
    expect(seen).toEqual(['a@example.org'])
  })
})
