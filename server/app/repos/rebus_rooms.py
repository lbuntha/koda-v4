"""Group rooms for Rebus Rush: short-lived, and every change atomic.

Every write that two players could race (joining the last seat, answering the
same puzzle) is one conditional update, so the database decides who got there
first rather than two requests reading, thinking and writing over each other.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app import rebus_room as rules

COLLECTION = "rebus_rooms"


def _col(db: AsyncIOMotorDatabase):
    return db[COLLECTION]


async def get(db: AsyncIOMotorDatabase, code: str) -> dict[str, Any] | None:
    return await _col(db).find_one({"_id": code})


def _player(*, name: str, avatar: str, user_id: str | None, token: str, now_ms: int) -> dict[str, Any]:
    return {
        "pid": f"p_{uuid4().hex[:10]}",
        "name": name,
        "avatar": avatar,
        "userId": user_id,
        "tokenHash": rules.hash_token(token),
        "joinedMs": now_ms,
        "seenMs": now_ms,
        "score": 0,
        "solved": 0,
    }


async def create(
    db: AsyncIOMotorDatabase,
    *,
    host_user_id: str,
    settings: dict[str, Any],
    name: str,
    avatar: str,
    now_ms: int,
) -> tuple[dict[str, Any], str]:
    token = rules.new_token()
    host = _player(name=name, avatar=avatar, user_id=host_user_id, token=token, now_ms=now_ms)
    for _ in range(10):
        room = {
            "_id": rules.make_code(),
            "hostPid": host["pid"],
            "status": "lobby",
            "locked": False,
            "createdMs": now_ms,
            "expiresAt": _expires(now_ms),
            "settings": settings,
            "players": [host],
            "requests": [],
            "puzzles": [],
            "index": 0,
            "puzzleStartMs": 0,
            "endedMs": None,
            "results": [],
            "seed": uuid4().hex,
        }
        try:
            await _col(db).insert_one(room)
            return room, token
        except DuplicateKeyError:
            continue  # a code collision: draw another
    raise RuntimeError("Could not find a free room code.")


def _expires(now_ms: int):
    from datetime import UTC, datetime

    return datetime.fromtimestamp((now_ms + rules.ROOM_LIFETIME_MS) / 1000, tz=UTC)


#: Most people who may be waiting at the door of one room at once.
MAX_REQUESTS = 10
#: A request not heard from for this long is a child who closed the page, not someone waiting.
REQUEST_STALE_MS = rules.REQUEST_FRESH_MS


async def join(
    db: AsyncIOMotorDatabase, code: str, *, name: str, avatar: str, user_id: str | None, now_ms: int
) -> tuple[str, dict[str, Any] | None, str]:
    """Ask for a seat. The host decides: this only puts a request at the door.

    Returns (outcome, room, token): outcome is "ok" or why not. The token names
    the request now and the seat once the host accepts, so the same device
    carries on without joining a second time.
    """
    room = await get(db, code)
    if not room or room["status"] == "closed":
        return "not_found", None, ""
    token = rules.new_token()
    player = _player(name=name, avatar=avatar, user_id=user_id, token=token, now_ms=now_ms)
    fresh = now_ms - REQUEST_STALE_MS
    updated = await _col(db).find_one_and_update(
        {
            "_id": code,
            "status": "lobby",
            "locked": False,
            "players.name": {"$ne": name},
            "requests": {"$not": {"$elemMatch": {"name": name, "seenMs": {"$gte": fresh}}}},
            "$expr": {"$lt": [{"$size": {"$ifNull": ["$requests", []]}}, MAX_REQUESTS]},
        },
        {"$push": {"requests": player}},
        return_document=True,
    )
    if updated:
        return "ok", updated, token
    # Say why: the most useful refusal first.
    room = await get(db, code) or room
    if room["status"] != "lobby":
        return "started", room, ""
    if room["locked"]:
        return "locked", room, ""
    if any(p["name"] == name for p in room["players"]) or any(r["name"] == name and r["seenMs"] >= fresh for r in room.get("requests", [])):
        return "name_taken", room, ""
    return "full", room, ""


async def accept(db: AsyncIOMotorDatabase, code: str, pid: str) -> str:
    """Move a request into the players. Returns "ok", "gone" (no such request) or "full"."""
    room = await get(db, code)
    request = next((r for r in (room or {}).get("requests", []) if r["pid"] == pid), None)
    if not room or not request or room["status"] != "lobby":
        return "gone"
    limit = int(room["settings"]["maxPlayers"])
    done = await _col(db).update_one(
        {
            "_id": code,
            "status": "lobby",
            "requests.pid": pid,
            "players.name": {"$ne": request["name"]},
            "$expr": {"$lt": [{"$size": "$players"}, limit]},
        },
        {"$push": {"players": request}, "$pull": {"requests": {"pid": pid}}},
    )
    if done.modified_count:
        return "ok"
    room = await get(db, code) or room
    if not any(r["pid"] == pid for r in room.get("requests", [])):
        return "gone"
    return "full"


async def decline(db: AsyncIOMotorDatabase, code: str, pid: str) -> None:
    await _col(db).update_one({"_id": code}, {"$pull": {"requests": {"pid": pid}}})


def request_of(room: dict[str, Any], token: str | None) -> dict[str, Any] | None:
    """The request this token holds, while the host has not yet answered."""
    if not token:
        return None
    wanted = rules.hash_token(token)
    return next((r for r in room.get("requests", []) if r["tokenHash"] == wanted), None)


async def touch_request(db: AsyncIOMotorDatabase, code: str, pid: str, now_ms: int) -> None:
    await _col(db).update_one({"_id": code, "requests.pid": pid}, {"$set": {"requests.$.seenMs": now_ms}})


def seat_of(room: dict[str, Any], token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    wanted = rules.hash_token(token)
    return next((p for p in room["players"] if p["tokenHash"] == wanted), None)


async def touch(db: AsyncIOMotorDatabase, code: str, pid: str, now_ms: int) -> None:
    await _col(db).update_one({"_id": code, "players.pid": pid}, {"$set": {"players.$.seenMs": now_ms}})


async def settle(db: AsyncIOMotorDatabase, code: str, now_ms: int) -> dict[str, Any] | None:
    """Apply whatever time has done to the room, and return it."""
    for _ in range(6):
        room = await get(db, code)
        if not room:
            return None
        change = rules.tick(room, now_ms)
        if change is None:
            return room
        # Guarded by where the room was, so two pollers cannot both record the same ending.
        await _col(db).update_one(
            {
                "_id": code,
                "status": "playing",
                "index": room["index"],
                "endedMs": room["endedMs"],
                "results": {"$size": len(room["results"])},
            },
            {"$set": change},
        )
    return await get(db, code)


async def start(db: AsyncIOMotorDatabase, code: str, *, puzzles: list[dict[str, Any]], now_ms: int) -> dict[str, Any] | None:
    return await _col(db).find_one_and_update(
        {"_id": code, "status": "lobby"},
        {
            "$set": {
                "status": "playing",
                "locked": True,
                "requests": [],
                "puzzles": puzzles,
                "index": 0,
                "puzzleStartMs": now_ms + rules.COUNTDOWN_MS,
                "endedMs": None,
                "results": [],
            }
        },
        return_document=True,
    )


async def claim(
    db: AsyncIOMotorDatabase, code: str, *, pid: str, index: int, hints: int, now_ms: int, points: int
) -> dict[str, Any] | None:
    """The first correct claim on the live puzzle wins it. Anyone later finds it already ended."""
    room = await get(db, code)
    if not room:
        return None
    return await _col(db).find_one_and_update(
        {
            "_id": code,
            "status": "playing",
            "index": index,
            "endedMs": None,
            "puzzleStartMs": {"$lte": now_ms},
            "players.pid": pid,
        },
        {
            "$set": {"endedMs": now_ms},
            "$push": {
                "results": {
                    "index": index,
                    "winnerPid": pid,
                    "points": points,
                    "hints": hints,
                    "atMs": max(0, now_ms - room["puzzleStartMs"]),
                }
            },
            "$inc": {"players.$[w].score": points, "players.$[w].solved": 1},
        },
        array_filters=[{"w.pid": pid}],
        return_document=True,
    )


async def set_locked(db: AsyncIOMotorDatabase, code: str, locked: bool) -> None:
    await _col(db).update_one({"_id": code, "status": "lobby"}, {"$set": {"locked": locked}})


async def remove_player(db: AsyncIOMotorDatabase, code: str, pid: str) -> None:
    await _col(db).update_one({"_id": code}, {"$pull": {"players": {"pid": pid}}})


async def set_host(db: AsyncIOMotorDatabase, code: str, pid: str) -> None:
    await _col(db).update_one({"_id": code}, {"$set": {"hostPid": pid}})


async def close(db: AsyncIOMotorDatabase, code: str) -> None:
    await _col(db).update_one({"_id": code}, {"$set": {"status": "closed", "players": [], "puzzles": []}})


async def rematch(db: AsyncIOMotorDatabase, code: str, *, now_ms: int) -> dict[str, Any] | None:
    """Back to the lobby with the same people, scores cleared and a new seed."""
    return await _col(db).find_one_and_update(
        {"_id": code, "status": "finished"},
        {
            "$set": {
                "status": "lobby",
                "locked": False,
                "puzzles": [],
                "index": 0,
                "endedMs": None,
                "results": [],
                "seed": uuid4().hex,
                "expiresAt": _expires(now_ms),
                "players.$[].score": 0,
                "players.$[].solved": 0,
            }
        },
        return_document=True,
    )
