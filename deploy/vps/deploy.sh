#!/bin/bash
# Put the current Koda on the VPS. Run from your machine or from GitHub Actions:
#
#   VPS=root@<ip> deploy/vps/deploy.sh           pull the images GitHub built
#   VPS=root@<ip> deploy/vps/deploy.sh --build   copy the source, build there
#
# Pulling is the normal path: the web build needs more memory than a server
# shared with other services can spare. Optional environment:
#
#   KODA_TAG                 image tag to run (default: latest)
#   GHCR_USER, GHCR_TOKEN    to pull private images; logged out again after
#
# The server's own .env, secrets/ and backups/ are never overwritten. The
# nginx site is installed the first time and left alone after that. Touches
# nothing on Google Cloud.
set -euo pipefail

: "${VPS:?set VPS, e.g. VPS=root@203.0.113.7}"
REMOTE_DIR=${REMOTE_DIR:-/opt/koda}
KODA_TAG=${KODA_TAG:-latest}
build=false
[ "${1:-}" = "--build" ] && build=true
cd "$(dirname "$0")/../.."

if $build; then
  rsync -az --delete --filter=':- .gitignore' --exclude=.git ./ "$VPS:$REMOTE_DIR/"
else
  ssh "$VPS" "mkdir -p $REMOTE_DIR/deploy/vps"
  rsync -az --delete --exclude=.env --exclude=secrets/ --exclude=backups/ \
    deploy/vps/ "$VPS:$REMOTE_DIR/deploy/vps/"
fi

ssh "$VPS" "test -f $REMOTE_DIR/deploy/vps/.env" || {
  echo "deploy/vps/.env is missing on the server — copy env.example there and fill it in."
  exit 1
}

if [ -n "${GHCR_TOKEN:-}" ]; then
  ssh "$VPS" "docker login ghcr.io -u '${GHCR_USER:?set GHCR_USER with GHCR_TOKEN}' --password-stdin" <<<"$GHCR_TOKEN" >/dev/null
fi

ssh "$VPS" bash -s -- "$REMOTE_DIR" "$KODA_TAG" "$build" <<'REMOTE'
set -euo pipefail
cd "$1/deploy/vps"
export KODA_TAG="$2"
mkdir -p secrets backups

if [ "$3" = true ]; then
  docker compose build app api
else
  docker compose pull --quiet app api
fi
docker logout ghcr.io >/dev/null 2>&1 || true
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

# The nginx site, once. After that it belongs to the server (certbot edits it).
domain=$(grep -E '^DOMAIN=' .env | cut -d= -f2-)
port=$(grep -E '^APP_PORT=' .env | cut -d= -f2-)
port=${port:-3101}
if command -v nginx >/dev/null && [ ! -e /etc/nginx/sites-available/koda ]; then
  sed -e "s/KODA_DOMAIN/$domain/" -e "s/KODA_PORT/$port/" nginx-site.conf > /etc/nginx/sites-available/koda
  ln -sf /etc/nginx/sites-available/koda /etc/nginx/sites-enabled/koda
  nginx -t && systemctl reload nginx
  echo "nginx: site for $domain installed — run certbot for HTTPS (README.md, step 3)"
fi

echo "Waiting for Koda on 127.0.0.1:$port …"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$port/v1/health" 2>/dev/null; then echo; break; fi
  sleep 4
done
curl -fsS -o /dev/null "http://127.0.0.1:$port/" && echo "app: up"
docker compose ps --format 'table {{.Service}}\t{{.Status}}'
REMOTE
