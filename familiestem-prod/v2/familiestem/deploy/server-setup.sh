#!/usr/bin/env bash
# Eenmalig op een verse Ubuntu 24.04-server (als root): Docker, firewall, automatische updates.
set -euo pipefail

apt-get update
apt-get install -y ca-certificates curl ufw unattended-upgrades
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

dpkg-reconfigure -f noninteractive unattended-upgrades
mkdir -p /srv/familiestem
echo "Server klaar. Volgende stap: scripts/push.sh vanaf je laptop."
