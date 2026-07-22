#!/usr/bin/env bash
#
# Koda dev launcher — starts MongoDB (if needed), the FastAPI backend, and the
# Vite frontend together, wired to talk to each other. Ctrl+C stops everything.
#
#   ./scripts/dev.sh            # run all three
#   make dev-local             # same, via the Makefile
#
# First run auto-provisions: backend venv + deps, backend/.env (with a generated
# JWT secret), and frontend .env.local (pointing the app at the local API).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
MONGO_PORT="${MONGO_PORT:-27017}"

C_API=$'\033[36m'; C_WEB=$'\033[35m'; C_SYS=$'\033[32m'; C_ERR=$'\033[31m'; C_OFF=$'\033[0m'
say()  { printf '%s[dev]%s %s\n' "$C_SYS" "$C_OFF" "$1"; }
err()  { printf '%s[dev]%s %s\n' "$C_ERR" "$C_OFF" "$1" >&2; }

cleanup() {
  trap - INT TERM EXIT
  echo
  say "shutting down…"
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

port_open() { (exec 3<>"/dev/tcp/localhost/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; }; return 1; }

# ── MongoDB ──────────────────────────────────────────────────────────────────
ensure_mongo() {
  # Skip local startup if the backend points at a remote Mongo (e.g. Atlas).
  if [ -f "$BACKEND/.env" ] && grep -qE '^MONGO_URI=.*(mongodb\+srv|@)' "$BACKEND/.env"; then
    say "backend/.env uses a remote MONGO_URI — skipping local MongoDB startup"
    return 0
  fi
  if port_open "$MONGO_PORT"; then say "✓ MongoDB already running on :$MONGO_PORT"; return 0; fi

  say "MongoDB not running — attempting to start it…"
  if command -v brew >/dev/null 2>&1 && brew list mongodb-community >/dev/null 2>&1; then
    brew services start mongodb-community >/dev/null 2>&1 || true
  elif command -v mongod >/dev/null 2>&1; then
    mkdir -p "$HOME/.koda/mongo"
    mongod --dbpath "$HOME/.koda/mongo" --port "$MONGO_PORT" --fork \
           --logpath "$HOME/.koda/mongo/mongod.log" >/dev/null 2>&1 || true
  else
    err "MongoDB not found. Install it (brew install mongodb-community) or set a remote MONGO_URI in backend/.env"
    return 1
  fi

  for _ in $(seq 1 20); do port_open "$MONGO_PORT" && { say "✓ MongoDB started"; return 0; }; sleep 0.5; done
  err "Could not reach MongoDB on :$MONGO_PORT — start it manually and re-run."
  return 1
}

# ── Backend provisioning ─────────────────────────────────────────────────────
ensure_backend() {
  if [ ! -d "$BACKEND/.venv" ]; then
    say "first run: creating backend venv + installing deps (this is a one-time step)…"
    python3 -m venv "$BACKEND/.venv" || { err "failed to create venv"; return 1; }
    "$BACKEND/.venv/bin/pip" install -q --upgrade pip
    "$BACKEND/.venv/bin/pip" install -q -r "$BACKEND/requirements.txt" || { err "pip install failed"; return 1; }
  fi
  if [ ! -f "$BACKEND/.env" ]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    if command -v openssl >/dev/null 2>&1; then
      secret="$(openssl rand -hex 32)"
      sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$secret|" "$BACKEND/.env"
    fi
    say "created backend/.env (JWT secret generated; add OPENAI_API_KEY to enable AI generation)"
  fi
}

# ── Frontend provisioning ────────────────────────────────────────────────────
ensure_frontend() {
  [ -d "$FRONTEND/node_modules" ] || { say "installing frontend deps…"; (cd "$FRONTEND" && npm install); }
  # Point the app at the local API (idempotent; .env.local is git-ignored).
  if [ ! -f "$FRONTEND/.env.local" ] || ! grep -q '^VITE_API_URL=' "$FRONTEND/.env.local"; then
    echo "VITE_API_URL=http://localhost:$BACKEND_PORT" >> "$FRONTEND/.env.local"
    say "set VITE_API_URL in frontend/.env.local → http://localhost:$BACKEND_PORT"
  fi
}

# ── Runners (line-prefixed output) ───────────────────────────────────────────
run_api() {
  cd "$BACKEND"
  ./.venv/bin/uvicorn app.main:app --reload --port "$BACKEND_PORT" 2>&1 \
    | while IFS= read -r l; do printf '%s[api]%s %s\n' "$C_API" "$C_OFF" "$l"; done
}
run_web() {
  cd "$FRONTEND"
  npm run dev 2>&1 \
    | while IFS= read -r l; do printf '%s[web]%s %s\n' "$C_WEB" "$C_OFF" "$l"; done
}

# ── Go ───────────────────────────────────────────────────────────────────────
ensure_mongo    || exit 1
ensure_backend  || exit 1
ensure_frontend || exit 1

port_open "$BACKEND_PORT"  && err "warning: port $BACKEND_PORT already in use (backend)"
port_open "$FRONTEND_PORT" && err "warning: port $FRONTEND_PORT already in use (frontend)"

say "starting backend + frontend — press Ctrl+C to stop both"
say "  API : http://localhost:$BACKEND_PORT   (docs at /docs)"
say "  App : http://localhost:$FRONTEND_PORT"

run_api &
run_web &
wait
