import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'

import {
  DEMO_ACCOUNT_EMAILS,
  DEMO_ACCOUNT_PASSWORD,
  findDemoAccountsWithDefaultPassword,
} from '@/server/ops/demo-account-guard'

/** In-memory stand-in for prisma.user.findMany. */
function fakeDb(users: { email: string; passwordHash: string | null }[]) {
  return {
    user: {
      findMany: async ({ where }: { where: { email: { in: string[] } } }) =>
        users.filter((u) => where.email.in.includes(u.email)),
    },
  }
}

describe('demo-account production guard', () => {
  it('stays in sync with the seed that creates the demo accounts', () => {
    const seed = readFileSync(join(process.cwd(), 'prisma/seed/demo-user.ts'), 'utf8')
    expect(seed).toContain(`'${DEMO_ACCOUNT_PASSWORD}'`)
    for (const email of DEMO_ACCOUNT_EMAILS) expect(seed).toContain(`'${email}'`)
  })

  it('flags a demo account that still accepts the published password', async () => {
    const hash = await bcrypt.hash(DEMO_ACCOUNT_PASSWORD, 4)
    const exposed = await findDemoAccountsWithDefaultPassword(
      fakeDb([{ email: 'admin@muslimlife.app', passwordHash: hash }]),
    )
    expect(exposed).toEqual(['admin@muslimlife.app'])
  })

  it('ignores demo accounts whose password was changed, and real members', async () => {
    const changed = await bcrypt.hash('a-new-strong-password', 4)
    const demoHash = await bcrypt.hash(DEMO_ACCOUNT_PASSWORD, 4)
    const exposed = await findDemoAccountsWithDefaultPassword(
      fakeDb([
        { email: 'demo@muslimlife.app', passwordHash: changed },
        { email: 'member@example.com', passwordHash: demoHash },
        { email: 'admin@muslimlife.app', passwordHash: null },
      ]),
    )
    expect(exposed).toEqual([])
  })
})
