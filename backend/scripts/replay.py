"""Migration / replay command (Phase 0, item 8).

Two rollback-safe operations over the append-only event log:

    # normalize legacy events into canonical columns + verified flag
    .venv/bin/python scripts/replay.py backfill --dry-run
    .venv/bin/python scripts/replay.py backfill

    # rebuild the mastery_states projection from verified events
    .venv/bin/python scripts/replay.py replay --dry-run
    .venv/bin/python scripts/replay.py replay [--student <id>]

`--dry-run` reports counts and writes nothing. Neither operation destroys source
events — backfill only sets canonical columns; replay rebuilds a projection that
is fully derived from the log, so it can always be regenerated. All heavy logic
lives in `features/progression/projection.py` (pure, unit-tested); this file is
just the DB wiring.
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from beanie import init_beanie  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.features.progression.scoring import MASTERY_ORDER  # noqa: E402
from app.features.events.contract import (  # noqa: E402
    EventContractError, QUESTION_EVENTS, validate_release_binding,
)
from app.features.progression.projection import (  # noqa: E402
    apply_backfill_fields, build_mastery_states,
)
from app.models import ALL_MODELS  # noqa: E402
from app.models.event import LearningEvent  # noqa: E402
from app.models.mastery import MasteryState  # noqa: E402
from app.models.content import CurriculumRelease, SystemSettings  # noqa: E402
from app.core.scoring_config import DEFAULT_SCORING_CONFIG  # noqa: E402


async def _init_db() -> AsyncIOMotorClient:
    client = AsyncIOMotorClient(settings.mongo_uri)
    await init_beanie(database=client[settings.mongo_db], document_models=ALL_MODELS)
    return client


def _higher_level(a: str, b: str) -> str:
    return a if MASTERY_ORDER.index(a) >= MASTERY_ORDER.index(b) else b


async def run_backfill(dry_run: bool, student: str | None) -> None:
    query = {"student_id": student} if student else {}
    events = await LearningEvent.find(query).to_list()
    releases = {
        release.release_id: release
        for release in await CurriculumRelease.find_all().to_list()
    }
    raw = [e.model_dump() for e in events]
    normalized = []
    for stored in raw:
        fresh = apply_backfill_fields(stored)
        has_context = any(
            fresh.get(field)
            for field in ("curriculum_skill_id", "curriculum_id", "release_id", "assignment_id")
        )
        if fresh["verified"] and fresh.get("event_type") in QUESTION_EVENTS and has_context:
            try:
                release = releases.get(fresh.get("release_id"))
                if release is None:
                    raise EventContractError("releaseId does not exist")
                validate_release_binding(
                    fresh,
                    release_id=release.release_id,
                    curriculum_id=release.curriculum_id,
                    revision=release.revision,
                    question_manifest=release.question_manifest,
                )
            except EventContractError as exc:
                fresh["verified"] = False
                fresh["verification_error"] = str(exc)
        normalized.append(fresh)
    plan = {
        "scanned": len(raw),
        "would_change": sum(
            any(stored.get(key) != value for key, value in fresh.items())
            for stored, fresh in zip(raw, normalized)
        ),
        "would_verify": sum(
            bool(fresh["verified"]) and not bool(stored.get("verified"))
            for stored, fresh in zip(raw, normalized)
        ),
        "would_unverify": sum(
            not bool(fresh["verified"]) and bool(stored.get("verified"))
            for stored, fresh in zip(raw, normalized)
        ),
    }
    print(f"backfill: {plan}")
    if dry_run:
        print("(dry-run — nothing written)")
        return
    updated = 0
    for event, fresh in zip(events, normalized):
        changed = False
        for key, value in fresh.items():
            if getattr(event, key, None) != value:
                setattr(event, key, value)
                changed = True
        if changed:
            await event.save()
            updated += 1
    print(f"backfilled {updated} events")


async def _upsert_mastery(state: dict, now: datetime) -> None:
    next_review = None
    if state["next_review_at_ms"] is not None:
        next_review = datetime.fromtimestamp(state["next_review_at_ms"] / 1000, tz=timezone.utc)

    existing = await MasteryState.find_one(
        MasteryState.student_id == state["student_id"],
        MasteryState.curriculum_id == state["curriculum_id"],
        MasteryState.skill_id == state["skill_id"],
    )
    # Keep the trophy: a rebuild never lowers highest_earned_level.
    highest = state["level"]
    if existing:
        highest = _higher_level(existing.highest_earned_level, state["level"])

    payload = {k: v for k, v in state.items() if k != "next_review_at_ms"}
    payload["highest_earned_level"] = highest
    payload["next_review_at"] = next_review
    payload["updated_at"] = now

    if existing:
        for key, value in payload.items():
            setattr(existing, key, value)
        await existing.save()
    else:
        await MasteryState(**payload).insert()


async def run_replay(dry_run: bool, student: str | None) -> None:
    if student:
        students = [student]
    else:
        students = await LearningEvent.get_motor_collection().distinct("student_id")

    now = datetime.now(timezone.utc)
    now_ms = round(now.timestamp() * 1000)
    settings_doc = await SystemSettings.find_one(SystemSettings.key == "global")
    scoring_config = (
        settings_doc.scoring
        if settings_doc and settings_doc.scoring
        else DEFAULT_SCORING_CONFIG
    )
    scoring_revision = settings_doc.scoring_revision if settings_doc else 1
    total_students = total_states = 0
    for student_id in students:
        events = await LearningEvent.find(LearningEvent.student_id == student_id).to_list()
        states = build_mastery_states(
            student_id,
            [e.model_dump() for e in events],
            config=scoring_config,
            now_ms=now_ms,
            scoring_revision=scoring_revision,
        )
        total_students += 1
        total_states += len(states)
        if not dry_run:
            for state in states:
                await _upsert_mastery(state, now)
    suffix = "(dry-run — nothing written)" if dry_run else "written"
    print(f"replay: {total_students} students → {total_states} mastery states {suffix}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill events / replay mastery projection.")
    parser.add_argument("mode", choices=["backfill", "replay", "all"])
    parser.add_argument("--dry-run", action="store_true", help="report counts, write nothing")
    parser.add_argument("--student", default=None, help="limit to one student id")
    args = parser.parse_args()

    client = await _init_db()
    try:
        if args.mode in ("backfill", "all"):
            await run_backfill(args.dry_run, args.student)
        if args.mode in ("replay", "all"):
            await run_replay(args.dry_run, args.student)
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
