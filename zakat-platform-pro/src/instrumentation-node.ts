import { assertProductionConfig } from './config/env'

/** Alleen in de Node-runtime geladen (zie instrumentation.ts). */
export function checkProductionConfigOrExit(): void {
  try {
    assertProductionConfig()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
