# Koda API

The data half of Koda: accounts, roles, and (from P1) sync. The design and the
reasoning behind every choice here are in [`../docs/BACKEND.md`](../docs/BACKEND.md).

```bash
make dev-local            # from the repo root — app, Mongo and this service
curl localhost:8000/v1/health
open http://localhost:8000/v1/docs
```

Running it on its own, against a Mongo you already have:

```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
pytest
python -m app.cli migrate
python -m app.cli create-admin --email you@example.com --password '…'
```

## Layout

```
app/
  main.py        the app factory: lifespan, CORS, routers under /v1
  settings.py    every environment variable, read once
  db.py          the Motor client
  indexes.py     every index in one list — this is the migration story
  rbac.py        the permission table; the only place a role is named
  deps.py        principal() · require(*perms)
  errors.py      AppError → one JSON shape
  cli.py         migrate · create-admin
  models/        the wire, and nothing about storage
  repos/         data access, one module per collection; base.py enforces tenancy
  services/      rules that span collections
  routers/       thin: validate, call a service, return a model
```

`routers → services → repos → Motor`. A router never touches the driver; a repo
never imports a router.
