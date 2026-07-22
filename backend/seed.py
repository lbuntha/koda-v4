"""Seed / reset the initial admin account. Idempotent — safe to run repeatedly.

    cd backend && .venv/bin/python seed.py        # local
    docker compose run --rm api python seed.py     # in Docker

Credentials come from env (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME) with the
project defaults below. Change the password after first login — the default is
for local development only.
"""

import asyncio
import os

from app.core.db import init_db, close_db
from app.models.user import User, Role
from app.core.security import hash_secret

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "lbuntha@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "123456")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Admin")


async def main() -> None:
    await init_db()
    try:
        existing = await User.find_one(User.email == ADMIN_EMAIL)
        if existing:
            existing.role = Role.admin
            existing.password_hash = hash_secret(ADMIN_PASSWORD)
            await existing.save()
            print(f"✓ Updated existing admin: {ADMIN_EMAIL}")
        else:
            await User(
                role=Role.admin,
                email=ADMIN_EMAIL,
                password_hash=hash_secret(ADMIN_PASSWORD),
                name=ADMIN_NAME,
            ).insert()
            print(f"✓ Created admin: {ADMIN_EMAIL}")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
