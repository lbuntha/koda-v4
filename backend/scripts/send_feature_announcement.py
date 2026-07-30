"""One-off: email every parent (who hasn't opted out of announcement emails)
that Koda now has a notifications inbox — the copy lives in
`app/features/notifications/templates.py::feature_announcement_email`.

Run once, by hand, after deploying the notifications feature:

    docker compose exec api python scripts/send_feature_announcement.py

Safe to re-run: each send is keyed by a versioned idempotency key
("announcement:notifications-launch-v1:{parent_id}"), so a parent already
emailed by this script is skipped on a second run.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.db import close_db, init_db  # noqa: E402
from app.core.logging import configure_logging  # noqa: E402
from app.features.notifications.jobs import send_feature_announcement  # noqa: E402


async def main() -> None:
    configure_logging()  # so the console mail transport actually prints the email
    await init_db()
    try:
        sent = await send_feature_announcement()
        print(f"announcement_emails_sent={sent}")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
