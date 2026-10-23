import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'

import {
  DEV_ACCOUNT_EMAILS,
  DEV_ACCOUNT_PASSWORD,
  findDevAccountsWithDefaultPassword,
} from '@/server/ops/dev-account-guard'

function fakeDb(users: { email: string; passwordHash: string | null }[]) {
  return {
    user: {
      findMany: async ({ where }: { where: { email: { in: string[] } } }) =>
        users.filter((u) => where.email.in.includes(u.email)),
    },
  }
}

describe('productie-guard ontwikkelaccounts', () => {
  it('blijft synchroon met de seed', () => {
    const seed = readFileSync(join(process.cwd(), 'prisma/seed/users.ts'), 'utf8')
    expect(seed).toContain(`'${DEV_ACCOUNT_PASSWORD}'`)
    for (const email of DEV_ACCOUNT_EMAILS) expect(seed).toContain(`'${email}'`)
  })

  it('vindt een ontwikkelaccount dat het seed-wachtwoord nog aanvaardt', async () => {
    const hash = await bcrypt.hash(DEV_ACCOUNT_PASSWORD, 4)
    expect(await findDevAccountsWithDefaultPassword(fakeDb([{ email: 'dev@barakah.local', passwordHash: hash }]))).toEqual([
      'dev@barakah.local',
    ])
  })

  it('negeert gewijzigde wachtwoorden en echte gebruikers', async () => {
    const changed = await bcrypt.hash('een-nieuw-sterk-wachtwoord', 4)
    const seedHash = await bcrypt.hash(DEV_ACCOUNT_PASSWORD, 4)
    expect(
      await findDevAccountsWithDefaultPassword(
        fakeDb([
          { email: 'dev@barakah.local', passwordHash: changed },
          { email: 'iemand@example.com', passwordHash: seedHash },
          { email: 'other@barakah.local', passwordHash: null },
        ]),
      ),
    ).toEqual([])
  })
})
