#!/usr/bin/env bash
# Rooktest: start de drie edge functions lokaal met Deno en nagebootste externe diensten.
# Draai vanuit de projectmap: bash supabase/tests/smoke.sh
set -uo pipefail
cd "$(dirname "$0")/.."
WORK=$(mktemp -d)
export FAKE_LOG="$WORK/requests.log"
export SITE_URL="https://andere-shop.test" STRIPE_WEBHOOK_SECRET="whsec_van_sterrenboek" TM_SITE_URL="https://tafelmoord.test" STRIPE_SECRET_KEY="sk_test_fake" TM_STRIPE_PRICES='{"oudejaar-nl":"price_fake_nl"}' \
       TM_STRIPE_TAX_RATE_ID="txr_fake" TM_STRIPE_WEBHOOK_SECRET="whsec_fake" SUPABASE_URL="https://fake.supabase.co" \
       SUPABASE_SERVICE_ROLE_KEY="service_fake" RESEND_API_KEY="re_fake" TM_MAIL_FROM="Tafelmoord <hallo@tafelmoord.test>"
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then echo "  OK   $1"; PASS=$((PASS+1)); else echo "  FOUT $1 (verwacht $3, kreeg $2)"; FAIL=$((FAIL+1)); fi; }

stop() { # stopt de draaiende functie en wacht tot poort 8000 vrij is
  pkill -f "fake_services.ts" 2>/dev/null
  for _ in $(seq 1 40); do curl -s -o /dev/null localhost:8000 || return 0; sleep 0.25; done
  echo "Poort 8000 blijft bezet"; exit 1
}
start() { # $1 functie, $2 poort
  stop
  ( cd functions && deno run -A --preload ../tests/fake_services.ts "$1/index.ts" >"$WORK/$1.out" 2>&1 & echo $! >"$WORK/$1.pid" )
  for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$2" && return 0; sleep 0.5; done
  echo "Kon $1 niet starten:"; cat "$WORK/$1.out"; exit 1
}
code() { curl -s -o "$WORK/body" -w "%{http_code}" "$@"; }

# Deno.serve luistert standaard op 8000; poort via env PORT werkt niet, dus één voor één.
echo "tafelmoord-checkout"
start tafelmoord-checkout 8000
J='content-type: application/json'
check "zonder vinkje -> 400"     "$(code -X POST localhost:8000 -H "$J" -d '{"product":"oudejaar-nl","waiver":false}')" 400
check "onbekend spel -> 400"     "$(code -X POST localhost:8000 -H "$J" -d '{"product":"bestaat-niet","waiver":true}')" 400
check "zonder product -> 400"    "$(code -X POST localhost:8000 -H "$J" -d '{"waiver":true}')" 400
check "NL volwassenen -> 200"    "$(code -X POST localhost:8000 -H "$J" -d '{"product":"oudejaar-nl","waiver":true}')" 200
check "antwoord bevat Stripe-url" "$(grep -c 'checkout.stripe.com' "$WORK/body")" 1
check "FR kinderen -> 200"       "$(code -X POST localhost:8000 -H "$J" -d '{"product":"taart-fr","waiver":true}')" 200
check "GET -> 405" "$(code localhost:8000)" 405
check "precies 2 Stripe-calls" "$(grep -c 'api.stripe.com' "$FAKE_LOG")" 2
check "NL-call: Price ID + NL-locale" "$(grep 'metadata%5Bproduct%5D=oudejaar-nl' "$FAKE_LOG" | grep 'price_fake_nl' | grep -c 'locale=nl')" 1
check "FR-call: catalogusprijs + FR-locale" "$(grep 'metadata%5Bproduct%5D=taart-fr' "$FAKE_LOG" | grep 'unit_amount%5D=1900' | grep -c 'locale=fr')" 1
check "gebruikt TM_SITE_URL, niet die van sterrenboek" "$(grep 'api.stripe.com' "$FAKE_LOG" | grep -c 'andere-shop')" 0
check "beide calls met herroepingsmetadata" "$(grep -c 'withdrawal_waiver%5D=true' "$FAKE_LOG")" 2
stop

echo "tafelmoord-download"
start tafelmoord-download 8000
check "betaald NL -> 200"    "$(code 'localhost:8000?session_id=cs_test_paidSESSION0001')" 200
check "juist bestand NL"     "$(grep -c 'oudejaar-nl.zip?token=abc' "$WORK/body")" 1
check "betaald FR kids -> 200" "$(code 'localhost:8000?session_id=cs_test_paidKIDSFR00001')" 200
check "juist bestand FR kids" "$(grep -c 'taart-fr.zip?token=abc' "$WORK/body")" 1
check "ander product -> 404" "$(code 'localhost:8000?session_id=cs_test_otherSHOP00001')" 404
check "onbetaald -> 402"     "$(code 'localhost:8000?session_id=cs_test_unpaidSESSION01')" 402
check "te oud -> 410"        "$(code 'localhost:8000?session_id=cs_test_oldSESSION00001')" 410
check "ongeldig id -> 400"   "$(code 'localhost:8000?session_id=../../etc')" 400
check "onbekend -> 500"      "$(code 'localhost:8000?session_id=cs_test_unknownSESSION1')" 500
stop

echo "tafelmoord-webhook"
start tafelmoord-webhook 8000
EVENT='{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_paidKIDSFR00001","payment_status":"paid","amount_total":1900,"currency":"eur","livemode":false,"metadata":{"product":"taart-fr","withdrawal_waiver_at":"2026-11-09T15:00:00Z"},"customer_details":{"email":"klant@example.com"}}}}'
T=$(date +%s)
SIG=$(printf '%s' "$T.$EVENT" | openssl dgst -sha256 -hmac "$TM_STRIPE_WEBHOOK_SECRET" | awk '{print $NF}')
SIG_ANDER=$(printf '%s' "$T.$EVENT" | openssl dgst -sha256 -hmac "whsec_van_sterrenboek" | awk '{print $NF}')
check "webhook-geheim van sterrenboek -> 400" "$(code -X POST localhost:8000 -H "stripe-signature: t=$T,v1=$SIG_ANDER" -d "$EVENT")" 400
check "foute handtekening -> 400" "$(code -X POST localhost:8000 -H "stripe-signature: t=$T,v1=dead" -d "$EVENT")" 400
check "geldig event -> 200"       "$(code -X POST localhost:8000 -H "stripe-signature: t=$T,v1=$SIG" -d "$EVENT")" 200
check "zelfde event opnieuw -> 200" "$(code -X POST localhost:8000 -H "stripe-signature: t=$T,v1=$SIG" -d "$EVENT")" 200
check "precies 1 mail verstuurd (idempotent)" "$(grep -c 'api.resend.com' "$FAKE_LOG")" 1
check "Franse mail met FR-downloadlink" "$(grep 'api.resend.com' "$FAKE_LOG" | grep 'Ton jeu est pr' | grep -c '/fr/bedankt.html?session_id=cs_test_paidKIDSFR00001')" 1
check "bestelling met product naar db (2 events, ontdubbeld door upsert)" "$(grep '/rest/v1/tafelmoord_orders' "$FAKE_LOG" | grep -c '"product\\":\\"taart-fr')" 2
stop

echo; echo "Geslaagd: $PASS  Mislukt: $FAIL"
rm -rf "$WORK"
[ "$FAIL" -eq 0 ]
