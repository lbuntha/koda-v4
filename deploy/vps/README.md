# Koda on a VPS

The whole of production on one server: web app, API, MongoDB, HTTPS,
scheduled jobs and nightly backups, from `compose.yml` in this folder.

It runs **beside** the Google deployment, not instead of it. Nothing here
reads from or writes to Cloud Run, and `.github/workflows/deploy.yml` still
deploys there on every push to main. Switch over only once this server is
checked, then retire Google (step 8).

What changes from Cloud Run:

| Cloud Run                         | Here                                              |
| --------------------------------- | ------------------------------------------------- |
| MongoDB Atlas                     | `mongo` container, `mongo-data` volume            |
| Recordings in a GCS bucket        | `api-data` volume (`DATA_DIRS_PERSIST=true`)      |
| Cloud Scheduler + OIDC token      | `tasks` container + `TASK_TOKEN`                  |
| Firebase Hosting in front         | Caddy, HTTPS from Let's Encrypt                   |
| Service account sends push        | a key file in `secrets/`                          |
| Atlas backups                     | `backup` container, daily into `backups/`         |

## 1. Prepare the server (once)

Ubuntu 22.04/24.04, at least 2 vCPU / 4 GB RAM (the web build is the hungry
part; `setup-server.sh` adds swap). Copy your SSH key in hPanel → VPS →
Settings → SSH keys, then from your machine:

```sh
scp deploy/vps/setup-server.sh root@<ip>:/root/
ssh root@<ip> bash /root/setup-server.sh
```

## 2. Point a domain at it

Create an `A` record for the domain (e.g. `app.example.com`) → the VPS IP.
Caddy needs it resolving before the first start to get a certificate.

## 3. First deploy

```sh
VPS=root@<ip> deploy/vps/deploy.sh      # copies the code; stops: .env missing
ssh root@<ip>
cd /opt/koda/deploy/vps
cp env.example .env && nano .env        # see the notes inside
exit
VPS=root@<ip> deploy/vps/deploy.sh      # builds and starts; ends with a health check
```

Reuse `JWT_SECRET` and `TUTOR_SERVICE_TOKEN` from Cloud Run so families stay
signed in and saved API keys still open:

```sh
gcloud run services describe koda-backend --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)' | tr ';' '\n' | grep -E 'JWT_SECRET|TUTOR_SERVICE_TOKEN'
```

## 4. Google sign-in

Google Cloud console → APIs & Services → Credentials → the OAuth client
(`140757924603-afqg…`) → add `https://<domain>` to *Authorized JavaScript
origins*. Until then the Google button fails on the new domain; email sign-in
works.

## 5. Push notifications

Push still goes through Firebase (free; this is the one piece of Google that
stays). Firebase console → Project settings → Service accounts → *Generate
new private key*, then:

```sh
scp key.json root@<ip>:/opt/koda/deploy/vps/secrets/firebase-service-account.json
# in .env: PUSH_DRIVER=fcm, then redeploy
```

Firebase console → Authentication → Settings → Authorized domains: add the
domain too.

## 6. Copy the data (rehearse now, repeat at cut-over)

Database — on the server, with the Atlas URI (Cloud Run's `MONGODB_URI`):

```sh
cd /opt/koda/deploy/vps
ATLAS_URI='mongodb+srv://…' bash migrate-data.sh
```

Book recordings and paintings (about 3 MB) — from your machine:

```sh
gcloud storage rsync -r gs://learn-with-koda-library-audio ./bucket-copy
rsync -az ./bucket-copy/ root@<ip>:/tmp/bucket-copy/
ssh root@<ip> 'cd /opt/koda/deploy/vps && \
  docker compose cp /tmp/bucket-copy/library-audio/. api:/srv/data/library-audio/ && \
  ( [ ! -d /tmp/bucket-copy/trace-paintings ] || docker compose cp /tmp/bucket-copy/trace-paintings/. api:/srv/data/trace-paintings/ )'
```

## 7. Check, then switch

Sign in on the new domain on a phone and a laptop: a lesson, a book that reads
aloud, the voice coach, a Rebus group game, a push notification. Then:

1. Run step 6 again so the data is fresh.
2. Tell families the new address (the installed app is tied to its address:
   they open the new one and install it again).

## 8. Retire Google — only after the server has run well for a while

- Remove the deploy jobs from `.github/workflows/deploy.yml` (or every push
  to main redeploys Cloud Run).
- Pause, then delete, the four Cloud Scheduler jobs.
- Delete the `koda-app` and `koda-backend` Cloud Run services.
- Keep the Atlas cluster until a few weekly backups exist here.
- **Keep the Firebase project** — push notifications depend on it.

## Deploy from GitHub on every push

The `deploy-vps` job in `.github/workflows/deploy.yml` runs `deploy.sh` after
the tests pass. It is skipped until configured. Once the first manual deploy
(step 3) works:

```sh
ssh-keygen -t ed25519 -N '' -C github-deploy -f /tmp/koda-deploy
ssh-copy-id -i /tmp/koda-deploy.pub root@<ip>
gh secret set VPS_SSH_KEY < /tmp/koda-deploy
ssh-keyscan <ip> | gh secret set VPS_KNOWN_HOSTS
gh variable set VPS_HOST --body <ip>
rm /tmp/koda-deploy /tmp/koda-deploy.pub
```

The next push to main deploys to the VPS. To stop, delete the `VPS_HOST`
variable.

## Every day

```sh
VPS=root@<ip> deploy/vps/deploy.sh      # deploy what is on your machine
ssh root@<ip> 'cd /opt/koda/deploy/vps && docker compose logs -f --tail=100 api'
ssh root@<ip> 'cd /opt/koda/deploy/vps && docker compose logs tasks backup'
```

## Backups

`backups/` on the server holds 14 days of `koda-<date>.archive.gz` (database)
and `files-<date>.tar.gz` (recordings, paintings). They share the server's
disk, so also copy them off it — Hostinger's weekly VPS snapshot, or:

```sh
rsync -az root@<ip>:/opt/koda/deploy/vps/backups/ ~/koda-backups/
```

Restore a database backup:

```sh
docker compose exec -T mongo sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" \
  -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive --drop' \
  < backups/koda-<date>.archive.gz
```
