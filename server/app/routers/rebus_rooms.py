"""Rebus Rush group rooms: an invitation code, a lobby, and a race.

Who may do what:

* **Open a room** needs a signed-in Koda user. Guests cannot create rooms.
* **Join** takes a code and a preset nickname and avatar, and puts a request at
  the door. Nobody sits down until the host accepts. A signed-in Koda user who is
  accepted is recorded as themselves (so their play can count); anyone else is a
  guest, with no account, name or free text.
* Every later call carries the seat's own token (`X-Player-Token`), handed back
  when the seat was taken. It is stored only as a hash.

The room is polled rather than pushed: a poll is one cheap read that also tells
the room what time has done, so it works behind any proxy, on any number of API
containers, and a child's flaky connection simply catches up on the next one.
"""

from __future__ import annotations

import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials

from app import rebus_room as rules
from app.deps import Db, require
from app.errors import AppError, Conflict, Forbidden, NotFound
from app.models.auth import Principal
from app.models.rebus import RebusSettings
from app.models.rebus_room import AnswerIn, KickIn, LockIn, RoomCreateIn, RoomJoinIn, SolveIn
from app.repos import rebus as puzzles_repo
from app.repos import rebus_rooms as repo
from app.repos import system as system_repo
from app.security.rate_limit import ROOM_JOIN_PER_IP, limiter
from app.security.scheme import bearer_scheme
from app.security.tokens import read_access

router = APIRouter(prefix="/rebus/rooms", tags=["rebus-rooms"])

CanRead = Annotated[Principal, Depends(require("settings:read"))]

#: What a puzzle looks like to a player in a room: everything to show and check it, nothing about its authoring.
PUZZLE_FIELDS = ("id", "category", "ages", "difficulty", "trick", "pieces", "answer", "accepts", "explanation")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _caller(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _maybe_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None) -> Principal | None:
    """The signed-in Koda user, if there is one. A bad token is refused rather than quietly treated as a guest."""
    if not credentials or credentials.scheme.lower() != "bearer":
        return None
    return read_access(credentials.credentials)


MaybeUser = Annotated[Principal | None, Depends(_maybe_user)]


def _check_choice(name: str, avatar: str) -> None:
    if name not in rules.NICKNAMES:
        raise AppError(400, "bad_nickname", "Pick a nickname from the list.")
    if avatar not in rules.AVATARS:
        raise AppError(400, "bad_avatar", "Pick an avatar from the list.")


async def _switch(db, setting_id: str) -> bool:
    return bool(await system_repo.value_of(db, setting_id, True))


async def _owner_settings(db) -> RebusSettings:
    raw = await system_repo.value_of(db, "rebus.settings", None)
    try:
        return RebusSettings.model_validate_json(raw) if isinstance(raw, str) else RebusSettings()
    except ValueError:
        return RebusSettings()


def _public_puzzle(puzzle: dict[str, Any]) -> dict[str, Any]:
    return {key: puzzle[key] for key in PUZZLE_FIELDS if key in puzzle}


def _view(room: dict[str, Any], me: dict[str, Any], now_ms: int, **extra: Any) -> dict[str, Any]:
    players = [
        {
            "pid": p["pid"],
            "name": p["name"],
            "avatar": p["avatar"],
            "score": p["score"],
            "solved": p["solved"],
            "isHost": p["pid"] == room["hostPid"],
            "isKodaUser": p.get("userId") is not None,
            "connected": now_ms - p["seenMs"] < rules.PRESENT_MS,
        }
        for p in room["players"]
    ]
    waiting = [
        {"pid": r["pid"], "name": r["name"], "avatar": r["avatar"], "isKodaUser": r.get("userId") is not None}
        for r in room.get("requests", [])
        if now_ms - r["seenMs"] < rules.REQUEST_FRESH_MS
    ]
    out: dict[str, Any] = {
        "code": room["_id"],
        "status": room["status"],
        "locked": room["locked"],
        "settings": room["settings"],
        "players": players,
        "me": {"pid": me["pid"], "isHost": me["pid"] == room["hostPid"], "isKodaUser": me.get("userId") is not None},
        "nowMs": now_ms,
        **extra,
    }
    if me["pid"] == room["hostPid"]:
        out["requests"] = waiting
    if room["status"] in ("playing", "finished"):
        total = len(room["puzzles"])
        out["total"] = total
        out["results"] = room["results"]
        out["standings"] = rules.standings(room)
    if room["status"] == "playing":
        index = room["index"]
        ended = room.get("endedMs")
        out.update(
            index=index,
            puzzle=_public_puzzle(room["puzzles"][index]),
            startMs=room["puzzleStartMs"],
            limitMs=rules.limit_ms(room),
            endedMs=ended,
            revealUntilMs=(ended + rules.REVEAL_MS) if ended is not None else None,
            result=next((r for r in room["results"] if r["index"] == index), None) if ended is not None else None,
        )
    return out


