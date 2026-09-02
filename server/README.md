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

## Google sign-in

Koda uses Google only to prove identity; the API then issues its normal Koda
access and refresh tokens. To enable it:

1. In Google Cloud, open **Google Auth Platform**, configure Branding and
   Audience, then create a **Web application** client.
2. Add `http://localhost:3001` and every production page origin (for this repo,
   `https://learn-with-koda.web.app`) under **Authorized JavaScript origins**.
   Popup mode needs no redirect URI.
3. Put the client id in both local files:

   ```dotenv
   # ../.env
   VITE_GOOGLE_CLIENT_ID=123.apps.googleusercontent.com

   # .env
   GOOGLE_CLIENT_ID=123.apps.googleusercontent.com
   ```

4. For GitHub deployment, create the repository variable `GOOGLE_CLIENT_ID`.
   The workflow bakes it into the Vite bundle and sets the same audience on the
   Cloud Run API. Push `main` to deploy.

The value is a public identifier, not an OAuth client secret. If it is absent,
the Google button is hidden and `/v1/auth/google` returns
`google_not_configured`; email and child-code sign-in continue to work.

## Email verification

Password registration can require proof that the person owns the address. Set
`REQUIRE_EMAIL_VERIFICATION=true` only after SMTP is working. A new account is
then shown a **Check your email** screen; its random, hashed, single-use link
expires after 24 hours and creates the first Koda session when opened. Resends
are rate-limited and return the same response for known and unknown addresses.

For local testing, set these in the root `.env`, restart compose, and open the
captured message at `http://localhost:8025` (or the `MAILPIT_PORT` shown by
`make dev-local`):

```dotenv
REQUIRE_EMAIL_VERIFICATION=true
MAIL_DRIVER=smtp
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_STARTTLS=false
```

For GitHub deployment, add repository variables `REQUIRE_EMAIL_VERIFICATION`,
`MAIL_DRIVER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_STARTTLS`, and `MAIL_FROM`, plus
repository secrets `SMTP_USER` and `SMTP_PASSWORD`. The deploy job refuses to
enable verification if those SMTP settings are incomplete. Accounts created
before this feature and Google-verified accounts remain usable.

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
