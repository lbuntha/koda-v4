#!/bin/bash
# One backup a day into ./backups on the server, the oldest dropped after
# BACKUP_KEEP_DAYS. Two files per day:
#
#   koda-<date>.archive.gz   the database (mongorestore --gzip --archive=…)
#   files-<date>.tar.gz      book recordings and Trace paintings
#
# These sit on the same disk as the data, so they protect against a bad deploy
# or a deleted row, not against losing the server. Copy ./backups somewhere
# else as well (README.md, "Backups").
set -euo pipefail

while true; do
  day=$(date -u +%F)
  if [ ! -f "/backups/koda-${day}.archive.gz" ]; then
    mongodump --uri="$MONGODB_URI" --gzip --archive="/backups/koda-${day}.archive.gz.part" --quiet
    mv "/backups/koda-${day}.archive.gz.part" "/backups/koda-${day}.archive.gz"
    tar -czf "/backups/files-${day}.tar.gz" -C /srv data
    find /backups -name '*.gz' -mtime "+${BACKUP_KEEP_DAYS}" -delete
    echo "$(date -u +%FT%TZ) backup: koda-${day}.archive.gz $(du -h "/backups/koda-${day}.archive.gz" | cut -f1)"
  fi
  sleep 3600
done
