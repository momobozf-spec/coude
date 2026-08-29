import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDb, seedCompensationRules, type TestDb } from '../helpers/test-db'

/**
 * RLS is asserted by behaviour: we sign in as a real, non-superuser role and
 * try to read and write other people's rows. Inspecting pg_policies would only
 * prove policies exist, not that they are correct.
 */

let db: TestDb
let alice: string
let bob: string
let admin: string
let aliceRoute: string
let aliceTrip: string
let aliceClaim: string

beforeAll(async () => {
  db = await createTestDb()
  await seedCompensationRules(db)
})

afterAll(async () => {
  await db.close()
})

beforeEach(async () => {
  await db.sql('delete from public.claims')
  await db.sql('delete from public.monitored_trips')
  await db.sql('delete from public.commute_routes')
  await db.sql('delete from public.profiles')
  await db.sql('delete from public.mandates')
  await db.sql('delete from public.admin_users')
  await db.sql('delete from auth.users')

  alice = await db.createUser('alice@example.be')
  bob = await db.createUser('bob@example.be')
  admin = await db.createUser('admin@railclaim.be')
  await db.makeAdmin(admin)

  for (const [userId, name] of [
    [alice, 'Alice Janssens'],
    [bob, 'Bob Peeters'],
  ] as const) {
    await db.sql(
      `insert into public.profiles (user_id, full_name, email, iban_encrypted)
       values ($1, $2, $3, 'v1:aaa:bbb:ccc')`,
      [userId, name, `${name.split(' ')[0].toLowerCase()}@example.be`],
    )
  }

  const route = await db.sql(
    `insert into public.commute_routes
       (user_id, departure_station_id, arrival_station_id,
        departure_station_name, arrival_station_name,
        preferred_departure_time, days_of_week)
     values ($1, 'BE.NMBS.008814001', 'BE.NMBS.008892007',
             'Brussel-Zuid', 'Gent-Sint-Pieters', '08:12', array[1,2,3,4,5]::smallint[])
     returning id`,
    [alice],
  )
  aliceRoute = route.rows[0].id as string

  const trip = await db.sql(
    `insert into public.monitored_trips
       (route_id, user_id, service_date, actual_arrival_delay_minutes, measurement_status)
     values ($1, $2, current_date, 75, 'MEASURED') returning id`,
    [aliceRoute, alice],
  )
  aliceTrip = trip.rows[0].id as string

  const claim = await db.sql(
    `insert into public.claims
       (user_id, monitored_trip_id, claim_type, status, deadline_at)
     values ($1, $2, 'SINGLE_DELAY', 'AWAITING_USER_CONFIRMATION',
             now() + interval '30 days')
     returning id`,
    [alice, aliceTrip],
  )
  aliceClaim = claim.rows[0].id as string
})

