"""Rebus Rush group rooms: the rules, with no database and no clock of their own.

A room is a short-lived race. Everyone sees the same puzzles; the first player
to claim a correct answer takes the puzzle's points and ends it for the others.
The server decides who was first, by the order claims arrive, and decides when a
puzzle ends and the next begins. Time is passed in as epoch milliseconds, so a
test can play a whole room in microseconds.

Safety for children who join without an account is built into the data, not
bolted on: a player is only ever a nickname and an avatar chosen from the lists
here. There is no free text from a child anywhere in a room.
"""

from __future__ import annotations

import hashlib
import random
import secrets
from typing import Any

#: Six characters, no 0/O/1/I/L, so a code read aloud or copied by a child is hard to get wrong.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6

#: What a player may be called. Chosen from this list, never typed.
NICKNAMES: tuple[str, ...] = (
    "Brave Tiger",
    "Clever Fox",
    "Happy Panda",
    "Swift Falcon",
    "Quiet Owl",
    "Bright Dolphin",
    "Kind Elephant",
    "Bold Lion",
    "Gentle Deer",
    "Lucky Rabbit",
    "Mighty Bear",
    "Silly Monkey",
    "Sunny Parrot",
    "Cool Turtle",
    "Speedy Cheetah",
    "Proud Peacock",
    "Jolly Frog",
    "Wise Crane",
    "Sparkly Otter",
    "Zippy Koala",
    "Calm Whale",
    "Cheery Robin",
    "Daring Eagle",
    "Merry Penguin",
)
AVATARS: tuple[str, ...] = ("tiger", "fox", "panda", "falcon", "owl", "dolphin", "elephant", "lion", "deer", "rabbit", "bear", "monkey")

#: Seconds, between the host pressing Start and the first puzzle, and between puzzles.
COUNTDOWN_MS = 3_000
REVEAL_MS = 5_000
#: A room that nobody has finished by now is cleaned up.
ROOM_LIFETIME_MS = 2 * 60 * 60 * 1000
#: Heard from within this long counts as connected.
PRESENT_MS = 10_000

CATEGORIES = ("countries", "food", "sayings", "animals", "sports", "school", "science")


def make_code(rng: secrets.SystemRandom | random.Random | None = None) -> str:
    pick = (rng or secrets.SystemRandom()).choice
    return "".join(pick(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def normalize_code(raw: str) -> str:
    """Whatever a person typed or pasted, as a code: case, spaces, dashes and a KODA prefix forgiven."""
    cleaned = "".join(ch for ch in raw.upper() if ch.isalnum())
    if cleaned.startswith("KODA") and len(cleaned) > CODE_LENGTH:
        cleaned = cleaned[4:]
    return cleaned


def new_token() -> str:
    return secrets.token_urlsafe(24)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def answer_key(puzzle: dict[str, Any]) -> str:
    return "".join(ch for ch in str(puzzle.get("answer", "")).lower() if ch.isalnum())


def pick_puzzles(published: list[dict[str, Any]], *, category: str, count: int, difficulty: int | None, seed: str) -> list[dict[str, Any]]:
    """The room's puzzles: one per answer, shuffled by the room's seed, easy to hard."""
    rng = random.Random(seed)
    seen: set[str] = set()
    pool: list[dict[str, Any]] = []
    for puzzle in published:
        if category != "mixed" and puzzle.get("category") != category:
            continue
        if difficulty is not None and puzzle.get("difficulty") != difficulty:
            continue
        key = answer_key(puzzle)
        if key in seen:
            continue
        seen.add(key)
        pool.append(puzzle)
    rng.shuffle(pool)

    if category == "mixed":
        lanes: dict[str, list[dict[str, Any]]] = {}
        for puzzle in pool:
            lanes.setdefault(puzzle["category"], []).append(puzzle)
        order = list(lanes.values())
        rng.shuffle(order)
        chosen: list[dict[str, Any]] = []
        depth = 0
        while len(chosen) < count and any(depth < len(lane) for lane in order):
            for lane in order:
                if len(chosen) < count and depth < len(lane):
                    chosen.append(lane[depth])
            depth += 1
    else:
        chosen = pool[:count]
    return sorted(chosen, key=lambda p: p.get("difficulty", 1) + rng.random() * 0.9)


def points_for(hints: int, *, per_puzzle: int, hint_cost: int) -> int:
    """A win with no hints is worth the full points, each hint takes the owner's cost off, never below 1."""
    return max(1, per_puzzle - hint_cost * max(0, hints))


def limit_ms(room: dict[str, Any]) -> int:
    return int(room["settings"]["puzzleLimitSec"]) * 1000


def tick(room: dict[str, Any], now_ms: int) -> dict[str, Any] | None:
    """What time alone changes: a puzzle running out, a reveal ending, the next puzzle or the finish.

    Returns the fields to set, or None when nothing has changed. It catches up
    in a loop, so a device that was away for a minute is told where the room is
    now, not where it was.
    """
    if room["status"] != "playing":
        return None
    index = room["index"]
    start = room["puzzleStartMs"]
    ended = room.get("endedMs")
    results = list(room["results"])
    status = "playing"
    changed = False
    total = len(room["puzzles"])

    while True:
        if ended is None:
            if now_ms >= start + limit_ms(room):
                ended = start + limit_ms(room)
                results.append({"index": index, "winnerPid": None, "points": 0, "hints": 0, "atMs": limit_ms(room)})
                changed = True
                continue
            break
        if now_ms >= ended + REVEAL_MS:
            changed = True
            if index + 1 >= total:
                status = "finished"
                break
            index += 1
            start = ended + REVEAL_MS
            ended = None
            continue
        break

    if not changed:
        return None
    return {"status": status, "index": index, "puzzleStartMs": start, "endedMs": ended, "results": results}


def standings(room: dict[str, Any]) -> list[dict[str, Any]]:
    """Players by score, highest first; equal scores share a place."""
    ranked = sorted(room["players"], key=lambda p: (-p["score"], p["joinedMs"]))
    out: list[dict[str, Any]] = []
    place = 0
    last: int | None = None
    for position, player in enumerate(ranked, start=1):
        if player["score"] != last:
            place = position
            last = player["score"]
        out.append({"pid": player["pid"], "place": place, "score": player["score"]})
    return out
