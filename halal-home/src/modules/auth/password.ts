/**
 * Wachtwoord-hashing. Apart van config.ts zodat de seed hem kan importeren
 * zonder de hele Auth.js-configuratie op te tuigen.
 */
import 'server-only'
import bcrypt from 'bcryptjs'

/**
 * 12 rondes. Genoeg om brute-force op een gelekte database duur te maken,
 * laag genoeg om een login onder ~250 ms te houden op bescheiden hardware.
 */
const ROUNDS = 12

/**
 * Een geldige bcrypt-hash van een willekeurige string. Wordt gebruikt als
 * dummy wanneer het account niet bestaat, zodat het vergelijken evenveel tijd
 * kost en de responstijd niet verklapt welke e-mailadressen geregistreerd zijn.
 */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO2/Ux5.PWzRLHV2kBBRUvXTZlL5S1jUC'

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  const result = await bcrypt.compare(plain, hash ?? DUMMY_HASH)
  // Zonder hash is er niets om tegen te vergelijken; het werk hierboven is
  // uitsluitend gedaan om de timing gelijk te houden.
  return hash === null ? false : result
}
