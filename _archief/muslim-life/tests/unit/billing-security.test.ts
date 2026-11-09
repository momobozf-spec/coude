import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createStripeProvider } from '@/server/integrations/payments/stripe/stripe-provider'
import { checkoutInputSchema } from '@/server/modules/billing/billing.service'
import { UPGRADE_COPY, upgradeCopyFor } from '@/modules/billing/upgrade-prompt'
import { ENTITLEMENTS } from '@/server/services/entitlements'

/**
 * Billing security boundaries.
 *
 * Several of these read the source rather than calling it. That is deliberate:
 * "the route must not parse the body before verifying the signature" is a
 * property of the code's shape, and a runtime test would pass even if the
 * ordering were wrong but happened to work for the fixture.
 */

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

describe('webhook raw body handling', () => {
  const routeSource = source('src/app/api/webhooks/stripe/route.ts')

  it('reads the body as text, never as JSON', () => {
    // `request.json()` followed by re-stringifying changes the bytes and breaks
    // the signature — the single most common way this endpoint is built wrong.
    expect(routeSource).toContain('request.text()')
    expect(routeSource).not.toContain('request.json()')
  })

  it('passes the untouched payload to the handler', () => {
    expect(routeSource).toMatch(/handleWebhook\(\s*rawPayload,\s*signature\s*\)/)
    expect(routeSource).not.toContain('JSON.stringify(rawPayload')
  })

  it('reads the signature from the provider header', () => {
    expect(routeSource).toContain("headers.get('stripe-signature')")
  })
})

