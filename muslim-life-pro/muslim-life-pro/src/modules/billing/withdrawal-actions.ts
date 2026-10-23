'use server'

import { headers } from 'next/headers'

import { clientIpFrom, trustedProxyHops } from '@/server/http/client-ip'
import { submitWithdrawal } from '@/server/modules/billing/withdrawal.service'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'

/** Online withdrawal statement (see withdrawal.service.ts). */
export async function withdrawalAction(
  formData: FormData,
): Promise<ActionResult<{ receivedAt: string; acknowledged: boolean }>> {
  try {
    const headerList = await headers()
    const ip = clientIpFrom(headerList.get('x-forwarded-for'), trustedProxyHops())
    const receipt = await submitWithdrawal(
      {
        name: formData.get('name'),
        email: formData.get('email'),
        confirm: formData.get('confirm') === 'true',
      },
      ip,
    )
    return actionOk({ receivedAt: receipt.receivedAt.toISOString(), acknowledged: receipt.acknowledged })
  } catch (error) {
    return actionError(error)
  }
}
