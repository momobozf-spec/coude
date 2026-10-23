import bcrypt from 'bcryptjs'

/**
 * Production guard against the development demo accounts.
 *
 * `prisma/seed/demo-user.ts` creates two accounts with a published password
 * (one of them ADMIN). The seed refuses to write them in production, but a
 * database that was seeded in development and then promoted would still carry
 * them. At start-up in production the server therefore refuses to boot while
 * such an account still accepts the demo password.
 *
 * Keep these values in sync with prisma/seed/demo-user.ts (a unit test checks).
 */
export const DEMO_ACCOUNT_EMAILS = ['demo@muslimlife.app', 'admin@muslimlife.app'] as const
export const DEMO_ACCOUNT_PASSWORD = 'MuslimLife2026!'

interface UserLookup {
  user: {
    findMany(args: {
      where: { email: { in: string[] } }
      select: { email: true; passwordHash: true }
    }): Promise<{ email: string; passwordHash: string | null }[]>
  }
}

/** E-mail addresses of demo accounts that still accept the published password. */
export async function findDemoAccountsWithDefaultPassword(db: UserLookup): Promise<string[]> {
  const users = await db.user.findMany({
    where: { email: { in: [...DEMO_ACCOUNT_EMAILS] } },
    select: { email: true, passwordHash: true },
  })
  const exposed: string[] = []
  for (const user of users) {
    if (user.passwordHash && (await bcrypt.compare(DEMO_ACCOUNT_PASSWORD, user.passwordHash))) {
      exposed.push(user.email)
    }
  }
  return exposed
}
