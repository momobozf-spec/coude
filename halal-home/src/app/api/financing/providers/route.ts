import { NextResponse } from 'next/server'

import { requireUserId } from '@/modules/auth/session'
import { listProviders } from '@/modules/financing/repository'
import { assertDemoNeverVerified } from '@/modules/financing/domain/demo'
import { withErrorHandling } from '@/server/api/handler'

export const GET = withErrorHandling(async (request: Request) => {
  await requireUserId()
  const country = new URL(request.url).searchParams.get('country') ?? undefined

  const providers = await listProviders(country)

  // Ook via de API kan een verzonnen aanbieder nooit als geverifieerd
  // doorgaan: de controle staat in het domein en geldt voor elk kanaal.
  for (const provider of providers) {
    assertDemoNeverVerified(provider, `Aanbieder ${provider.name}`)
  }

  return NextResponse.json({ providers })
})