async def _seat(db, code: str, token: str | None, now_ms: int) -> tuple[dict[str, Any], dict[str, Any]]:
    """The room, brought up to date, and the seat this token holds."""
    room = await repo.get(db, rules.normalize_code(code))
    if not room or room["status"] == "closed":
        raise NotFound("That room is not open any more.", "room_not_found")
    me = repo.seat_of(room, token)
    if not me:
        raise Forbidden("You are not in this room.", "not_in_room")
    await repo.touch(db, room["_id"], me["pid"], now_ms)
    room = await repo.settle(db, room["_id"], now_ms)
    if not room or room["status"] == "closed":
        raise NotFound("That room is not open any more.", "room_not_found")
    me = repo.seat_of(room, token)
    if not me:
        raise Forbidden("You are not in this room.", "not_in_room")
    return room, me


def _waiting_view(room: dict[str, Any], request: dict[str, Any], now_ms: int) -> dict[str, Any]:
    """What someone at the door sees: that they are waiting, and nothing about who is inside."""
    return _view(room, request, now_ms, status="pending", players=[], settings=room["settings"])


def _host_only(room: dict[str, Any], me: dict[str, Any]) -> None:
    if me["pid"] != room["hostPid"]:
        raise Forbidden("Only the host can do that.", "not_host")


@router.get("/choices")
async def choices() -> dict[str, Any]:
    """The nicknames and avatars a player may pick from, for anyone, signed in or not."""
    return {"nicknames": list(rules.NICKNAMES), "avatars": list(rules.AVATARS)}


@router.post("", status_code=201)
async def create_room(body: RoomCreateIn, db: Db, p: CanRead) -> dict[str, Any]:
    if not await _switch(db, "rebus.enabled") or not await _switch(db, "rebus.group"):
        raise Forbidden("Playing in a group is switched off.", "group_off")
    if body.category != "mixed" and body.category not in rules.CATEGORIES:
        raise AppError(400, "bad_category", "Pick a topic.")
    _check_choice(body.name, body.avatar)
    owner = await _owner_settings(db)
    settings = {
        "category": body.category,
        "count": body.count,
        "difficulty": body.difficulty,
        "maxPlayers": owner.maxPlayers,
        "hintDelaySec": owner.hintDelaySec,
        "puzzleLimitSec": owner.puzzleLimitSec,
        "hintRungs": owner.hintRungs,
        "pointsPerPuzzle": owner.pointsPerPuzzle,
        "hintCost": owner.hintCost,
    }
    now_ms = _now_ms()
    room, token = await repo.create(db, host_user_id=p.subject_id, settings=settings, name=body.name, avatar=body.avatar, now_ms=now_ms)
    return {"playerToken": token, "room": _view(room, room["players"][0], now_ms)}


@router.post("/{code}/join")
async def join_room(code: str, body: RoomJoinIn, db: Db, request: Request, user: MaybeUser) -> dict[str, Any]:
    await limiter.hit(db, "room:ip", _caller(request), ROOM_JOIN_PER_IP)
    if not await _switch(db, "rebus.enabled") or not await _switch(db, "rebus.group"):
        raise Forbidden("Playing in a group is switched off.", "group_off")
    _check_choice(body.name, body.avatar)
    now_ms = _now_ms()
    outcome, room, token = await repo.join(
        db, rules.normalize_code(code), name=body.name, avatar=body.avatar, user_id=user.subject_id if user else None, now_ms=now_ms
    )
    if outcome == "not_found":
        raise NotFound("That code does not match an open room.", "room_not_found")
    if outcome == "started":
        raise Conflict("That game has already started.", "room_started")
    if outcome == "locked":
        raise Conflict("The host has closed the door to this room.", "room_locked")
    if outcome == "name_taken":
        raise Conflict("Someone already picked that nickname. Pick another.", "name_taken")
    if outcome == "full" or room is None:
        raise Conflict("This room is full.", "room_full")
    me = repo.request_of(room, token)
    assert me is not None
    return {"playerToken": token, "room": _waiting_view(room, me, now_ms)}


