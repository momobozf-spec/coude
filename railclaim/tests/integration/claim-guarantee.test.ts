import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestDb, seedCompensationRules, type TestDb } from '../helpers/test-db'

/**
 * The non-negotiable product invariant:
 *
 *   No claim can ever reach a submitted state without an explicit, timestamped
 *   confirmation from the user that they actually made the trip.
 *
 * Submitting a compensation claim for a journey someone did not take is fraud
 * in that person's name. These tests prove the database refuses it — including
 * when the caller is the service role, which bypasses RLS entirely. A bug in
 * application code cannot get around a CHECK constraint.
 */

let db: TestDb
let userId: string
let routeId: string
let tripId: string

const FUTURE_DEADLINE = "now() + interval '30 days'"

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
  await db.sql('delete from public.admin_users')
  await db.sql('delete from auth.users')

  userId = await db.createUser('pendelaar@example.be')

  const route = await db.sql(
    `insert into public.commute_routes
       (user_id, departure_station_id, arrival_station_id,
        departure_station_name, arrival_station_name,
        preferred_departure_time, days_of_week)
     values ($1, 'BE.NMBS.008814001', 'BE.NMBS.008892007',
             'Brussel-Zuid', 'Gent-Sint-Pieters', '08:12', array[1,2,3,4,5]::smallint[])
     returning id`,
    [userId],
  )
  routeId = route.rows[0].id as string

  const trip = await db.sql(
    `insert into public.monitored_trips
       (route_id, user_id, service_date, train_number, vehicle_id,
        actual_arrival_delay_minutes, measurement_status)
     values ($1, $2, current_date, '527', 'BE.NMBS.IC527', 72, 'MEASURED')
     returning id`,
    [routeId, userId],
  )
  tripId = trip.rows[0].id as string
})

async function insertClaim(status = 'AWAITING_USER_CONFIRMATION'): Promise<string> {
  const result = await db.sql(
    `insert into public.claims
       (user_id, monitored_trip_id, claim_type, status, deadline_at,
        compensation_amount_expected_cents)
     values ($1, $2, 'SINGLE_DELAY', $3, ${FUTURE_DEADLINE}, 1160)
     returning id`,
    [userId, tripId, status],
  )
  return result.rows[0].id as string
}

describe('a claim cannot be submitted without user confirmation', () => {
  const forbiddenStates = [
    'CONFIRMED',
    'IN_ADMIN_REVIEW',
    'SUBMITTED',
    'AWAITING_NMBS',
    'APPROVED',
    'REJECTED',
  ]

  for (const status of forbiddenStates) {
    it(`refuses to INSERT a claim directly into ${status}`, async () => {
      await expect(insertClaim(status)).rejects.toThrow(
        /claims_confirmation_required|claims_submitted_has_timestamp/,
      )
    })
  }

  it('refuses to UPDATE an unconfirmed claim into SUBMITTED', async () => {
    const claimId = await insertClaim()
    await expect(
      db.sql(
        `update public.claims set status = 'SUBMITTED', submitted_at = now() where id = $1`,
        [claimId],
      ),
    ).rejects.toThrow(/claims_confirmation_required|illegal status transition/)
  })

  it('refuses even for the SERVICE ROLE, which bypasses RLS', async () => {
    const claimId = await insertClaim()
    await expect(
      db.asServiceRole(
        `update public.claims set status = 'CONFIRMED' where id = $1`,
        [claimId],
      ),
    ).rejects.toThrow(/claims_confirmation_required/)
  })

  it('refuses a confirmation timestamp without an IP, and vice versa', async () => {
    const claimId = await insertClaim()
    await expect(
      db.sql(`update public.claims set user_confirmed_at = now() where id = $1`, [claimId]),
    ).rejects.toThrow(/claims_confirmation_is_complete/)

    await expect(
      db.sql(`update public.claims set confirmation_ip = '1.2.3.4'::inet where id = $1`, [
        claimId,
      ]),
    ).rejects.toThrow(/claims_confirmation_is_complete/)
  })

  it('allows EXPIRED and CANCELLED without confirmation — nothing was filed', async () => {
    const claimId = await insertClaim()
    await expect(
      db.sql(`update public.claims set status = 'EXPIRED' where id = $1`, [claimId]),
    ).resolves.toBeDefined()
  })
})

describe('confirm_claim() is the only path to consent', () => {
  it('records the timestamp and IP and moves the claim to CONFIRMED', async () => {
    const claimId = await insertClaim()

    const result = await db.asUser(
      userId,
      `select status, user_confirmed_at, confirmation_ip
       from public.confirm_claim($1::uuid, $2::inet)`,
      [claimId, '81.164.20.5'],
    )

    expect(result.rows[0].status).toBe('CONFIRMED')
    expect(result.rows[0].user_confirmed_at).toBeTruthy()
    expect(String(result.rows[0].confirmation_ip)).toBe('81.164.20.5')
  })

  it("refuses to confirm another user's claim", async () => {
    const claimId = await insertClaim()
    const attacker = await db.createUser('attacker@example.be')

    await expect(
      db.asUser(attacker, `select public.confirm_claim($1::uuid, $2::inet)`, [
        claimId,
        '81.164.20.5',
      ]),
    ).rejects.toThrow(/not your claim/)
  })

  it('refuses when the user is not signed in', async () => {
    const claimId = await insertClaim()
    await expect(
      db.asAnon(`select public.confirm_claim($1::uuid, $2::inet)`, [claimId, '81.164.20.5']),
    ).rejects.toThrow(/authentication required|permission denied/)
  })

  it('refuses to confirm the same claim twice', async () => {
    const claimId = await insertClaim()
    await db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
      claimId,
      '81.164.20.5',
    ])

    await expect(
      db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
        claimId,
        '81.164.20.5',
      ]),
    ).rejects.toThrow(/not awaiting confirmation/)
  })

  it('refuses to confirm after the deadline has passed', async () => {
    const expired = await db.sql(
      `insert into public.claims
         (user_id, monitored_trip_id, claim_type, status, deadline_at)
       values ($1, $2, 'SINGLE_DELAY', 'AWAITING_USER_CONFIRMATION',
               now() - interval '1 day')
       returning id`,
      [userId, tripId],
    )

    await expect(
      db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
        expired.rows[0].id,
        '81.164.20.5',
      ]),
    ).rejects.toThrow(/deadline/)
  })

  it('requires an IP — consent without provenance is not consent', async () => {
    const claimId = await insertClaim()
    await expect(
      db.asUser(userId, `select public.confirm_claim($1::uuid, null::inet)`, [claimId]),
    ).rejects.toThrow(/IP is required/)
  })
})

