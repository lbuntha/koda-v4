# Koda v4 — Counting Skills Studio

A monorepo: an interactive early-math counting studio (React) plus its API (FastAPI + MongoDB).

```
koda-v4/
├── frontend/     React 19 + Vite studio (see frontend/AGENTS.md for architecture)
├── backend/      FastAPI + MongoDB API — auth, roles, curriculum, events, AI proxy
├── scripts/      dev.sh — the local launcher
├── docker-compose.yml   mongo + api + web
└── Makefile      task runner (run `make` to list targets)
```

## Quick start

Run the whole stack with one command:

```bash
make dev-local     # native processes: MongoDB + FastAPI + Vite (Ctrl+C stops all)
# — or in containers —
make up            # docker: mongo + api + web   →  make down to stop
make seed          # create/reset the admin account
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

Run `make help` for all targets.

## Layout notes

- **`frontend/`** — the React app (was previously at the repo root). Games live in
  `frontend/src/techniques/` (one manifest file per game). See `frontend/AGENTS.md`.
- **`backend/`** — feature-based FastAPI app: `app/core` (config/db/security/deps),
  `app/models` (shared documents), `app/features/<domain>` (router + schemas). See
  `backend/README.md`.