@router.get("/{code}")
async def poll_room(code: str, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    now_ms = _now_ms()
    room = await repo.get(db, rules.normalize_code(code))
    waiting = repo.request_of(room, x_player_token) if room and room["status"] == "lobby" else None
    if room and waiting:
        await repo.touch_request(db, room["_id"], waiting["pid"], now_ms)
        return _waiting_view(room, waiting, now_ms)
    room, me = await _seat(db, code, x_player_token, now_ms)
    return _view(room, me, now_ms)


@router.post("/{code}/start")
async def start_room(code: str, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    now_ms = _now_ms()
    room, me = await _seat(db, code, x_player_token, now_ms)
    _host_only(room, me)
    if room["status"] != "lobby":
        raise Conflict("The game has already started.", "room_started")
    if len(room["players"]) < 2:
        raise Conflict("Wait for at least one friend to join.", "need_players")
    s = room["settings"]
    chosen = rules.pick_puzzles(
        await puzzles_repo.published(db), category=s["category"], count=s["count"], difficulty=s.get("difficulty"), seed=room["seed"]
    )
    if len(chosen) < 3:
        raise Conflict("There are not enough puzzles for that topic yet.", "not_enough_puzzles")
    started = await repo.start(db, room["_id"], puzzles=[_public_puzzle(c) for c in chosen], now_ms=now_ms)
    if not started:
        raise Conflict("The game has already started.", "room_started")
    return _view(started, repo.seat_of(started, x_player_token) or me, now_ms)


@router.post("/{code}/solve")
async def solve(code: str, body: SolveIn, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    """ "I solved it": first claim on the live puzzle wins its points. The device has already checked the answer."""
    now_ms = _now_ms()
    room, me = await _seat(db, code, x_player_token, now_ms)
    if room["status"] != "playing":
        raise Conflict("There is no puzzle to answer.", "not_playing")
    s = room["settings"]
    hints = min(body.hints, int(s["hintRungs"]))
    points = rules.points_for(hints, per_puzzle=int(s["pointsPerPuzzle"]), hint_cost=int(s["hintCost"]))
    won = await repo.claim(db, room["_id"], pid=me["pid"], index=body.index, hints=hints, now_ms=now_ms, points=points)
    fresh = won or await repo.settle(db, room["_id"], now_ms) or room
    seat = repo.seat_of(fresh, x_player_token) or me
    return {"won": won is not None, "points": points if won else 0, "room": _view(fresh, seat, now_ms)}


@router.post("/{code}/lock")
async def lock(code: str, body: LockIn, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    now_ms = _now_ms()
    room, me = await _seat(db, code, x_player_token, now_ms)
    _host_only(room, me)
    await repo.set_locked(db, room["_id"], body.locked)
    room = await repo.get(db, room["_id"]) or room
    return _view(room, me, now_ms)


@router.post("/{code}/kick")
async def kick(code: str, body: KickIn, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    now_ms = _now_ms()
    room, me = await _seat(db, code, x_player_token, now_ms)
    _host_only(room, me)
    if room["status"] != "lobby":
        raise Conflict("Players can only be removed before the game starts.", "room_started")
    if body.pid == me["pid"]:
        raise AppError(400, "cannot_kick_self", "Use Leave to leave your own room.")
    await repo.remove_player(db, room["_id"], body.pid)
    room = await repo.get(db, room["_id"]) or room
    return _view(room, me, now_ms)


@router.post("/{code}/accept")
async def accept(code: str, body: AnswerIn, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    now_ms = _now_ms()
    room, me = await _seat(db, code, x_player_token, now_ms)
    _host_only(room, me)
    if room["status"] != "lobby":
        raise Conflict("The game has already started.", "room_started")
    outcome = await repo.accept(db, room["_id"], body.pid)
    if outcome == "full":
        raise Conflict("This room is full.", "room_full")
    room = await repo.get(db, room["_id"]) or room
    return _view(room, me, now_ms)


@router.post("/{code}/decline")
async def decline(code: str, body: AnswerIn, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    now_ms = _now_ms()
    room, me = await _seat(db, code, x_player_token, now_ms)
    _host_only(room, me)
    await repo.decline(db, room["_id"], body.pid)
    room = await repo.get(db, room["_id"]) or room
    return _view(room, me, now_ms)


@router.post("/{code}/leave")
async def leave(code: str, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, str]:
    now_ms = _now_ms()
    door = await repo.get(db, rules.normalize_code(code))
    waiting = repo.request_of(door, x_player_token) if door else None
    if door and waiting:
        await repo.decline(db, door["_id"], waiting["pid"])
        return {"status": "left"}
    room, me = await _seat(db, code, x_player_token, now_ms)
    await repo.remove_player(db, room["_id"], me["pid"])
    after = await repo.get(db, room["_id"])
    if after and after["players"]:
        if me["pid"] == after["hostPid"]:
            await repo.set_host(db, room["_id"], after["players"][0]["pid"])
    else:
        await repo.close(db, room["_id"])
    return {"status": "left"}


@router.post("/{code}/rematch")
async def rematch(code: str, db: Db, x_player_token: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    now_ms = _now_ms()
    room, me = await _seat(db, code, x_player_token, now_ms)
    _host_only(room, me)
    again = await repo.rematch(db, room["_id"], now_ms=now_ms)
    if not again:
        raise Conflict("The game is not over yet.", "not_finished")
    return _view(again, repo.seat_of(again, x_player_token) or me, now_ms)
