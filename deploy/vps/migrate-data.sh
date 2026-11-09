#!/bin/bash
# On the server, after the stack is up:
#   ATLAS_URI='mongodb+srv://…' bash migrate-data.sh
#
# Copies the koda_v4 database from Atlas into this server's MongoDB, replacing
# what is here (--drop). Atlas is only read. Run it again at cut-over so the
# copy is fresh; anything families write to the old site after that is not
# carried over.
#
# Book recordings and paintings come separately — see README.md, step 6.
set -euo pipefail

: "${ATLAS_URI:?set ATLAS_URI to the Atlas connection string}"
cd "$(dirname "$0")"
set -a; . ./.env; set +a

network=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$(docker compose ps -q mongo)")

docker run --rm --network "$network" mongo:7 bash -c "
  mongodump --uri=\"\$0\" --db=koda_v4 --archive --quiet \
  | mongorestore --uri=\"\$1\" --archive --nsInclude='koda_v4.*' --drop
" "$ATLAS_URI" "mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/?authSource=admin"

echo "Copied. Restarting the API so it re-checks indexes and seeds."
docker compose restart api
