'use server'

import { revalidatePath } from 'next/cache'

import { isSourceAllowedByEnv } from '@/collectors/registry'
import { sourceFormSchema } from '@/domain/schemas'
import { requireAdmin } from '@/lib/auth'
import { updateSourceSettings } from '@/repositories/sourceRepository'
import { writeAudit } from '@/services/auditService'

export interface SourceActionState {
  error?: string
  ok?: string
}

export async function saveSource(
  _prev: SourceActionState,
  formData: FormData,
): Promise<SourceActionState> {
  await requireAdmin()

  const parsed = sourceFormSchema.safeParse({
    key: formData.get('key'),
    enabled: formData.get('enabled') === 'on',
    pollIntervalSeconds: formData.get('pollIntervalSeconds'),
    rateLimitPerMinute: formData.get('rateLimitPerMinute'),
    timeoutMs: formData.get('timeoutMs'),
    maxRetries: formData.get('maxRetries'),
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Ongeldige invoer' }
  }

  // De env-allowlist is de bovenliggende schakelaar. Een bron hier aanzetten
  // die daar niet in staat zou een knop opleveren die niets doet — beter is het
  // meteen te zeggen.
  if (parsed.data.enabled && !isSourceAllowedByEnv(parsed.data.key)) {
    return {
      error: `"${parsed.data.key}" staat niet in COLLECTOR_ENABLED_SOURCES. Zet hem daar eerst bij; anders slaat de scheduler de bron over.`,
    }
  }

  await updateSourceSettings(parsed.data.key, {
    enabled: parsed.data.enabled,
    pollIntervalSeconds: parsed.data.pollIntervalSeconds,
    rateLimitPerMinute: parsed.data.rateLimitPerMinute,
    timeoutMs: parsed.data.timeoutMs,
    maxRetries: parsed.data.maxRetries,
  })

  await writeAudit({
    actor: 'admin',
    action: parsed.data.enabled ? 'ENABLE_SOURCE' : 'DISABLE_SOURCE',
    entityType: 'Source',
    entityId: parsed.data.key,
    metadata: {
      pollIntervalSeconds: parsed.data.pollIntervalSeconds,
      rateLimitPerMinute: parsed.data.rateLimitPerMinute,
    },
  })

  revalidatePath('/admin/sources')
  revalidatePath('/admin')
  return { ok: `Bron "${parsed.data.key}" bijgewerkt` }
}
