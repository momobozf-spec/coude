// Maakt een lokale database aan in UTF-8 als ze nog niet bestaat. Gebruik: node maak-db.mjs <naam>
import pg from 'pg';
const name = process.argv[2];
if (!/^[a-z_][a-z0-9_]{0,40}$/.test(name ?? '')) { console.error('Gebruik: node maak-db.mjs <naam> (kleine letters, cijfers, _)'); process.exit(1); }
const c = new pg.Client({ connectionString: 'postgres://postgres:lokaal@localhost:54329/postgres' });
await c.connect();
const r = await c.query('select 1 from pg_database where datname = $1', [name]);
if (r.rowCount) console.log(`${name} bestaat al`);
else { await c.query(`create database ${name} encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0`); console.log(`${name} aangemaakt (UTF-8)`); }
await c.end();