describe('consent is immutable once given', () => {
  it('refuses to change user_confirmed_at afterwards', async () => {
    const claimId = await insertClaim()
    await db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
      claimId,
      '81.164.20.5',
    ])

    await expect(
      db.sql(
        `update public.claims set user_confirmed_at = now() - interval '10 days' where id = $1`,
        [claimId],
      ),
    ).rejects.toThrow(/immutable/)
  })

  it('refuses to change the confirmation IP afterwards', async () => {
    const claimId = await insertClaim()
    await db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
      claimId,
      '81.164.20.5',
    ])

    await expect(
      db.sql(`update public.claims set confirmation_ip = '9.9.9.9'::inet where id = $1`, [
        claimId,
      ]),
    ).rejects.toThrow(/immutable/)
  })
})

describe('status machine', () => {
  it('rejects a transition that skips confirmation', async () => {
    const claimId = await insertClaim('DETECTED')
    await expect(
      db.sql(`update public.claims set status = 'CONFIRMED' where id = $1`, [claimId]),
    ).rejects.toThrow(/claims_confirmation_required|illegal status transition/)
  })

  it('rejects moving out of a terminal state', async () => {
    const claimId = await insertClaim()
    await db.sql(`update public.claims set status = 'CANCELLED' where id = $1`, [claimId])

    await expect(
      db.sql(
        `update public.claims set status = 'AWAITING_USER_CONFIRMATION' where id = $1`,
        [claimId],
      ),
    ).rejects.toThrow(/illegal status transition/)
  })

  it('allows the full happy path through to APPROVED', async () => {
    const claimId = await insertClaim()
    await db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
      claimId,
      '81.164.20.5',
    ])

    await db.sql(`update public.claims set status = 'IN_ADMIN_REVIEW' where id = $1`, [claimId])
    await db.sql(
      `update public.claims set status = 'SUBMITTED', submitted_at = now() where id = $1`,
      [claimId],
    )
    await db.sql(`update public.claims set status = 'AWAITING_NMBS' where id = $1`, [claimId])
    await db.sql(
      `update public.claims
       set status = 'APPROVED', compensation_amount_received_cents = 1160
       where id = $1`,
      [claimId],
    )

    const final = await db.sql(`select status from public.claims where id = $1`, [claimId])
    expect(final.rows[0].status).toBe('APPROVED')
  })
})

describe('idempotency', () => {
  it('allows only one claim per user per monitored trip', async () => {
    await insertClaim()
    await expect(insertClaim()).rejects.toThrow(/claims_unique_per_trip/)
  })

  it('allows only one monitored trip per route per service date', async () => {
    await expect(
      db.sql(
        `insert into public.monitored_trips (route_id, user_id, service_date)
         values ($1, $2, current_date)`,
        [routeId, userId],
      ),
    ).rejects.toThrow(/monitored_trips_unique_per_route_day/)
  })

  it('requires a SINGLE_DELAY claim to reference the trip it is based on', async () => {
    await expect(
      db.sql(
        `insert into public.claims (user_id, claim_type, status, deadline_at)
         values ($1, 'SINGLE_DELAY', 'DETECTED', ${FUTURE_DEADLINE})`,
        [userId],
      ),
    ).rejects.toThrow(/claims_single_delay_has_trip/)
  })
})

describe('audit trail', () => {
  it('logs every status change automatically', async () => {
    const claimId = await insertClaim()
    await db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
      claimId,
      '81.164.20.5',
    ])
    await db.sql(`update public.claims set status = 'IN_ADMIN_REVIEW' where id = $1`, [claimId])

    const events = await db.sql(
      `select status, source from public.claim_status_events
       where claim_id = $1 order by created_at`,
      [claimId],
    )

    const statuses = events.rows.map((r) => r.status)
    expect(statuses).toContain('AWAITING_USER_CONFIRMATION')
    expect(statuses).toContain('CONFIRMED')
    expect(statuses).toContain('IN_ADMIN_REVIEW')
  })

  it('attributes a user confirmation to the USER, not to the system', async () => {
    const claimId = await insertClaim()
    await db.asUser(userId, `select public.confirm_claim($1::uuid, $2::inet)`, [
      claimId,
      '81.164.20.5',
    ])

    const events = await db.sql(
      `select source, actor_id from public.claim_status_events
       where claim_id = $1 and status = 'CONFIRMED'`,
      [claimId],
    )
    expect(events.rows[0].source).toBe('USER')
    expect(events.rows[0].actor_id).toBe(userId)
  })
})
