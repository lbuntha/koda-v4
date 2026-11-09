#!/bin/sh
# The scheduled jobs, on the schedule Cloud Scheduler runs them today.
#
# Each job is a POST to the API with TASK_TOKEN, which `app/security/tasks.py`
# accepts in place of Google's OIDC token. Output goes to this container's log:
# `docker compose logs tasks` shows what every run reported.
set -eu

apk add --no-cache curl >/dev/null

# The token is written into the job script here, once: busybox crond does not
# hand the container's environment to the jobs it runs.
cat > /usr/local/bin/run-task <<EOF
#!/bin/sh
echo "\$(date -u +%FT%TZ) \$1: \$(curl -sS -m 300 -X POST -H 'Authorization: Bearer ${TASK_TOKEN}' "http://api:8000/v1/tasks/\$1")"
EOF
chmod 700 /usr/local/bin/run-task

cat > /etc/crontabs/root <<'EOF'
0 * * * *  run-task daily-reminders     > /proc/1/fd/1 2>&1
0 * * * *  run-task skill-announcements > /proc/1/fd/1 2>&1
0 * * * *  run-task weekly-summary      > /proc/1/fd/1 2>&1
17 3 * * * run-task token-sweep         > /proc/1/fd/1 2>&1
EOF

echo "tasks: schedule installed"
exec crond -f -l 8
