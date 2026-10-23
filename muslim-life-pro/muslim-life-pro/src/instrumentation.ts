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
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(JSON.stringify({ level: 'error', message: 'config.error', detail: error }))
    }
    throw new Error(`Refusing to start: ${errors.length} configuration error(s), see log above.`)
  }
}
