'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { AppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { serverEnv } from '@/config/env'
import { requireAdmin } from '@/server/auth/actor'
import { publishPrice, syncEcbRates } from '@/server/modules/prices/service'

export interface PriceFormState {
  ok: boolean
  message: string | null
}

const formSchema = z.object({
  kind: z.enum(['GOLD_PER_GRAM', 'SILVER_PER_GRAM', 'FX_PER_EUR']),
  currency: z.string().trim().min(3).max(3),
  value: z.string().trim().min(1).max(40),
  effectiveDate: z.string().trim(),
  source: z.string().trim(),
})

export async function publishPriceAction(
  _previous: PriceFormState,
  form: FormData,
): Promise<PriceFormState> {
  const actor = await requireAdmin()

  const parsed = formSchema.safeParse({
    kind: form.get('kind'),
    currency: form.get('kind') === 'FX_PER_EUR' ? form.get('currency') : 'EUR',
    value: form.get('value'),
    effectiveDate: form.get('effectiveDate'),
    source: form.get('source'),
  })
  if (!parsed.success) return { ok: false, message: 'Vul alle velden in.' }

  try {
    await publishPrice(actor, parsed.data)
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message }
    throw error
  }

  revalidatePath('/admin/prijzen')
  return { ok: true, message: 'Gepubliceerd.' }
}

export async function syncEcbAction(_previous: PriceFormState): Promise<PriceFormState> {
  await requireAdmin()

  try {
    const result = await syncEcbRates()
    revalidatePath('/admin/prijzen')
    const parts = [`${result.published.length} koers(en) bijgewerkt`]
    if (result.missing.length) parts.push(`ontbrekend bij de ECB: ${result.missing.join(', ')}`)
    if (result.manualOnly.length) parts.push(`zelf te publiceren: ${result.manualOnly.join(', ')}`)
    return { ok: true, message: `${parts.join('; ')}.` }
  } catch (error) {
    logger.error('prices.ecb_sync_failed', {
      message: error instanceof Error ? error.message : 'unknown',
      configured: serverEnv().FX_SYNC,
    })
    return { ok: false, message: 'De ECB-koersen ophalen lukte niet. Probeer later opnieuw of publiceer ze met de hand.' }
  }
}
