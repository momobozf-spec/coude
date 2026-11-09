// Maakt alleen tenderkompas_test opnieuw aan in UTF-8 (testdatabase, wordt bij elke testrun toch leeggemaakt).
import pg from 'pg';
const c = new pg.Client({ connectionString: 'postgres://postgres:lokaal@localhost:54329/postgres' });
await c.connect();
await c.query('drop database if exists tenderkompas_test');
await c.query("create database tenderkompas_test encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0");
console.log('tenderkompas_test opnieuw aangemaakt in UTF-8');
await c.end();
