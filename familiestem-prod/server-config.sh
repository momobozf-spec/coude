#!/usr/bin/env bash
# Zet .env op de server klaar en maakt de Stripe-webhook aan. Toont nooit sleutelwaarden.
set -euo pipefail
cd /srv/familiestem
E=.env
sed -i 's/\r$//; 1s/^\xEF\xBB\xBF//' "$E"
setv() { if grep -q "^$1=" "$E"; then sed -i "s|^$1=.*|$1=$2|" "$E"; else echo "$1=$2" >> "$E"; fi; }
get() { grep "^$1=" "$E" | head -1 | cut -d= -f2-; }
setv SMTP_HOST smtp.gmail.com
setv SMTP_PORT 587
setv OPENAI_BASE_URL https://api.openai.com/v1
setv FS_TRANSCRIBE_MODEL gpt-4o-transcribe
setv FS_DOMAIN 49-12-248-61.sslip.io
setv FS_PUBLIC_URL https://49-12-248-61.sslip.io
setv MAIL_FROM "Familiestem <$(get SUPPORT_EMAIL)>"
chmod 600 "$E"
if [ -z "$(get STRIPE_WEBHOOK_SECRET)" ]; then
  SK=$(get STRIPE_SECRET_KEY)
  RESP=$(curl -sS https://api.stripe.com/v1/webhook_endpoints -u "$SK:" \
    -d url="https://49-12-248-61.sslip.io/stripe/webhook" \
    -d "enabled_events[]=checkout.session.completed" \
    -d description="Familiestem server")
  SECRET=$(printf '%s' "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("secret",""))')
  if [ -z "$SECRET" ]; then
    echo "WEBHOOK MISLUKT: $(printf '%s' "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error",{}).get("message","?"))')"
    exit 1
  fi
  setv STRIPE_WEBHOOK_SECRET "$SECRET"
  echo "webhook aangemaakt"
else
  echo "webhook bestond al"
fi
for k in FS_DOMAIN FS_PUBLIC_URL FS_OPS_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET OPENAI_API_KEY SMTP_HOST SMTP_USER SMTP_PASSWORD MAIL_FROM SUPPORT_EMAIL; do
  v=$(get $k); [ -n "$v" ] && echo "$k: ingevuld" || echo "$k: LEEG"
done
