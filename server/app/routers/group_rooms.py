"""Play a skill lesson together: the same rooms as Rebus Rush, running a lesson.

A room here holds one lesson of one learning skill. Opening, joining, the door,
the lobby, kicking, leaving and rematches are the Rebus room's own handlers,
mounted again under `/group/rooms` so a skill never has to say "rebus"; only
opening a room and reporting progress are new.

The round itself is played on each device, from the room's seed, so every
player gets the same questions. A device reports how far it has got; the server
keeps the counts (only ever upward) and decides when the race is over. As in a
Rebus room, the device judges its own answers — a child could cheat by editing
the app, which a practice race can live with.

A skill can be raced only when it declares the `group_play` feature and an
operator has left it on in the Skill Manager. That feature is the skill's
promise that its questions come from the round's seed: a skill whose devices
drew different questions would be a race nobody could lose fairly.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Header

from app.deps import Db
from app.errors import AppError, Conflict, Forbidden, NotFound
from app.models.rebus_room import ProgressIn, SkillRoomCreateIn
from app.repos import rebus_rooms as repo
from app.repos import skills as skills_repo
from app.routers import rebus_rooms as rooms
from app.skill_defaults import load_defaults as load_skill_defaults

router = APIRouter(prefix="/group/rooms", tags=["group-rooms"])

#: The feature a skill declares when its rounds can be raced.
GROUP_FEATURE = "group_play"
#: Questions in a lesson that does not say.
DEFAULT_COUNT = 5


def _feature_on(skill: dict[str, Any]) -> bool:
    """Whether the skill can be raced: the operator's switch if they have one, else what the code declares.

    A registry row keeps the features it had when the skill was first
    registered (an operator's choices must survive a deploy), so a feature a
    later release adds is absent from the row until someone saves it in the
    Skill Manager. Absent means "as the deployed manifest says".
    """
    stored = next((f for f in skill.get("features") or [] if f.get("id") == GROUP_FEATURE), None)
    if stored is not None:
        return bool(stored.get("isEnabled", True))
    manifest = next((m for m in load_skill_defaults() if m.get("id") == skill.get("id")), None)
    declared = next((f for f in (manifest or {}).get("features") or [] if f.get("id") == GROUP_FEATURE), None)
    return bool(declared and declared.get("isEnabled", True))


def _question_count(lesson: dict[str, Any]) -> int:
    params = lesson.get("params") or {}
    question = params.get("question") or {}
    raw = question.get("questionsPerRound", params.get("questionsPerRound", DEFAULT_COUNT))
    try:
        return max(1, min(50, int(raw)))
    except (TypeError, ValueError):
        return DEFAULT_COUNT


@router.post("", status_code=201)
async def create_skill_room(body: SkillRoomCreateIn, db: Db, p: rooms.CanRead) -> dict[str, Any]:
    if not await rooms._switch(db, rooms.SKILL_SWITCH):
        raise Forbidden("Playing in a group is switched off.", "group_off")
    rooms._check_choice(body.name, body.avatar)
    await rooms.check_parent(db, p)
    skill = await skills_repo.get(db, body.skill)
    if not skill or not skill.get("isEnabled", True):
        raise NotFound("That skill is not available.", "skill_not_found")
    # A draft is for the people building it; children race only what is published.
    if skill.get("status") != "published" and p.platform_role != "core":
        raise NotFound("That skill is not available.", "skill_not_found")
    if not _feature_on(skill):
        raise Forbidden("This skill cannot be played in a group yet.", "group_unsupported")
    lesson = next((x for x in skill.get("lessons") or [] if x.get("id") == body.lesson), None)
    if not lesson:
        raise AppError(400, "lesson_not_found", "Pick a lesson from this skill.")
    owner = await rooms._owner_settings(db)
    settings = {
        "game": "skill",
        "skill": body.skill,
        "lesson": body.lesson,
        "title": lesson.get("title") or body.lesson,
        "count": _question_count(lesson),
        "language": body.language,
        "maxPlayers": owner.maxPlayers,
        "limitSec": rooms.rules.SKILL_LIMIT_MS // 1000,
    }
    now_ms = rooms._now_ms()
    room, token = await repo.create(db, host_user_id=p.subject_id, settings=settings, name=body.name, avatar=body.avatar, now_ms=now_ms)
    await repo.count(db, now_ms, roomsOpened=1, skillRoomsOpened=1, seatsKoda=1)
    return {"playerToken": token, "room": rooms._view(room, room["players"][0], now_ms)}


@router.post("/{code}/progress")
async def report_progress(
    code: str, body: ProgressIn, db: Db, x_player_token: Annotated[str | None, Header()] = None
) -> dict[str, Any]:
    """How far this player has got. Counts only go up; finishing for everyone ends the race."""
    now_ms = rooms._now_ms()
    room, me = await rooms._seat(db, code, x_player_token, now_ms)
    if not rooms.rules.is_skill(room):
        raise Conflict("This room is not playing a lesson.", "not_skill_room")
    if room["status"] != "playing":
        # Finished already (time, or everyone else done): say where things stand.
        return rooms._view(room, me, now_ms)
    await repo.progress(
        db,
        room["_id"],
        pid=me["pid"],
        answered=body.answered,
        first_try=body.firstTry,
        done=body.done,
        total=int(room["settings"]["count"]),
        now_ms=now_ms,
    )
    fresh = await repo.settle(db, room["_id"], now_ms) or room
    return rooms._view(fresh, repo.seat_of(fresh, x_player_token) or me, now_ms)


# The room's door, lobby and lifecycle are the same for every game: mount the
# Rebus handlers here too, so a skill's client talks only to `/group/rooms`.
for path, endpoint, methods in (
    ("/choices", rooms.choices, ["GET"]),
    ("/{code}", rooms.poll_room, ["GET"]),
    ("/{code}/join", rooms.join_room, ["POST"]),
    ("/{code}/start", rooms.start_room, ["POST"]),
    ("/{code}/lock", rooms.lock, ["POST"]),
    ("/{code}/kick", rooms.kick, ["POST"]),
    ("/{code}/accept", rooms.accept, ["POST"]),
    ("/{code}/decline", rooms.decline, ["POST"]),
    ("/{code}/asked", rooms.asked_grown_up, ["POST"]),
    ("/{code}/leave", rooms.leave, ["POST"]),
    ("/{code}/rematch", rooms.rematch, ["POST"]),
):
    router.add_api_route(path, endpoint, methods=methods)
