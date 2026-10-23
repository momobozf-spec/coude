import bcrypt from 'bcryptjs'

/**
 * Productie-guard tegen de ontwikkelaccounts.
 *
 * `prisma/seed/users.ts` maakt twee accounts met een gepubliceerd wachtwoord.
 * De seed weigert in productie, maar een database die in ontwikkeling gevuld en
 * daarna naar productie gebracht werd, zou ze nog bevatten. Bij het opstarten in
 * productie weigert de server zolang zo'n account het ontwikkelwachtwoord nog
 * aanvaardt.
 *
 * Synchroon houden met prisma/seed/users.ts (een test controleert dat).
 */
export const DEV_ACCOUNT_EMAILS = ['dev@barakah.local', 'other@barakah.local'] as const
export const DEV_ACCOUNT_PASSWORD = 'barakah-dev-2026'

interface UserLookup {
  user: {
    findMany(args: {
      where: { email: { in: string[] } }
      select: { email: true; passwordHash: true }
    }): Promise<{ email: string; passwordHash: string | null }[]>
  }
}

/** E-mailadressen van ontwikkelaccounts die het gepubliceerde wachtwoord nog aanvaarden. */
export async function findDevAccountsWithDefaultPassword(db: UserLookup): Promise<string[]> {
  const users = await db.user.findMany({
    where: { email: { in: [...DEV_ACCOUNT_EMAILS] } },
    select: { email: true, passwordHash: true },
  })
  const exposed: string[] = []
  for (const user of users) {
    if (user.passwordHash && (await bcrypt.compare(DEV_ACCOUNT_PASSWORD, user.passwordHash))) {
      exposed.push(user.email)
    }
  }
  return exposed
}
