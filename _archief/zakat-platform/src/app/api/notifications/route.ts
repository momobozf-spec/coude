import { requireActor } from '@/server/auth/actor'
import { handler, ok } from '@/server/http/respond'
import { listNotifications } from '@/server/modules/notifications/service'

export const GET = handler(async () => {
  const actor = await requireActor()
  return ok(await listNotifications(actor))
})

export const dynamic = 'force-dynamic'
