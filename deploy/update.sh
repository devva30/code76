#!/usr/bin/env bash
# Puts the latest code from GitHub live. Run after pushing changes:
#
#   sudo bash /opt/code76/deploy/update.sh
set -euo pipefail
cd /opt/code76
git pull --ff-only
cd deploy
docker compose up -d --build
docker image prune -f >/dev/null
echo "Updated. Running now:"
docker compose ps
