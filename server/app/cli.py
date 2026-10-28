"""Operator commands. Staff accounts are provisioned here, never signed up.

    python -m app.cli migrate
    python -m app.cli create-admin --email you@example.com --password '…'
    python -m app.cli set-password --email you@example.com --password '…'
    python -m app.cli reset-menu
    python -m app.cli content-export <dir>
    python -m app.cli content-import <dir> [--update] [--dry-run]
"""

import argparse
import asyncio
from pathlib import Path

from app import content_pack
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


async def _content_export(out: Path) -> None:
    db = database.connect()
    manifest = await content_pack.export_pack(db, out)
    print(f"exported to {out}: " + ", ".join(f"{v} {k}" for k, v in manifest.items() if isinstance(v, int) and k != "format"))
    for line in manifest["missing"]:
        print(f"  MISSING {line}")
    await database.close()


async def _content_import(src: Path, update: bool, dry_run: bool) -> None:
    db = database.connect()
    try:
        print(content_pack.render(await content_pack.import_pack(db, src, update=update, dry_run=dry_run)))
    except content_pack.PackError as exc:
        print(f"refused: {exc}")
        raise SystemExit(1) from exc
    finally:
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

    export = sub.add_parser("content-export", help="write published books and trace collections to a folder")
    export.add_argument("directory", type=Path)
    load = sub.add_parser("content-import", help="load a content pack, adding what is missing")
    load.add_argument("directory", type=Path)
    load.add_argument("--update", action="store_true", help="replace a book or collection the pack has a newer revision of")
    load.add_argument("--dry-run", action="store_true", help="say what would change and write nothing")

    args = parser.parse_args()
    if args.command == "migrate":
        asyncio.run(_migrate())
    elif args.command == "reset-menu":
        asyncio.run(_reset_menu())
    elif args.command == "create-admin":
        asyncio.run(_create_admin(args.email, args.password))
    elif args.command == "set-password":
        asyncio.run(_set_password(args.email, args.password))
    elif args.command == "content-export":
        asyncio.run(_content_export(args.directory))
    elif args.command == "content-import":
        asyncio.run(_content_import(args.directory, args.update, args.dry_run))


if __name__ == "__main__":
    main()
