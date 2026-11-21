"""Who played Word Guess, read from the learning log.

Every finished game is one `answer_submitted` event from the Word Guess skill:
the word (`expected`), solved or not (`correct`, and "solved in N" in `given`),
hints, practice or today's word, the child and the day. Nothing new is stored
for this page — it only adds those events up.
"""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

SKILL = "koda-word-guess"
GUESSES = re.compile(r"solved in (\d+)")
MAX_GUESSES = 6


def since(today: str, days: int) -> str:
    return (date.fromisoformat(today) - timedelta(days=days - 1)).isoformat()


def game(e: dict[str, Any]) -> dict[str, Any]:
    """One event as one game."""
    m = GUESSES.search(str(e.get("given", "")))
    solved = bool(e.get("correct"))
    lesson = str(e.get("lessonId", "")).split(":")
    return {
        "learnerId": e.get("learnerId", ""),
        "familyId": e.get("familyId", ""),
        "day": e.get("localDay", ""),
        "ts": e.get("ts", ""),
        "lang": lesson[1] if len(lesson) > 2 else "",
        "word": str(e.get("expected", "")),
        "solved": solved,
        "guesses": int(m.group(1)) if solved and m else MAX_GUESSES,
        "hints": int(e.get("supportsUsed") or 0),
        "practice": bool(e.get("practice")),
    }


async def games(db: AsyncIOMotorDatabase, start: str, learner_id: str | None = None) -> list[dict[str, Any]]:
    flt: dict[str, Any] = {"skillId": SKILL, "type": "answer_submitted", "localDay": {"$gte": start}}
    if learner_id:
        flt["learnerId"] = learner_id
    return [game(e) async for e in db.events.find(flt).sort("ts", -1).limit(20000)]


def _rate(solved: int, played: int) -> int:
    return round(100 * solved / played) if played else 0


def summary(rows: list[dict[str, Any]], learners: dict[str, dict[str, Any]], words_allowed: set[tuple[str, str]] | None) -> dict[str, Any]:
    """Totals, one line per child, one line per word. `words_allowed` limits a teacher to their own words (and hides children)."""
    if words_allowed is not None:
        rows = [r for r in rows if (r["lang"], r["word"]) in words_allowed]
    kids: dict[str, dict[str, Any]] = {}
    words: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows:
        if words_allowed is None:
            k = kids.setdefault(r["learnerId"], {"learnerId": r["learnerId"], "games": 0, "solved": 0, "lastDay": ""})
            k["games"] += 1
            k["solved"] += r["solved"]
            k["lastDay"] = max(k["lastDay"], r["day"])
        w = words.setdefault(
            (r["lang"], r["word"]), {"lang": r["lang"], "word": r["word"], "played": 0, "solved": 0, "guesses": 0, "hints": 0}
        )
        w["played"] += 1
        w["solved"] += r["solved"]
        w["guesses"] += r["guesses"]
        w["hints"] += r["hints"]
    children = []
    for k in kids.values():
        who = learners.get(k["learnerId"], {})
        children.append(
            {
                **k,
                "name": who.get("displayName") or "",
                "birthYear": who.get("birthYear"),
                "avatarSeed": who.get("avatarSeed") or "",
                "solvedPct": _rate(k["solved"], k["games"]),
            }
        )
    children.sort(key=lambda c: (c["lastDay"], c["games"]), reverse=True)
    word_rows = [
        {**w, "solvedPct": _rate(w["solved"], w["played"]), "avgGuesses": round(w["guesses"] / w["played"], 1)} for w in words.values()
    ]
    # Hardest first: lowest solve rate, then the most played.
    word_rows.sort(key=lambda w: (w["solvedPct"], -w["played"], w["word"]))
    return {
        "totals": {
            "games": len(rows),
            "children": len({r["learnerId"] for r in rows}),
            "solvedPct": _rate(sum(r["solved"] for r in rows), len(rows)),
        },
        "children": children,
        "words": word_rows[:100],
    }


async def learner_names(db: AsyncIOMotorDatabase, ids: set[str]) -> dict[str, dict[str, Any]]:
    if not ids:
        return {}
    rows = db.learners.find({"_id": {"$in": list(ids)}}, {"displayName": 1, "birthYear": 1, "avatarSeed": 1})
    return {r["_id"]: r async for r in rows}
