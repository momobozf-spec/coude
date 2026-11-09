-- Beperkte databasegebruiker voor de draaiende API en werker.
--
-- Migraties draaien als de eigenaar (bv. `superette_migrator` of de
-- beheerdersaccount van de provider); de API en de werker krijgen een
-- gebruiker die alleen DML mag — geen DDL, geen DROP, geen andere schema's.
--
-- Uitvoeren als eigenaar van de database, ná `prisma migrate deploy`:
--   psql "$DATABASE_ADMIN_URL" -v password='<sterk wachtwoord>' -f infra/db/create-runtime-user.sql
--
-- Bij elke nieuwe migratie die tabellen toevoegt, geven de ALTER DEFAULT
-- PRIVILEGES hieronder de rechten automatisch door, zolang de migratie door
-- dezelfde eigenaar wordt uitgevoerd. Opnieuw uitvoeren is veilig (idempotent).

\set ON_ERROR_STOP on

-- Rol aanmaken als hij nog niet bestaat; het wachtwoord wordt daarna altijd
-- gezet, zodat dit script ook voor een wachtwoordrotatie dient.
SELECT 'CREATE ROLE superette_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superette_app') \gexec

ALTER ROLE superette_app WITH PASSWORD :'password';

GRANT CONNECT ON DATABASE superette TO superette_app;
GRANT USAGE ON SCHEMA public TO superette_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO superette_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO superette_app;
-- Prisma leest de migratietabel niet tijdens runtime, maar mag hem zeker niet wijzigen.
REVOKE INSERT, UPDATE, DELETE ON TABLE "_prisma_migrations" FROM superette_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO superette_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO superette_app;

-- Verbindingsbudget per rol, zodat één component de pool niet leegtrekt.
ALTER ROLE superette_app CONNECTION LIMIT 40;
-- Een hangende query mag de API niet blokkeren.
ALTER ROLE superette_app SET statement_timeout = '15s';
ALTER ROLE superette_app SET idle_in_transaction_session_timeout = '30s';
