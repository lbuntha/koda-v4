"""Operator commands. Staff accounts are provisioned here, never signed up.

    python -m app.cli migrate
    python -m app.cli create-admin --email you@example.com --password '…'
    python -m app.cli set-password --email you@example.com --password '…'
    python -m app.cli reset-menu
"""

import argparse
import asyncio

from app import db as database
from app.indexes import ensure_indexes
from app.menu_defaults import DEFAULT_MENU
from app.repos import devices, menu, users
from app.security import passwords


async def _migrate() -> None:
    db = database.connect()
    created = await ensure_indexes(db)
    for collection, names in created.items():
        print(f"  {collection}: {', '.join(names)}")
    await database.close()


async def _create_admin(email: str, password: str) -> None:
    db = database.connect()
    if await users.by_email(db, email):
        print(f"{email} already exists.")
    else:
        await users.create(db, email, passwords.hash_password(password), platform_role="admin")
        print(f"admin created: {email}")
    await database.close()


async def _set_password(email: str, password: str) -> None:
    db = database.connect()
    user = await users.by_email(db, email)
    if not user:
        print(f"No account for {email}.")
    else:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"passwordHash": passwords.hash_password(password)}},
        )
        # Sessions outlive a password change unless they are cut: anyone holding
        # a refresh token for this account keeps it otherwise, which is exactly
        # what a password change is usually meant to stop.
        ended = await devices.revoke_all_for_user(db, user["_id"])
        print(f"password set for {email}; {ended} device session(s) ended")
    await database.close()


async def _reset_menu() -> None:
    """Put the shipped defaults back, overwriting any edits to them."""
    db = database.connect()
    for item in DEFAULT_MENU:
        await menu.reset_default(db, item)
    print(f"reset {len(DEFAULT_MENU)} default menu items")
    await database.close()


def main() -> None:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate", help="apply every index")
    sub.add_parser("reset-menu", help="put the shipped sidebar defaults back")
    admin = sub.add_parser("create-admin", help="provision a staff account")
    admin.add_argument("--email", required=True)
    admin.add_argument("--password", required=True)

    reset = sub.add_parser("set-password", help="set an account's password and end its sessions")
    reset.add_argument("--email", required=True)
    reset.add_argument("--password", required=True)

    args = parser.parse_args()
    if args.command == "migrate":
        asyncio.run(_migrate())
    elif args.command == "reset-menu":
        asyncio.run(_reset_menu())
    elif args.command == "create-admin":
        asyncio.run(_create_admin(args.email, args.password))
    elif args.command == "set-password":
        asyncio.run(_set_password(args.email, args.password))


if __name__ == "__main__":
    main()
