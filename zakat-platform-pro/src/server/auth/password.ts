import 'server-only'

import bcrypt from 'bcryptjs'

const COST = 12

/**
 * A valid bcrypt hash that no password matches. Compared against when the account
 * does not exist so that response timing cannot be used to enumerate users (§46).
 */
export const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO0Vk8bBRhWQ0ZbaHPmvY8gVbEmmv0FYq'

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH)
}
