#!/usr/bin/env bash
# Migratietest, lokaal en in CI. Vereist een bereikbare Postgres waarop
# databases aangemaakt mogen worden, en een gebouwde API (`npm run build -w @superette/api`).
#
#   DATABASE_ADMIN_URL=postgresql://superette:superette@127.0.0.1:5432/postgres \
#     bash apps/api/scripts/migration-test.sh
#
#   A. drift: komen de migraties overeen met schema.prisma?
#   B. lege database: `migrate deploy` + compare-seed; rijtelling.
#   C. database met bestaande boetiekdata (alleen de baseline), gevuld met een
#      gebruiker, toestemmingen, winkelsessie, bestelling en kasbon; daarna
#      `migrate deploy`; boetiekdata moet ongewijzigd zijn.
#   D. rollback: de laatste migratie terugdraaien met het down-script en
#      opnieuw toepassen; rijtellingen vóór en ná.
set -uo pipefail
cd "$(dirname "$0")/.."

ADMIN="${DATABASE_ADMIN_URL:-postgresql://superette:superette@127.0.0.1:5432/postgres}"
BASE="${ADMIN%/*}"
STAMP="$(date +%s)"
EMPTY_DB="mig_empty_$STAMP"
JJ_DB="mig_jj_$STAMP"
SHADOW_DB="mig_shadow_$STAMP"
failures=0

filter() { grep -vE "prisma-config|deprecated|^$|Script executed|Environment variables loaded" || true; }
sql() { echo "$2" | npx prisma db execute --url "$1" --stdin 2>&1 | filter; }
tables() { DATABASE_URL="$1" node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe(\"select count(*)::int as n from information_schema.tables where table_schema='public'\").then(r=>{console.log('tabellen:',r[0].n);return p.\$disconnect()})"; }
counts() { DATABASE_URL="$1" node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const c={};for(const m of ['user','product','order','receipt','consent','storeChain','catalogProduct','productOffer','priceHistory','session','jobLease']){try{c[m]=await p[m].count()}catch{c[m]='-'}}console.log(JSON.stringify(c));await p.\$disconnect()})()"; }
expect() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; else echo "  ✗ $1 (verwacht $3, kreeg $2)"; failures=$((failures+1)); fi; }

echo "=============== A. DRIFT ==============="
sql "$ADMIN" "CREATE DATABASE $SHADOW_DB;"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$BASE/$SHADOW_DB?schema=public" --exit-code 2>&1 | filter
expect "migraties == schema (geen drift)" "${PIPESTATUS[0]}" "0"

echo
echo "=============== B. LEGE DATABASE ==============="
sql "$ADMIN" "CREATE DATABASE $EMPTY_DB;"
EMPTY="$BASE/$EMPTY_DB?schema=public"
DATABASE_URL="$EMPTY" npx prisma migrate deploy 2>&1 | filter | tail -3
DATABASE_URL="$EMPTY" npx prisma migrate status 2>&1 | filter | tail -1
status_out="$(DATABASE_URL="$EMPTY" npx prisma migrate status 2>&1)"
expect "status: up to date" "$(echo "$status_out" | grep -c 'up to date')" "1"
tables "$EMPTY"
echo "-- compare-seed (demogegevens) op de lege database:"
seed_out="$(DATABASE_URL="$EMPTY" COMPARE_ALLOW_DEMO=true node dist/compare/cli/sync.cli.js 2>&1)"; seed_exit=$?
echo "$seed_out" | grep -E "^[✓△✗]|Klaar" | head -9
if [ "$seed_exit" -ne 0 ]; then echo "$seed_out" | grep -vE "^\s*at " | tail -6 | sed 's/^/     /'; fi
expect "seed-CLI eindigt zonder fout (omgeving compleet: JWT_SECRET, sleutels, database)" "$seed_exit" "0"
echo "-- rijtellingen:"; counts "$EMPTY"
chains="$(DATABASE_URL="$EMPTY" node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.storeChain.count().then(n=>{console.log(n);return p.\$disconnect()})")"
expect "zeven ketens na seed" "$chains" "7"

