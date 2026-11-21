#!/bin/bash
# Deploy from this Mac, sending only what changed.
#
#   deploy/vps/push-from-mac.sh            build HEAD, push to ghcr.io, run it on the VPS
#
# Builds the app and API images (linux/amd64) from a clean worktree of HEAD,
# so uncommitted edits never ship. They are pushed to ghcr.io tagged with the
# commit; a registry only takes the layers it does not have, and the VPS only
# pulls the layers it does not have — a usual code change is tens of MB, not
# the ~400MB a `docker save` of whole images was.
#
# On the server the running images are kept as :prev (roll back with
# `docker tag …:prev …:local && docker compose up -d api app`), the new ones
# are tagged :local (what .env's KODA_TAG runs) and api + app restart.
#
# Needs: `gh auth refresh -s write:packages` once, and `gh variable get` access
# for the web build's VITE_* values. Optional: VPS (default root@37.44.244.129).
set -euo pipefail

VPS="${VPS:-root@37.44.244.129}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SHA="$(git -C "$REPO" rev-parse --short HEAD)"
WT="$(mktemp -d)/koda-$SHA"
APP=ghcr.io/lbuntha/koda-app
API=ghcr.io/lbuntha/koda-api

cleanup() { git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

var() { (cd "$REPO" && gh variable get "$1"); }

echo "→ worktree of $SHA"
git -C "$REPO" worktree add --detach "$WT" HEAD >/dev/null

echo "→ ghcr.io login"
gh auth token | docker login ghcr.io -u "$(gh api user -q .login)" --password-stdin >/dev/null

echo "→ building app"
docker build --platform linux/amd64 --target prod -t "$APP:$SHA" \
  --build-arg VITE_GOOGLE_CLIENT_ID="$(var GOOGLE_CLIENT_ID)" \
  --build-arg VITE_FIREBASE_API_KEY="$(var VITE_FIREBASE_API_KEY)" \
  --build-arg VITE_FIREBASE_PROJECT_ID="$(var VITE_FIREBASE_PROJECT_ID)" \
  --build-arg VITE_FIREBASE_APP_ID="$(var VITE_FIREBASE_APP_ID)" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="$(var VITE_FIREBASE_MESSAGING_SENDER_ID)" \
  --build-arg VITE_FIREBASE_VAPID_KEY="$(var VITE_FIREBASE_VAPID_KEY)" \
  "$WT" -q >/dev/null
echo "→ building api"
docker build --platform linux/amd64 -t "$API:$SHA" "$WT/server" -q >/dev/null
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep ":$SHA"

echo "→ pushing (only new layers upload)"
docker push -q "$APP:$SHA"
docker push -q "$API:$SHA"

echo "→ VPS: pull, keep :prev, restart"
ssh -o ConnectTimeout=20 -o ServerAliveInterval=15 "$VPS" bash -s -- "$SHA" <<'REMOTE'
set -euo pipefail
SHA="$1"
cd /opt/koda/deploy/vps
grep -q '^KODA_TAG=local$' .env || { echo "expected KODA_TAG=local in .env"; exit 1; }
for img in ghcr.io/lbuntha/koda-app ghcr.io/lbuntha/koda-api; do
  docker pull -q "$img:$SHA"
  docker image inspect "$img:local" >/dev/null 2>&1 && docker tag "$img:local" "$img:prev"
  docker tag "$img:$SHA" "$img:local"
done
docker compose up -d api app
for i in $(seq 1 40); do
  s=$(curl -s -m 3 http://127.0.0.1:3101/v1/health || true)
  echo "$s" | grep -q '"ok"' && break
  sleep 3
done
echo "health: $s"
docker compose ps --format '{{.Name}} {{.Image}} {{.Status}}' | grep -E 'api|app'
docker image prune -f >/dev/null
REMOTE
echo "✓ deployed $SHA"
