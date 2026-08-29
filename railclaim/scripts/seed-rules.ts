import { createClient } from '@supabase/supabase-js'

import { VERIFIED_COMPENSATION_RULES } from '../src/lib/compensation/verified-rules'

/**
 * Seed the verified NMBS compensation rules into `compensation_rules`.
 *
 * This is REFERENCE DATA, not demo data: every row is a rule read off an
 * official NMBS page, carrying its source URL and verification date
 * (docs/nmbs-regels.md). Running this on a fresh environment is mandatory —
 * without it the detection engine refuses to evaluate anything rather than
 * fall back to assumed thresholds.
 *
 * Idempotent: safe to re-run.
 */
async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed.',
    )
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const rows = VERIFIED_COMPENSATION_RULES.map((rule) => ({
    rule_key: rule.rule_key,
    parameters: rule.parameters,
    source_url: rule.source_url,
    verified_at: rule.verified_at,
  }))

  const { error } = await supabase
    .from('compensation_rules')
    .upsert(rows, { onConflict: 'rule_key' })

  if (error) {
    throw new Error(`Failed to seed compensation rules: ${error.message}`)
  }

  for (const row of rows) {
    console.log(`  ${row.rule_key.padEnd(18)} verified ${row.verified_at.slice(0, 10)}`)
  }
  console.log(`\nSeeded ${rows.length} verified compensation rules.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
