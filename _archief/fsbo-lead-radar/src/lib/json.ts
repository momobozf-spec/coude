import type { Prisma } from '@prisma/client'

/**
 * Zet een willekeurige waarde om in iets dat Prisma in een `Json`-kolom mag
 * schrijven.
 *
 * De omweg via `JSON.stringify`/`parse` is geen omslachtigheid maar de hele
 * functie: bronpayloads bevatten `Date`-objecten en soms een circulaire
 * verwijzing, en Prisma accepteert alleen echte JSON. Een `as`-cast zou het
 * typesysteem stilzetten en de fout naar runtime verplaatsen — precies bij het
 * opslaan van een advertentie, dus midden in de pijplijn.
 *
 * Een waarde die niet serialiseerbaar is (circulair, BigInt) levert `undefined`
 * op: het veld wordt dan niet geschreven. De ruwe payload is diagnostisch, geen
 * bedrijfsgegeven; hem missen is beter dan de advertentie verliezen.
 */
export function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined

  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) return undefined
    return JSON.parse(serialized) as Prisma.InputJsonValue
  } catch {
    return undefined
  }
}