describe('profiles', () => {
  it('lets a user read only their own profile', async () => {
    const result = await db.asUser(alice, 'select user_id, full_name from public.profiles')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].full_name).toBe('Alice Janssens')
  })

  it("hides another user's profile entirely", async () => {
    const result = await db.asUser(bob, 'select * from public.profiles where user_id = $1', [
      alice,
    ])
    expect(result.rows).toHaveLength(0)
  })

  it("refuses to update another user's profile", async () => {
    const result = await db.asUser(
      bob,
      `update public.profiles set full_name = 'Hacked' where user_id = $1 returning id`,
      [alice],
    )
    expect(result.rows).toHaveLength(0)

    const check = await db.sql('select full_name from public.profiles where user_id = $1', [
      alice,
    ])
    expect(check.rows[0].full_name).toBe('Alice Janssens')
  })

  it('refuses to create a profile owned by someone else', async () => {
    await expect(
      db.asUser(
        bob,
        `insert into public.profiles (user_id, full_name, email)
         values ($1, 'Impostor', 'x@example.be')`,
        [alice],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('shows nothing to a signed-out visitor', async () => {
    const result = await db.asAnon('select * from public.profiles')
    expect(result.rows).toHaveLength(0)
  })

  it('lets an admin read any profile', async () => {
    const result = await db.asUser(admin, 'select user_id from public.profiles')
    expect(result.rows.length).toBe(2)
  })
})

describe('commute_routes', () => {
  it("hides another user's routes", async () => {
    const result = await db.asUser(bob, 'select * from public.commute_routes')
    expect(result.rows).toHaveLength(0)
  })

  it("refuses to delete another user's route", async () => {
    await db.asUser(bob, 'delete from public.commute_routes where id = $1', [aliceRoute])
    const check = await db.sql('select id from public.commute_routes where id = $1', [
      aliceRoute,
    ])
    expect(check.rows).toHaveLength(1)
  })

  it('refuses to create a route owned by someone else', async () => {
    await expect(
      db.asUser(
        bob,
        `insert into public.commute_routes
           (user_id, departure_station_id, arrival_station_id,
            departure_station_name, arrival_station_name,
            preferred_departure_time, days_of_week)
         values ($1, 'BE.NMBS.008814001', 'BE.NMBS.008892007', 'A', 'B',
                 '09:00', array[1]::smallint[])`,
        [alice],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('rejects a free-text station id at the schema level', async () => {
    await expect(
      db.asUser(
        alice,
        `insert into public.commute_routes
           (user_id, departure_station_id, arrival_station_id,
            departure_station_name, arrival_station_name,
            preferred_departure_time, days_of_week)
         values ($1, 'Brussel-Zuid', 'BE.NMBS.008892007', 'A', 'B',
                 '09:00', array[1]::smallint[])`,
        [alice],
      ),
    ).rejects.toThrow(/commute_routes_departure_station_id_check/)
  })

  it('rejects an out-of-range weekday', async () => {
    await expect(
      db.asUser(
        alice,
        `insert into public.commute_routes
           (user_id, departure_station_id, arrival_station_id,
            departure_station_name, arrival_station_name,
            preferred_departure_time, days_of_week)
         values ($1, 'BE.NMBS.008814001', 'BE.NMBS.008892007', 'A', 'B',
                 '09:00', array[0,8]::smallint[])`,
        [alice],
      ),
    ).rejects.toThrow(/days_of_week/)
  })
})

describe('monitored_trips and claims', () => {
  it("hides another user's trips and claims", async () => {
    expect((await db.asUser(bob, 'select * from public.monitored_trips')).rows).toHaveLength(0)
    expect((await db.asUser(bob, 'select * from public.claims')).rows).toHaveLength(0)
  })

  it('lets the owner see their own claim', async () => {
    const result = await db.asUser(alice, 'select id, status from public.claims')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].status).toBe('AWAITING_USER_CONFIRMATION')
  })

  it('gives users NO direct update path on claims — not even their own', async () => {
    // There is deliberately no UPDATE policy for the owner: consent must go
    // through confirm_claim() so it is always accompanied by an IP and a lock.
    const result = await db.asUser(
      alice,
      `update public.claims set status = 'CANCELLED' where id = $1 returning id`,
      [aliceClaim],
    )
    expect(result.rows).toHaveLength(0)
  })

  it('does not let a user insert a claim directly', async () => {
    await expect(
      db.asUser(
        alice,
        `insert into public.claims (user_id, monitored_trip_id, claim_type, status, deadline_at)
         values ($1, $2, 'SINGLE_DELAY', 'DETECTED', now() + interval '10 days')`,
        [alice, aliceTrip],
      ),
    ).rejects.toThrow(/row-level security|permission denied/)
  })

  it("hides another user's claim status events", async () => {
    const result = await db.asUser(bob, 'select * from public.claim_status_events')
    expect(result.rows).toHaveLength(0)
  })

  it('lets the owner read their own claim status events', async () => {
    const result = await db.asUser(alice, 'select status from public.claim_status_events')
    expect(result.rows.length).toBeGreaterThan(0)
  })
})

describe('compensation_rules', () => {
  it('is readable by any signed-in user (they are public facts we cite)', async () => {
    const result = await db.asUser(alice, 'select rule_key from public.compensation_rules')
    expect(result.rows.length).toBe(4)
  })

  it('cannot be modified by a normal user', async () => {
    const result = await db.asUser(
      alice,
      `update public.compensation_rules
       set parameters = '{"threshold_minutes": 1}'::jsonb
       where rule_key = 'SINGLE_DELAY' returning rule_key`,
    )
    expect(result.rows).toHaveLength(0)

    const check = await db.sql(
      `select parameters->>'threshold_minutes' as t from public.compensation_rules
       where rule_key = 'SINGLE_DELAY'`,
    )
    expect(check.rows[0].t).toBe('60')
  })

  it('can be modified by an admin', async () => {
    const result = await db.asUser(
      admin,
      `update public.compensation_rules set verified_at = now()
       where rule_key = 'SINGLE_DELAY' returning rule_key`,
    )
    expect(result.rows).toHaveLength(1)
  })
})

describe('mandates', () => {
  it('can be created for yourself and read back', async () => {
    await db.asUser(
      alice,
      `insert into public.mandates (user_id, ip, text_version)
       values ($1, '81.164.20.5'::inet, 'v1-draft')`,
      [alice],
    )
    const result = await db.asUser(alice, 'select text_version from public.mandates')
    expect(result.rows).toHaveLength(1)
  })

  it('cannot be created on behalf of someone else', async () => {
    await expect(
      db.asUser(
        bob,
        `insert into public.mandates (user_id, ip, text_version)
         values ($1, '81.164.20.5'::inet, 'v1-draft')`,
        [alice],
      ),
    ).rejects.toThrow(/row-level security/)
  })
})

describe('internal tables are not exposed to users at all', () => {
  it('denies access to stripe_events', async () => {
    await expect(db.asUser(alice, 'select * from public.stripe_events')).rejects.toThrow(
      /permission denied/,
    )
  })

  it('denies access to worker_heartbeats', async () => {
    await expect(db.asUser(alice, 'select * from public.worker_heartbeats')).rejects.toThrow(
      /permission denied/,
    )
  })

  it('denies reading the admin list (so members cannot be enumerated)', async () => {
    await expect(db.asUser(alice, 'select * from public.admin_users')).rejects.toThrow(
      /permission denied/,
    )
  })

  it('still lets a user ask whether they themselves are an admin', async () => {
    const asUser = await db.asUser(alice, 'select public.is_admin() as v')
    expect(asUser.rows[0].v).toBe(false)

    const asAdmin = await db.asUser(admin, 'select public.is_admin() as v')
    expect(asAdmin.rows[0].v).toBe(true)
  })
})
