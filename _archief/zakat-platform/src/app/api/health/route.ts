import { prisma } from '@/server/db/prisma'
import { ok, handler } from '@/server/http/respond'

/** Liveness plus a database round-trip, for the container health check. */
export const GET = handler(async () => {
  await prisma.$queryRaw`SELECT 1`
  return ok({ status: 'ok' })
})

export const dynamic = 'force-dynamic'
