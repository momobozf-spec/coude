import { NextResponse } from 'next/server'

import { requireUserId } from '@/modules/auth/session'
import { getProductView } from '@/modules/financing/service'
import { withErrorHandling } from '@/server/api/handler'

type Context = { params: Promise<{ id: string }> }

export const GET = withErrorHandling(async (_request: Request, context: Context) => {
  await requireUserId()
  const { id } = await context.params

  return NextResponse.json({ product: await getProductView(id) })
})
