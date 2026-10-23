import { after, type NextRequest } from 'next/server'

import { handler, ok } from '@/server/http/respond'
import { clientIp, trustedProxyHops } from '@/server/http/client-ip'
import { requestPasswordReset } from '@/server/modules/account/service'
import { resetRequestSchema } from '@/modules/auth/schemas'

/**
 * Altijd hetzelfde antwoord, even snel, of het adres nu bestaat of niet. De limieten
 * (per IP en per adres) zitten in de service en zijn ook stil.
 */
export const POST = handler(async (request: NextRequest) => {
  const { email } = resetRequestSchema.parse(await request.json())
  const ip = clientIp(request.headers, trustedProxyHops())
  // Na het antwoord uitvoeren: anders verraadt de responstijd (mail versturen
  // of niet) of het adres een account heeft.
  after(() => requestPasswordReset(email, ip))
  return ok({ accepted: true })
})

export const dynamic = 'force-dynamic'
