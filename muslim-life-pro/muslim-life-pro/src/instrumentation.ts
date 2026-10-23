/**
 * Runs once when the server starts. In production a configuration that would
 * run insecurely stops the boot here, with a readable list in the log.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { checkProductionEnv } = await import('@/config/production-check')
  const { errors, warnings } = checkProductionEnv()

  for (const warning of warnings) {
    console.warn(JSON.stringify({ level: 'warn', message: 'config.warning', detail: warning }))
  }

  // Demo accounts with the published seed password must never live in production.
  if (process.env.NODE_ENV === 'production' && errors.length === 0) {
    try {
      const [{ prisma }, { findDemoAccountsWithDefaultPassword }] = await Promise.all([
        import('@/server/db/prisma'),
        import('@/server/ops/demo-account-guard'),
      ])
      const exposed = await findDemoAccountsWithDefaultPassword(prisma)
      if (exposed.length > 0) {
        errors.push(
          `Demo account(s) with the published seed password exist: ${exposed.join(', ')}. Delete them or change their password.`,
        )
      }
    } catch (error) {
      // The database may still be starting; /api/ready reports that separately.
      console.warn(
        JSON.stringify({
          level: 'warn',
          message: 'config.demo_account_check_skipped',
          detail: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(JSON.stringify({ level: 'error', message: 'config.error', detail: error }))
    }
    throw new Error(`Refusing to start: ${errors.length} configuration error(s), see log above.`)
  }
}
