/**
 * Demo-data voor lokale ontwikkeling. Weigert te draaien met NODE_ENV=production.
 * Wachtwoord voor alle demo-accounts: SEED_PASSWORD (verplicht, min. 10 tekens).
 */
import { createPool, one, withTx } from './db.js';
import { migrate } from './migrate.js';
import { createUser } from './services/accounts.js';

if (process.env.NODE_ENV === 'production') throw new Error('Seed niet toegestaan in productie');
const url = process.env.DATABASE_URL;
const pw = process.env.SEED_PASSWORD;
if (!url) throw new Error('DATABASE_URL ontbreekt');
if (!pw || pw.length < 10) throw new Error('SEED_PASSWORD ontbreekt of is korter dan 10 tekens');

const db = createPool(url);
await migrate(db, console.log);

await withTx(db, async (tx) => {
  if ((await tx.query(`select 1 from users where email = 'admin@ritna.local'`)).rowCount) {
    console.log('Seed bestaat al, niets gedaan.');
    return;
  }
  const admin = await createUser(tx, { role: 'platform_admin', email: 'admin@ritna.local', password: pw, fullName: 'Ritna Beheer' });
  const op = await one<{ id: string }>(
    tx,
    `insert into operators (legal_name, trade_name, slug, enterprise_number, exploitation_license_ref, status, phone, email,
       service_center_lat, service_center_lng, service_radius_m, verified_at, verified_by, payout_account_ref)
     values ('Demo Taxi BV', 'Demo Taxi', 'demo-taxi', '0400.000.086', 'DEMO-LIC', 'active', '+3220000000', 'demo@ritna.local',
       50.8467, 4.3525, 25000, now(), $1, 'acct_demo') returning id`,
    [admin.id],
  );
  const opAdmin = await createUser(tx, { role: 'operator_admin', email: 'taxi@ritna.local', password: pw, fullName: 'Demo Taxibedrijf' });
  await tx.query('insert into operator_users values ($1, $2)', [op.id, opAdmin.id]);
  await tx.query(
    `insert into operator_tariffs (operator_id, category, base_fare, per_km, per_minute, minimum_fare, night_surcharge)
     values ($1, 'standard', 250, 200, 30, 1200, 300), ($1, 'van', 400, 260, 35, 2000, 300)`,
    [op.id],
  );
  const v = await one<{ id: string }>(
    tx,
    `insert into vehicles (operator_id, plate, make, model, category, seats, luggage_capacity)
     values ($1, '1-DEM-001', 'Toyota', 'Corolla', 'standard', 4, 3) returning id`,
    [op.id],
  );
  const dUser = await createUser(tx, { role: 'driver', email: 'chauffeur@ritna.local', password: pw, fullName: 'Demo Chauffeur', phone: '+32470000000' });
  await tx.query(
    `insert into drivers (operator_id, user_id, status, is_available, current_vehicle_id, can_accept_requests) values ($1, $2, 'active', true, $3, true)`,
    [op.id, dUser.id, v.id],
  );
  await createUser(tx, { role: 'customer', email: 'klant@ritna.local', password: pw, fullName: 'Demo Klant' });
  console.log('Demo-accounts: admin@ / taxi@ / chauffeur@ / klant@ritna.local');
});
await db.end();
