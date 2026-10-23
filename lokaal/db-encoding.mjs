// Toont de encoding van de lokale databases (alleen lezen).
import pg from 'pg';
const c = new pg.Client({ connectionString: 'postgres://postgres:lokaal@localhost:54329/postgres' });
await c.connect();
const r = await c.query("select datname, pg_encoding_to_char(encoding) as enc, datcollate from pg_database where datname not like 'template%' order by 1");
for (const row of r.rows) console.log(`${row.datname.padEnd(20)} ${row.enc.padEnd(10)} ${row.datcollate}`);
await c.end();
