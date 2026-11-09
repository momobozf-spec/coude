#!/usr/bin/env bash
# Back-up- en hersteloefening (docs/DATABASE.md): logische back-up met pg_dump,
# herstel in een lege database, rijtellingen per tabel vergelijken, één record
# inhoudelijk vergelijken, en de hersteldatabase onder de applicatie zetten
# (migratiestatus "up to date").
#
#   PG_BIN=/pad/naar/pgsql/bin \
#   DATABASE_ADMIN_URL=postgresql://eigenaar:…@host:5432/superette?sslmode=require \
#     bash apps/api/scripts/backup-drill.sh [doelmap]
#
# De eigenaar-URL wordt alleen voor dump/restore gebruikt; de runtime-gebruiker
# heeft daar bewust geen rechten voor.
set -uo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-}"; [ -n "$PG_BIN" ] && PG_BIN="${PG_BIN%/}/"
SRC="${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL ontbreekt}"
OUT="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RESTORE_DB="superette_restore_$STAMP"
DUMP="$OUT/superette-$STAMP.dump"
failures=0
mkdir -p "$OUT"

expect() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (verwacht $3, kreeg $2)"; failures=$((failures+1)); fi; }
admin_db() { echo "$SRC" | sed -E 's#/[^/?]+(\?|$)#/postgres\1#'; }
restore_url() { echo "$SRC" | sed -E "s#/[^/?]+(\?|\$)#/$RESTORE_DB\1#"; }
counts() { "${PG_BIN}psql" "$1" -tA -c "select string_agg(format('%s=%s', relname, n_live_tup), ',' order by relname) from pg_stat_user_tables" ; }
# psql op Windows levert CRLF; de \r moet weg vóór de tabelnaam in een query belandt.
exact_counts() { "${PG_BIN}psql" "$1" -tA -c "select string_agg(relname, ',' order by relname) from pg_stat_user_tables" | tr -d '\r' | tr ',' '\n' | while read -r t; do [ -n "$t" ] && printf '%s=%s\n' "$t" "$("${PG_BIN}psql" "$1" -tA -c "select count(*) from \"$t\"" | tr -d '\r')"; done | sort | tr '\n' ' '; }

echo "=============== 1. BACK-UP (pg_dump, custom format) ==============="
start=$(date +%s)
"${PG_BIN}pg_dump" "$SRC" --format=custom --no-owner --no-privileges --file "$DUMP" 2>&1 | tail -3
expect "dumpbestand aangemaakt" "$([ -s "$DUMP" ] && echo ja || echo nee)" "ja"
echo "  grootte: $(du -h "$DUMP" | cut -f1), duur: $(( $(date +%s) - start )) s"
before="$(exact_counts "$SRC")"
echo "  rijen bron: $before"

echo
echo "=============== 2. HERSTEL IN EEN LEGE DATABASE ==============="
"${PG_BIN}psql" "$(admin_db)" -q -c "CREATE DATABASE \"$RESTORE_DB\";" 2>&1 | tail -1
start=$(date +%s)
"${PG_BIN}pg_restore" --dbname "$(restore_url)" --no-owner --no-privileges --exit-on-error "$DUMP" 2>&1 | tail -3
expect "pg_restore zonder fouten" "${PIPESTATUS[0]}" "0"
echo "  duur: $(( $(date +%s) - start )) s"
after="$(exact_counts "$(restore_url)")"
echo "  rijen hersteld: $after"
expect "rijtellingen per tabel identiek" "$after" "$before"

echo
echo "=============== 3. INHOUDELIJKE CONTROLE ==============="
sample_src="$("${PG_BIN}psql" "$SRC" -tA -c "select md5(string_agg(id || ':' || email || ':' || status, ',' order by id)) from \"User\"")"
sample_dst="$("${PG_BIN}psql" "$(restore_url)" -tA -c "select md5(string_agg(id || ':' || email || ':' || status, ',' order by id)) from \"User\"")"
expect "gebruikers inhoudelijk identiek (md5 over id/e-mail/status)" "$sample_dst" "$sample_src"
offers_src="$("${PG_BIN}psql" "$SRC" -tA -c "select md5(string_agg(id || ':' || \"priceCents\", ',' order by id)) from \"ProductOffer\"")"
offers_dst="$("${PG_BIN}psql" "$(restore_url)" -tA -c "select md5(string_agg(id || ':' || \"priceCents\", ',' order by id)) from \"ProductOffer\"")"
expect "aanbiedingen inhoudelijk identiek (md5 over id/prijs)" "$offers_dst" "$offers_src"
mig_dst="$("${PG_BIN}psql" "$(restore_url)" -tA -c "select count(*) from \"_prisma_migrations\" where finished_at is not null")"
expect "migratiegeschiedenis mee hersteld (3 migraties)" "$mig_dst" "3"
status_out="$(DATABASE_URL="$(restore_url)" npx prisma migrate status 2>&1)"
expect "prisma migrate status: up to date op de hersteldatabase" "$(echo "$status_out" | grep -c 'up to date')" "1"

echo
echo "=============== 4. OPRUIMEN ==============="
"${PG_BIN}psql" "$(admin_db)" -q -c "DROP DATABASE \"$RESTORE_DB\";" 2>&1 | tail -1
echo "  dump bewaard: $DUMP"
echo
if [ "$failures" -eq 0 ]; then echo "HERSTELOEFENING GESLAAGD"; else echo "HERSTELOEFENING: $failures controle(s) mislukt"; fi
exit "$failures"
