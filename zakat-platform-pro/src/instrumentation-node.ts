import { assertProductionConfig } from './config/env'

/** Alleen in de Node-runtime geladen (zie instrumentation.ts). */
export async function checkProductionConfigOrExit(): Promise<void> {
  try {
    assertProductionConfig()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  // Ontwikkelaccounts met het gepubliceerde seed-wachtwoord horen niet in productie.
  if (process.env.NODE_ENV !== 'production') return
  let exposed: string[] = []
  try {
    const [{ prisma }, { findDevAccountsWithDefaultPassword }] = await Promise.all([
      import('./server/db/prisma'),
      import('./server/ops/dev-account-guard'),
    ])
    exposed = await findDevAccountsWithDefaultPassword(prisma)
  } catch (error) {
    // De database kan nog opstarten; /api/ready meldt dat apart.
    console.warn(
      `Controle op ontwikkelaccounts overgeslagen: ${error instanceof Error ? error.message : String(error)}`,
    )
    return
  }
  if (exposed.length > 0) {
    console.error(
      `Productieconfiguratie onveilig: ontwikkelaccount(s) met het seed-wachtwoord bestaan: ${exposed.join(', ')}. Verwijder ze of wijzig het wachtwoord.`,
    )
    process.exit(1)
  }
}
