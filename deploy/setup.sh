#!/usr/bin/env bash
# One-time setup of the CODE76 store on a fresh Ubuntu 24.04 server (AWS Lightsail).
# Safe to run again: steps that are already done are skipped.
#
#   sudo bash /opt/code76/deploy/setup.sh
#
# If ~/code76-live.dump (your store data) is present and the database is empty, it is loaded.
set -euo pipefail

APP_DIR=/opt/code76
DEPLOY="$APP_DIR/deploy"
ENV_FILE="$DEPLOY/.env"
DUMP=/home/ubuntu/code76-live.dump
BACKUPS=/opt/code76-backups

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok() { printf '\033[1;32m%s\033[0m\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo: sudo bash $0"; exit 1; fi
cd "$DEPLOY"

say "1/7 Extra memory (swap) so building never runs out of memory"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap added."
else
  ok "Already there."
fi

say "2/7 Automatic security updates for Ubuntu"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades >/dev/null
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
ok "On: Ubuntu installs security fixes by itself every day."

say "3/7 Docker (runs the database, the server and HTTPS)"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh >/dev/null
  usermod -aG docker ubuntu || true
  ok "Docker installed."
else
  ok "Already installed."
fi

say "4/7 Private settings (passwords are generated here and never leave this server)"
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  cat > "$ENV_FILE" <<EOF
# CODE76 private settings. Never share or commit this file.
DB_PASSWORD=$(openssl rand -hex 24)
SETTINGS_ENCRYPTION_KEY=$(openssl rand -base64 32)
ADMIN_EMAILS=ogspace2025@gmail.com
# Set these once the domain is ready (Claude will tell you the exact values):
API_ADDRESS=:80
CORS_ALLOWED_ORIGINS=
EOF
  chmod 600 "$ENV_FILE"
  ok "Created $ENV_FILE"
else
  ok "Already exists (kept as it is)."
fi

say "5/7 Starting the database"
docker compose up -d db
for _ in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U code76 -d code76 >/dev/null 2>&1; then break; fi
  sleep 2
done
ok "Database is running."

say "6/7 Loading your store data"
tables=$(docker compose exec -T db psql -U code76 -d code76 -tAc "select count(*) from information_schema.tables where table_schema = 'public'" | tr -d '[:space:]')
if [ "$tables" != "0" ]; then
  ok "The database already has data: not touching it."
elif [ -f "$DUMP" ]; then
  docker compose exec -T db pg_restore -U code76 -d code76 --no-owner --no-acl < "$DUMP"
  counts=$(docker compose exec -T db psql -U code76 -d code76 -tA -F ' / ' -c "select (select count(*) from products), (select count(*) from media_assets), (select count(*) from site_content)")
  ok "Loaded. Products / photos / website sections: $counts"
else
  echo "No data file at $DUMP: the store will start empty."
  echo "(To load your data, upload code76-live.dump to /home/ubuntu BEFORE running this script.)"
fi

say "7/7 Building and starting your store (the first build takes about 5-10 minutes)"
docker compose up -d --build
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null http://localhost/api/site 2>/dev/null; then break; fi
  sleep 5
done

# Nightly database backup kept for 7 days (one file per weekday), on top of Lightsail's daily snapshots.
mkdir -p "$BACKUPS"
cat > /etc/cron.d/code76-backup <<EOF
30 2 * * * root cd $DEPLOY && docker compose exec -T db pg_dump -U code76 -Fc code76 > $BACKUPS/code76-\$(date +\%a).dump 2>/dev/null
EOF

if curl -fsS -o /dev/null http://localhost/api/site; then
  ok ""
  ok "DONE! Your store's server is running."
  ok "Test it in your browser: http://$(curl -fsS https://checkip.amazonaws.com 2>/dev/null || echo YOUR-STATIC-IP)/api/health"
else
  echo ""
  echo "The server is still starting or something went wrong. Show Claude the output of:"
  echo "  cd $DEPLOY && sudo docker compose ps && sudo docker compose logs --tail=60 app"
fi
