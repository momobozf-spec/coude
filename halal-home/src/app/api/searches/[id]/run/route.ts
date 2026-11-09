import { NextResponse } from 'next/server'

import { requireUserId } from '@/modules/auth/session'
import { runSearch } from '@/modules/search/service'
import { withErrorHandling } from '@/server/api/handler'

type Context = { params: Promise<{ id: string }> }

/**
 * Voert een zoekopdracht uit.
 *
 * Het antwoord bevat `sourceStats`: per bron wat er gehaald is en wat er
 * eventueel misging. Een bron die uitvalt laat de rest doorlopen — dat moet
 * zichtbaar zijn, niet stilzwijgend.
 */
export const POST = withErrorHandling(async (_request: Request, context: Context) => {
  const userId = await requireUserId()
  const { id } = await context.params

  return NextResponse.json({ run: await runSearch(userId, id) })
})