echo
echo "=============== C. BESTAANDE BOETIEKDATA ==============="
sql "$ADMIN" "CREATE DATABASE $JJ_DB;"
JJ="$BASE/$JJ_DB?schema=public"
echo "-- 1. alleen de baseline"
npx prisma db execute --url "$JJ" --file prisma/migrations/0_init_jamal_jamila/migration.sql 2>&1 | filter
DATABASE_URL="$JJ" npx prisma migrate resolve --applied 0_init_jamal_jamila 2>&1 | filter | tail -1
echo "-- 2. boetiekdata"
DATABASE_URL="$JJ" npx tsx prisma/seed.ts 2>&1 | tail -1
DATABASE_URL="$JJ" node -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const store=await p.store.findFirstOrThrow();
  const user=await p.user.create({data:{email:'migratie-test@example.com',password:'x',fullName:'Migratie Test'}});
  await p.consent.createMany({data:[{userId:user.id,type:'ACCESS_LOG',granted:true,policyVersion:'2026-07-01'},{userId:user.id,type:'CAMERA',granted:true,policyVersion:'2026-07-01'}]});
  const product=await p.product.findFirstOrThrow();
  const basket=await p.basket.create({data:{userId:user.id,storeId:store.id,status:'PAID',items:{create:[{productId:product.id,quantity:2,unitPriceInclCents:product.priceInclCents,vat:product.vat}]}}});
  const order=await p.order.create({data:{orderNumber:'JJ-TEST-0001',userId:user.id,storeId:store.id,basketId:basket.id,status:'PAID',totalExclCents:5702,totalVatCents:1198,totalInclCents:6900,vatBuckets:[],paymentMethod:'BANCONTACT',items:{create:[{productId:product.id,nameNl:product.nameNl,nameFr:product.nameFr,quantity:2,unitPriceInclCents:product.priceInclCents,lineTotalInclCents:product.priceInclCents*2,vat:product.vat}]}}});
  await p.receipt.create({data:{orderId:order.id,invoiceNumber:'JJ/2026/000001',snapshot:{orderNumber:order.orderNumber}}});
  await p.\$disconnect();
})().catch(e=>{console.error(e.message);process.exit(1)});"
before="$(counts "$JJ")"; echo "-- vóór: $before"
echo "-- 3. migrate deploy"
DATABASE_URL="$JJ" npx prisma migrate deploy 2>&1 | filter | grep -E "Applying|applied|rror|up to date"
after="$(counts "$JJ")"; echo "-- ná:   $after"
jj_before="$(echo "$before" | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log([c.user,c.product,c.order,c.receipt,c.consent].join('/'))")"
jj_after="$(echo "$after" | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log([c.user,c.product,c.order,c.receipt,c.consent].join('/'))")"
expect "boetiekrijen ongewijzigd (users/products/orders/receipts/consents)" "$jj_after" "$jj_before"
snapshot="$(DATABASE_URL="$JJ" node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.receipt.findFirstOrThrow().then(r=>{console.log(JSON.stringify(r.snapshot));return p.\$disconnect()})")"
expect "kasbon-snapshot intact" "$snapshot" '{"orderNumber":"JJ-TEST-0001"}'

echo
echo "=============== D. ROLLBACK VAN DE LAATSTE MIGRATIE ==============="
LAST="20261004210000_sessies_privacy_jobs"
DATABASE_URL="$JJ" COMPARE_ALLOW_DEMO=true node dist/compare/cli/sync.cli.js >/dev/null 2>&1
full="$(counts "$JJ")"; echo "-- gemigreerd + gevuld: $full"
npx prisma db execute --url "$JJ" --file "prisma/rollback/$LAST.down.sql" 2>&1 | filter
# `migrate resolve --rolled-back` werkt alleen voor een MISLUKTE migratie; een
# geslaagde migratie handmatig terugdraaien = down-script + de rij verwijderen.
sql "$JJ" "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '$LAST';"
rolled="$(counts "$JJ")"; echo "-- na rollback: $rolled"
expect "sessietabel weg na rollback" "$(echo "$rolled" | grep -o '"session":"-"' | wc -l | tr -d ' ')" "1"
expect "migratie staat als pending" "$(DATABASE_URL="$JJ" npx prisma migrate status 2>&1 | grep -c "$LAST")" "1"
expect "boetiek- en vergelijkerdata blijven staan" "$(echo "$rolled" | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log([c.user,c.order,c.storeChain,c.catalogProduct,c.productOffer].join('/'))")" "$(echo "$full" | node -e "const c=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log([c.user,c.order,c.storeChain,c.catalogProduct,c.productOffer].join('/'))")"
redeploy="$(DATABASE_URL="$JJ" npx prisma migrate deploy 2>&1)"
echo "$redeploy" | filter | grep -E "Applying|applied|rror|up to date"
expect "migratie opnieuw toegepast" "$(echo "$redeploy" | grep -c "Applying migration \`$LAST\`")" "1"
again="$(counts "$JJ")"; echo "-- opnieuw toegepast: $again"
expect "sessietabel terug na herhaalde deploy" "$(echo "$again" | grep -o '"session":0' | wc -l | tr -d ' ')" "1"
expect "status up to date na herhaalde deploy" "$(DATABASE_URL="$JJ" npx prisma migrate status 2>&1 | grep -c 'up to date')" "1"

echo
echo "=============== OPRUIMEN ==============="
for db in "$EMPTY_DB" "$JJ_DB" "$SHADOW_DB"; do sql "$ADMIN" "DROP DATABASE IF EXISTS $db;"; done
echo
if [ "$failures" -eq 0 ]; then echo "MIGRATIETEST GESLAAGD"; else echo "MIGRATIETEST: $failures controle(s) mislukt"; fi
exit "$failures"
