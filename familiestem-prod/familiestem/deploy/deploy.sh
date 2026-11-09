#!/usr/bin/env bash
# Draait OP de server in /srv/familiestem. Bouwt, start en controleert de app.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "FOUT: .env ontbreekt. Kopieer .env.example naar .env en vul alles in." >&2
  exit 1
fi

mkdir -p data
chown -R 10001:10001 data

docker compose build
docker compose up -d

echo "Wachten tot de app gezond is..."
for i in $(seq 1 30); do
  if docker compose exec -T app python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/healthz')" 2>/dev/null; then
    echo "App draait."
    break
  fi
  if [ "$i" = 30 ]; then
    echo "FOUT: app start niet. Laatste logregels:" >&2
    docker compose logs --tail=40 app >&2
    exit 1
  fi
  sleep 2
done

docker compose exec -T app python -m app.seed_demo
echo "Klaar. Controleer nu vanaf je laptop: python3 scripts/smoke.py https://$(grep ^FS_DOMAIN= .env | cut -d= -f2)"
