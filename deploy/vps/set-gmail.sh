#!/bin/bash
# Send Koda's email through a Gmail account. Run on the server, in a terminal:
#
#   ssh -t root@<ip> bash /opt/koda/deploy/vps/set-gmail.sh
#
# Asks for the Gmail address and a Google *app password*
# (https://myaccount.google.com/apppasswords, needs 2-Step Verification) — not
# the account's normal password. The password is typed hidden and written only
# to the server's .env. Then restarts the API and sends nothing by itself.
set -euo pipefail
cd "$(dirname "$0")"
test -f .env || { echo ".env is missing here"; exit 1; }

read -rp "Gmail address: " user
[[ "$user" == *@* ]] || { echo "That is not an email address."; exit 1; }
read -rsp "App password (16 letters, hidden): " pass; echo
pass=${pass// /}
[ ${#pass} -eq 16 ] || { echo "An app password is 16 letters; got ${#pass}."; exit 1; }

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
set_key SMTP_HOST smtp.gmail.com
set_key SMTP_PORT 587
set_key SMTP_STARTTLS true
set_key SMTP_USER "$user"
set_key SMTP_PASSWORD "$pass"
set_key MAIL_FROM "Koda <$user>"
chmod 600 .env

docker compose up -d api >/dev/null
echo "Saved. The API restarted with Gmail ($user). A copy of the old .env is next to it."
