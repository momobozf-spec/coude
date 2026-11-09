'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import { runReconciliation } from '@/server/modules/admin/operations.service'

const schema = z.object({ userId: z.string().uuid() })

/**
 * Reconcile one subscription.
 *
 * Authorization is not checked here — `runReconciliation` calls `requireAdmin()`
 * itself. Server Actions are public endpoints, so the guard belongs in the
 * service where it cannot be forgotten by a new caller.
 */
export async function runReconciliationAction(
  input: unknown,
): Promise<ActionResult<{ reconciled: boolean; reason?: string }>> {
  try {
    const { userId } = schema.parse(input)
    const result = await runReconciliation(userId)

    revalidatePath('/admin/operations')
    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}
