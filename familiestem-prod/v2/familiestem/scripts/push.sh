#!/usr/bin/env bash
# Vanaf je laptop: kopieert de code naar de server (zonder data en .env) en start de deploy.
# Gebruik: scripts/push.sh root@JOUW_SERVER_IP
set -euo pipefail
TARGET="${1:?Gebruik: scripts/push.sh root@SERVER_IP}"
cd "$(dirname "$0")/.."

rsync -az --delete \
  --exclude data --exclude .env --exclude '__pycache__' --exclude .pytest_cache --exclude '*.zip' \
  ./ "$TARGET:/srv/familiestem/"
ssh "$TARGET" "bash /srv/familiestem/deploy/deploy.sh"
