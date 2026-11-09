#!/bin/bash
# From your machine:  VPS=root@<server-ip> deploy/vps/deploy.sh
#
# Copies this working tree to the server and rebuilds there. Copies what is on
# disk, committed or not, and skips whatever .gitignore skips — so the
# server's own .env, secrets/ and backups/ are never overwritten or deleted.
# Touches nothing on Google Cloud.
set -euo pipefail

: "${VPS:?set VPS, e.g. VPS=root@203.0.113.7}"
REMOTE_DIR=${REMOTE_DIR:-/opt/koda}
cd "$(dirname "$0")/../.."

rsync -az --delete --filter=':- .gitignore' --exclude=.git ./ "$VPS:$REMOTE_DIR/"

ssh "$VPS" "cd $REMOTE_DIR/deploy/vps \
  && test -f .env || { echo 'deploy/vps/.env is missing on the server (see README.md)'; exit 1; } \
  && mkdir -p secrets backups \
  && docker compose up -d --build --remove-orphans \
  && docker image prune -f >/dev/null \
  && docker compose ps"

domain=$(ssh "$VPS" "grep -E '^DOMAIN=' $REMOTE_DIR/deploy/vps/.env | cut -d= -f2-")
echo "Checking https://$domain …"
curl -fsS --retry 10 --retry-all-errors --retry-delay 6 "https://$domain/v1/health" && echo
curl -fsS -o /dev/null "https://$domain/" && echo "app: up"