describe('webhook signature enforcement', () => {
  const secret = 'whsec_real'
  const provider = createStripeProvider({ secretKey: 'sk_test', webhookSecret: secret })

  const payload = JSON.stringify({
    id: 'evt_1',
    type: 'invoice.paid',
    created: Math.floor(Date.now() / 1000),
    data: { object: { customer: 'cus_1', subscription: 'sub_1' } },
  })

  /**
   * Signed against real wall-clock time, because the provider verifies against
   * `new Date()` — the replay-tolerance window is part of what is being tested.
   */
  function sign(body: string, withSecret: string, at: Date = new Date()): string {
    const timestamp = Math.floor(at.getTime() / 1000)
    const signature = createHmac('sha256', withSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    return `t=${timestamp},v1=${signature}`
  }

  it('accepts a valid signature', async () => {
    const event = await provider.parseWebhook(payload, sign(payload, secret))
    expect(event.externalEventId).toBe('evt_1')
  })

  it('rejects a modified payload', async () => {
    const header = sign(payload, secret)
    const tampered = payload.replace('cus_1', 'cus_attacker')

    await expect(provider.parseWebhook(tampered, header)).rejects.toMatchObject({
      code: 'SIGNATURE_INVALID',
    })
  })

  it('rejects the wrong secret', async () => {
    await expect(
      provider.parseWebhook(payload, sign(payload, 'whsec_attacker')),
    ).rejects.toMatchObject({ code: 'SIGNATURE_INVALID' })
  })

  it('rejects a missing signature', async () => {
    await expect(provider.parseWebhook(payload, null)).rejects.toMatchObject({
      code: 'SIGNATURE_INVALID',
    })
    await expect(provider.parseWebhook(payload, '')).rejects.toMatchObject({
      code: 'SIGNATURE_INVALID',
    })
  })

  it('rejects an old timestamp, so a captured payload cannot be replayed', async () => {
    const old = new Date(Date.now() - 30 * 60_000)

    await expect(provider.parseWebhook(payload, sign(payload, secret, old))).rejects.toMatchObject(
      { code: 'SIGNATURE_INVALID' },
    )
  })

  it('refuses entirely when no webhook secret is configured', async () => {
    const unconfigured = createStripeProvider({ secretKey: 'sk_test' })

    await expect(
      unconfigured.parseWebhook(payload, sign(payload, secret)),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
  })
})

describe('client cannot influence what is charged', () => {
  it('strips any price the client sends', () => {
    const parsed = checkoutInputSchema.parse({
      plan: 'PREMIUM',
      interval: 'MONTHLY',
      priceId: 'price_free',
      price: 0,
      amount: 0,
      currency: 'XXX',
    })

    expect(Object.keys(parsed).sort()).toEqual(['interval', 'plan'])
  })

  it('rejects a plan that is not sellable', () => {
    expect(checkoutInputSchema.safeParse({ plan: 'FREE', interval: 'MONTHLY' }).success).toBe(false)
  })

  it('resolves the price server-side in the checkout route', () => {
    const service = source('src/server/modules/billing/billing.service.ts')

    // The price must come from `resolvePrice`, not from the request.
    expect(service).toContain('resolvePrice(data.plan, data.interval)')
    expect(service).toContain('priceId: resolved.price.priceId')
  })
})

describe('customer ownership', () => {
  it('resolves the customer from the caller’s own row', () => {
    const service = source('src/server/modules/billing/billing.service.ts')

    // The portal function takes only an actor — there is no parameter through
    // which another member's customer id could be supplied.
    expect(service).toMatch(/createPortalSession\(actor: Actor\)/)
    expect(service).toContain('where: { userId: actor.userId }')
  })

  it('accepts no body on the portal route', () => {
    const route = source('src/app/api/billing/portal/route.ts')

    // The handler takes a `Request` only so it can verify the origin. Nothing
    // is read from it — no body means no field through which another member's
    // customer could be named.
    expect(route).not.toContain('request.json()')
    expect(route).not.toContain('request.text()')
    expect(route).not.toContain('request.formData()')

    const uses = route.match(/\brequest\b\.?\w*/g) ?? []
    expect(uses.filter((use) => use !== 'request')).toEqual([])
    expect(route).toContain('requireSameOrigin(request)')
  })

  it('requires an authenticated actor on every billing route', () => {
    for (const path of [
      'src/app/api/billing/checkout/route.ts',
      'src/app/api/billing/portal/route.ts',
      'src/app/api/billing/subscription/route.ts',
    ]) {
      expect(source(path), path).toContain('requireActor()')
    }
  })
})

describe('stub simulator is not reachable in production', () => {
  const route = source('src/app/api/webhooks/stub/route.ts')

  it('refuses unless payments are in stub mode', () => {
    expect(route).toContain('!status.isStub')
  })

  it('refuses in production outright', () => {
    // An endpoint that can grant anyone a subscription must not exist on a
    // real deployment, even one that opted into stub billing.
    expect(route).toContain('isProduction')
    expect(route).toMatch(/status: 404/)
  })

  it('goes through the real webhook handler rather than writing directly', () => {
    expect(route).toContain('handleWebhook(')
    // No direct plan mutation — the only subscription write is attaching the
    // customer, exactly as a real checkout completion would.
    expect(route).not.toMatch(/data:\s*\{[^}]*plan:\s*'PREMIUM'/)
  })
})

describe('entitlement remains the authority', () => {
  it('never decides feature access from a plan check in a component', () => {
    // The chain must stay: provider → subscription → plan → entitlement service.
    const files = [
      'src/modules/billing/upgrade-prompt.tsx',
      'src/modules/billing/checkout-button.tsx',
      'src/server/modules/billing/billing.service.ts',
    ]

    for (const file of files) {
      const content = source(file)
      expect(content, file).not.toMatch(/if\s*\([^)]*plan\s*===\s*['"]PREMIUM['"]\)\s*\{\s*allow/i)
    }
  })

  it('has upgrade copy for every gated entitlement', () => {
    for (const feature of Object.keys(ENTITLEMENTS)) {
      expect(UPGRADE_COPY[feature], feature).toBeDefined()
    }
  })

  it('falls back to generic copy for an unknown feature', () => {
    const copy = upgradeCopyFor('something.new')

    expect(copy.title.length).toBeGreaterThan(0)
    expect(copy.body.length).toBeGreaterThan(0)
  })
})

describe('secrets never reach the client', () => {
  it('keeps payment secrets out of the public env schema', () => {
    const env = source('src/config/env.ts')
    const publicBlock = env.slice(env.indexOf('const publicSchema'))

    for (const secretName of [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
    ]) {
      expect(publicBlock, secretName).not.toContain(secretName)
    }
  })

  it('keeps the Stripe adapter out of client components', () => {
    for (const file of [
      'src/modules/billing/checkout-button.tsx',
      'src/modules/billing/stub-checkout.tsx',
      'src/modules/billing/stub-portal.tsx',
      'src/modules/billing/checkout-status.tsx',
    ]) {
      const content = source(file)
      expect(content, file).not.toContain('integrations/payments')
      expect(content, file).not.toContain('stripe-provider')
    }
  })

  it('writes no payment detail into audit metadata', () => {
    const service = source('src/server/modules/billing/billing.service.ts')
    const auditBlocks = service.match(/writeAudit\(\{[\s\S]*?\}\)/g) ?? []

    expect(auditBlocks.length).toBeGreaterThan(0)
    for (const block of auditBlocks) {
      expect(block).not.toContain('priceId')
      expect(block).not.toContain('externalCustomerId')
      expect(block).not.toContain('secretKey')
    }
  })
})
