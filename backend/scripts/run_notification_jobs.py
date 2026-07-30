"""Run the recurring notification jobs:

  * grouped review-due reminders for learners with a review backlog
  * inactivity nudges to parents of learners who have gone quiet
  * the weekly parent progress digest
  * any admin-scheduled ("send later") broadcasts whose time has arrived

No scheduler exists anywhere in this codebase (no celery/apscheduler/arq, no
worker service in docker-compose.yml) — this script is meant to be invoked by
an external cron, once a day. It checks each parent's configured
`weekly_digest_day` internally, so one daily entry is enough; running it more
than once on the same day is harmless (each digest is capped to one per ISO
week by its idempotency key).

    docker compose exec api python scripts/run_notification_jobs.py

Example crontab line (adjust the path to wherever this repo is deployed):

    0 7 * * *  cd /path/to/koda-v4/backend && python scripts/run_notification_jobs.py >> /var/log/koda/notifications.log 2>&1

This is a one-shot process, not a long-running worker: it opens its own DB
connection, runs to completion, and exits.
"""

import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import close_db, init_db  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.features.notifications.jobs import (  # noqa: E402
    flush_due_broadcasts,
    run_inactivity_nudges,
    run_review_reminders,
    run_weekly_digests,
)


async def main() -> None:
    configure_logging()  # so the console mail transport actually prints the email
    await init_db()
    try:
        now = datetime.now(timezone.utc)
        reviews = await run_review_reminders(now)
        inactivity = await run_inactivity_nudges(now)
        digests = await run_weekly_digests(now)
        broadcasts = await flush_due_broadcasts(now)
        print(
            f"review_reminders={reviews} inactivity_nudges={inactivity} "
            f"digests_sent={digests} broadcasts_flushed={broadcasts}"
        )
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
