'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireActor } from '@/server/auth/actor'
import { actionError, actionOk, type ActionResult } from '@/lib/errors'
import {
  toggleFavouriteBusiness,
  toggleFavouriteDeal,
} from '@/server/modules/discovery/favourite.service'
import {
  cancelRedemption,
  issueRedemption,
  type RedemptionView,
} from '@/server/modules/discovery/redemption.service'

/**
 * Discovery actions.
 *
 * Transport only. Entitlement checks, the active-deal rule, the favourites cap
 * and code generation all live in `src/server/modules/discovery/*`.
 */

const businessIdSchema = z.object({ businessId: z.string().uuid() })
const dealIdSchema = z.object({ dealId: z.string().uuid() })

function revalidateDiscovery() {
  revalidatePath('/app/explore')
  revalidatePath('/app/explore/businesses')
  revalidatePath('/app/explore/deals')
}

export async function toggleFavouriteBusinessAction(
  input: unknown,
): Promise<ActionResult<{ isFavourite: boolean }>> {
  try {
    const actor = await requireActor()
    const { businessId } = businessIdSchema.parse(input)

    const isFavourite = await toggleFavouriteBusiness(actor, businessId)

    revalidateDiscovery()
    return actionOk({ isFavourite })
  } catch (error) {
    return actionError(error)
  }
}

export async function toggleFavouriteDealAction(
  input: unknown,
): Promise<ActionResult<{ isFavourite: boolean }>> {
  try {
    const actor = await requireActor()
    const { dealId } = dealIdSchema.parse(input)

    const isFavourite = await toggleFavouriteDeal(actor, dealId)

    revalidateDiscovery()
    return actionOk({ isFavourite })
  } catch (error) {
    return actionError(error)
  }
}

/**
 * Issue a redemption code.
 *
 * The code only exists once the server has confirmed the deal is live and the
 * member is entitled — a locked deal never produces one, so there is nothing for
 * a free member to read out of the response.
 */
export async function issueRedemptionAction(
  input: unknown,
): Promise<ActionResult<{ redemption: RedemptionView; alreadyIssued: boolean }>> {
  try {
    const actor = await requireActor()
    const { dealId } = dealIdSchema.parse(input)

    const result = await issueRedemption(actor, dealId)

    revalidatePath(`/app/explore/deals/${dealId}`)
    revalidateDiscovery()

    return actionOk(result)
  } catch (error) {
    return actionError(error)
  }
}

export async function cancelRedemptionAction(input: unknown): Promise<ActionResult<null>> {
  try {
    const actor = await requireActor()
    const { dealId } = dealIdSchema.parse(input)

    await cancelRedemption(actor, dealId)

    revalidatePath(`/app/explore/deals/${dealId}`)
    return actionOk(null)
  } catch (error) {
    return actionError(error)
  }
}
