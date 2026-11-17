#!/bin/bash
# Point Koda's email at a real mailbox. Run on the server, in a terminal:
#
#   ssh -t root@<ip> bash /opt/koda/deploy/vps/set-mail.sh
#
# Asks for the address, the mail server (Hostinger by default; type
# smtp.gmail.com for Gmail) and the mailbox password — for Gmail, a Google
# *app password*. The password is typed hidden and written only to the
# server's .env. Port 587 with STARTTLS, which both Hostinger and Gmail take.
# Then restarts the API on the images already running; sends nothing itself.
set -euo pipefail
cd "$(dirname "$0")"
test -f .env || { echo ".env is missing here"; exit 1; }

read -rp "Email address to send from: " user
[[ "$user" == *@* ]] || { echo "That is not an email address."; exit 1; }
default_host=smtp.hostinger.com
[[ "$user" == *@gmail.com ]] && default_host=smtp.gmail.com
read -rp "Mail server [$default_host]: " host
host=${host:-$default_host}
read -rsp "Password (hidden): " pass; echo
[ -n "$pass" ] || { echo "No password given."; exit 1; }
[ "$host" = smtp.gmail.com ] && pass=${pass// /}
[[ "$pass" == *"'"* ]] && { echo "A password with ' in it cannot be stored here; change it in the mailbox first."; exit 1; }
read -rp "Name people see [Koda]: " name
name=${name:-Koda}

cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"
set_key() {
  local key=$1 value=$2 tmp
  tmp=$(mktemp)
  grep -v "^${key}=" .env > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  cat "$tmp" > .env
  rm -f "$tmp"
}
set_key MAIL_DRIVER smtp
set_key SMTP_HOST "$host"
set_key SMTP_PORT 587
set_key SMTP_STARTTLS true
set_key SMTP_USER "$user"
# Single-quoted, so docker compose takes `$`, `#` and spaces in it literally.
set_key SMTP_PASSWORD "'$pass'"
set_key MAIL_FROM "$name <$user>"
chmod 600 .env

# The images this server already runs: `local` when they were loaded by hand.
tag=$(docker inspect -f '{{.Config.Image}}' "$(docker compose ps -q api)" 2>/dev/null | sed 's/.*://')
KODA_TAG=${tag:-${KODA_TAG:-latest}} docker compose up -d --no-build --pull never api >/dev/null
echo "Saved. The API restarted, sending as $name <$user> through $host."
